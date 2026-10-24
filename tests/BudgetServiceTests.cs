using LifeTracker.Api.Common;
using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Features.Budgets;
using LifeTracker.Api.Features.Categories;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Features.Summary;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace LifeTracker.Api.Tests;

// Budget months against real Postgres: defaults and month figures, debts and the avalanche link.
[Trait("Category", "Integration")]
public class BudgetServiceTests(PostgresFixture pg) : IClassFixture<PostgresFixture>
{
    private sealed record Setup(
        AppDbContext Db, BudgetService Budgets, SettingsService Settings, LedgerService Ledger,
        Account Lloyds, Account Card, int Food, int CouncilTax);

    private async Task<Setup> SetupAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(pg.NewDatabase()).Options);
        await db.Database.MigrateAsync();

        var settings = new SettingsService(db, Options.Create(new BudgetOptions()), NullLogger<SettingsService>.Instance);
        await settings.UpdateAsync(2000m, 300m);   // take-home pay £2,000, debt budget £300
        var rates = new ExchangeRateService(db);
        var summary = new SummaryService(db, settings, NullLogger<SummaryService>.Instance);
        var budgets = new BudgetService(db, settings, summary, rates, NullLogger<BudgetService>.Instance);
        var ledger = new LedgerService(db, rates, NullLogger<LedgerService>.Instance);

        var lloyds = await db.Accounts.SingleAsync(a => a.Name == "Lloyds Current");
        lloyds.Balance = 3000m;
        var card = new Account { Name = "Card", Type = AccountType.CreditCard, Balance = 1000m, Apr = 25m, MonthlyPayment = 50m };
        var councilTax = new Category { Name = "Council tax", Kind = CategoryKind.Expense, DefaultMonthlyAmount = 120m };
        db.AddRange(card, councilTax);
        await db.SaveChangesAsync();

        return new Setup(db, budgets, settings, ledger, lloyds, card, await TestCategories.IdAsync(db, "Food"), councilTax.Id);
    }

    private static BudgetLine Line(BudgetMonthView v, int categoryId) =>
        BudgetCalculator.Flatten(v.Budget.Lines).Single(l => l.CategoryId == categoryId);

    private static BudgetPeriod Now(int startDay = 1) => BudgetPeriod.Containing(UkDate.Today(), startDay);

    [Fact]
    public async Task MonthFigure_OverridesTheDefault_ForThatMonthOnly_UntilReset()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        Assert.Null(await s.Budgets.SetAmountAsync(2026, 11, new BudgetLineKey(s.CouncilTax, null), 125m));
        var november = await s.Budgets.GetMonthAsync(2026, 11);
        var december = await s.Budgets.GetMonthAsync(2026, 12);
        await s.Budgets.ResetAsync(2026, 11, new BudgetLineKey(s.CouncilTax, null));
        var reset = await s.Budgets.GetMonthAsync(2026, 11);

        Assert.Equal((125m, 120m, 125m), (Line(november, s.CouncilTax).Planned, Line(november, s.CouncilTax).DefaultAmount, Line(november, s.CouncilTax).MonthAmount));
        Assert.Equal(120m, Line(december, s.CouncilTax).Planned);
        Assert.Equal(120m, Line(reset, s.CouncilTax).Planned);
        Assert.Null(Line(reset, s.CouncilTax).MonthAmount);
    }

    [Fact]
    public async Task SettingAgain_ReplacesTheMonthFigure()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        await s.Budgets.SetAmountAsync(2026, 11, new BudgetLineKey(s.Food, null), 200m);
        await s.Budgets.SetAmountAsync(2026, 11, new BudgetLineKey(s.Food, null), 250m);

        Assert.Equal(250m, Line(await s.Budgets.GetMonthAsync(2026, 11), s.Food).Planned);
        Assert.Equal(1, await s.Db.BudgetMonthAmounts.CountAsync());
    }

    [Fact]
    public async Task CopyPrevious_CarriesLastMonthsFiguresOver()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Budgets.SetAmountAsync(2026, 10, new BudgetLineKey(s.CouncilTax, null), 125m);
        await s.Budgets.SetAmountAsync(2026, 10, new BudgetLineKey(s.Food, null), 220m);
        await s.Budgets.SetAmountAsync(2026, 11, new BudgetLineKey(s.Food, null), 180m);

        var copied = await s.Budgets.CopyPreviousAsync(2026, 11);
        var november = await s.Budgets.GetMonthAsync(2026, 11);

        Assert.Equal(2, copied);
        Assert.Equal(125m, Line(november, s.CouncilTax).Planned);
        Assert.Equal(220m, Line(november, s.Food).Planned);   // replaced November's own 180
    }

    [Fact]
    public async Task Spending_CountsInPounds_IncludingNaira()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var palmPay = new Account { Name = "PalmPay", Type = AccountType.Current, Currency = "NGN" };
        s.Db.Accounts.Add(palmPay);
        await s.Db.SaveChangesAsync();
        var p = Now();
        await s.Ledger.RecordAsync(new LedgerEntry(10m, "Send home", null, p.Start, TransactionType.Transfer, s.Lloyds.Id, palmPay.Id, ToAmount: 18000m));
        await s.Ledger.RecordAsync(new LedgerEntry(5000m, "Market", s.Food, p.Start, TransactionType.Expense, palmPay.Id));
        await s.Ledger.RecordAsync(new LedgerEntry(12m, "Tesco", s.Food, p.Start, TransactionType.Expense, s.Lloyds.Id));

        var view = await s.Budgets.GetMonthAsync();

        Assert.Equal(14.78m, Line(view, s.Food).Spent);   // £12 + ₦5,000 at ₦1,800/£
        Assert.Equal(2000m, view.Budget.Income);
    }

    [Fact]
    public async Task DebtLine_ShowsWhatWasPaidIn_ItsDefault_AndTheAvalancheSuggestion()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Ledger.RecordAsync(new LedgerEntry(30m, "Card payment", null, Now().Start, TransactionType.Transfer, s.Lloyds.Id, s.Card.Id));

        var debt = (await s.Budgets.GetMonthAsync()).Budget.Debts.Single(d => d.AccountId == s.Card.Id);

        Assert.Equal(50m, debt.DefaultAmount);
        Assert.Equal(30m, debt.Paid);
        Assert.Equal(20m, debt.Remaining);
        Assert.Equal(300m, debt.Suggested);   // the only debt gets the whole £300 debt budget
    }

    [Fact]
    public async Task WithoutDebtFigures_TheAvalancheUsesTheSettingsDebtBudget()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        var plan = await s.Budgets.AvalancheAsync(0);
        var view = await s.Budgets.GetMonthAsync();

        Assert.Equal(300m, plan.MonthlyBudget);
        Assert.False(view.Budget.HasMonthDebtAmounts);
        Assert.Equal(300m, view.Budget.DebtBudget);
    }

    [Fact]
    public async Task WithADebtFigure_TheAvalancheUsesThisMonthsDebtLines()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var p = Now();
        await s.Budgets.SetAmountAsync(p.Year, p.Month, new BudgetLineKey(null, s.Card.Id), 150m);

        var plan = await s.Budgets.AvalancheAsync(0);
        var view = await s.Budgets.GetMonthAsync();

        Assert.Equal(150m, plan.MonthlyBudget);
        Assert.True(view.Budget.HasMonthDebtAmounts);
        Assert.Equal(150m, view.Budget.Debts.Single().Planned);
        Assert.Equal(150m, view.Budget.Debts.Single().Suggested);
    }

    [Fact]
    public async Task MonthFigures_StayWithTheirMonth_WhenPaydayChanges()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Settings.UpdateAsync(2000m, 300m, monthStartDay: 25);
        await s.Budgets.SetAmountAsync(2026, 11, new BudgetLineKey(s.CouncilTax, null), 125m);   // stored as 25 Nov

        await s.Settings.UpdateAsync(2000m, 300m, monthStartDay: 1);
        var november = await s.Budgets.GetMonthAsync(2026, 11);
        var october = await s.Budgets.GetMonthAsync(2026, 10);

        Assert.Equal(125m, Line(november, s.CouncilTax).Planned);
        Assert.Equal(120m, Line(october, s.CouncilTax).Planned);
    }

    [Theory]
    [InlineData(true, true)]
    [InlineData(false, false)]
    public async Task ALine_IsACategoryOrADebt_NotBothOrNeither(bool category, bool account)
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        var problem = await s.Budgets.SetAmountAsync(2026, 11,
            new BudgetLineKey(category ? s.Food : null, account ? s.Card.Id : null), 10m);

        Assert.Equal("Give either a category or a debt account.", problem);
    }

    [Fact]
    public async Task IncomeCategories_AndCurrentAccounts_HaveNoBudgetLine()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var salary = await TestCategories.IdAsync(s.Db, "Salary", CategoryKind.Income);

        Assert.NotNull(await s.Budgets.SetAmountAsync(2026, 11, new BudgetLineKey(salary, null), 10m));
        Assert.NotNull(await s.Budgets.SetAmountAsync(2026, 11, new BudgetLineKey(null, s.Lloyds.Id), 10m));
    }

    [Fact]
    public async Task CategoryWithBudgetHistory_CantBeDeleted()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Budgets.SetAmountAsync(2026, 11, new BudgetLineKey(s.CouncilTax, null), 125m);

        var result = await new CategoryService(s.Db, NullLogger<CategoryService>.Instance).DeleteAsync(s.CouncilTax);

        Assert.Equal(CategoryProblem.Conflict, result.Problem);
        Assert.Contains("budgets in 1 month", result.Error);
    }
}
