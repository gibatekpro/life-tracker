using LifeTracker.Api.Common;
using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Features.Debts;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Features.Summary;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Budgets;

// A budget month for the page: the calculator's figures, plus which income it used and the
// debt budget from Settings (the avalanche plan's fallback).
public record BudgetMonthView(BudgetMonth Budget, IncomeMode IncomeMode, decimal? SettingsDebtBudget);

// Which line a month's figure is for: a spending category or a debt account (exactly one).
public record BudgetLineKey(int? CategoryId, int? AccountId);

// Gathers a budget month from the database, all in pounds, and hands it to BudgetCalculator:
// each category's default and this month's figure, spending per category, each debt's default
// (its monthly payment) and what was paid into it, the income, and the avalanche plan's suggestions.
// Also sets, resets and copies a month's figures, and gives the avalanche plan its monthly budget.
public class BudgetService(
    AppDbContext db, SettingsService settings, SummaryService summary, ExchangeRateService rates,
    ILogger<BudgetService> logger)
{
    // With no year and month, the budget month I'm in now (following payday), like the summary.
    public async Task<BudgetMonthView> GetMonthAsync(int? year = null, int? month = null)
    {
        var s = await settings.GetAsync();
        var period = PeriodFor(s, year, month);
        var today = UkDate.Today();

        var amounts = await MonthAmountsAsync(period);
        var categories = await db.Categories
            .Where(c => c.Kind == CategoryKind.Expense)
            .Select(c => new { c.Id, c.ParentId, c.Name, c.SortOrder, c.IsArchived, c.DefaultMonthlyAmount })
            .ToListAsync();

        // Spending in the month, in pounds (a naira purchase counts as its stored £ value).
        var spent = await db.Transactions
            .Where(t => t.Type == TransactionType.Expense && t.Date >= period.Start && t.Date < period.End && t.CategoryId != null)
            .GroupBy(t => t.CategoryId!.Value)
            .Select(g => new { CategoryId = g.Key, Total = g.Sum(t => t.GbpAmount) })
            .ToDictionaryAsync(x => x.CategoryId, x => x.Total);

        var debts = await DebtsAsync(period, amounts);
        var debtBudget = DebtBudget(debts, s);

        // What the avalanche plan would pay each debt this month, with this month's debt budget.
        var plan = AvalanchePlanner.Plan(await PlannerDebtsAsync(), today, 0, debtBudget);
        var suggested = plan.FirstMonth.ToDictionary(p => p.Id, p => p.Amount);

        var result = BudgetCalculator.Calculate(new BudgetInput(
            period, today, await summary.IncomeAsync(s, period),
            categories.Select(c => new BudgetCategory(c.Id, c.ParentId, c.Name, c.SortOrder, c.IsArchived,
                c.DefaultMonthlyAmount, MonthAmount(amounts, new BudgetLineKey(c.Id, null)))).ToList(),
            spent,
            debts.Select(d => new DebtInput(d.Account.Id, d.Account.Name, d.Default, d.MonthAmount, d.Paid,
                suggested.TryGetValue(d.Account.Id, out var x) ? x : null)).ToList(),
            s.MonthlyDebtBudget));

        logger.LogDebug("Budget {Start} to {End}: planned £{Planned} of £{Income}, spent £{Spent}, safe £{Safe}/day",
            result.PeriodStart, result.PeriodEnd, result.TotalPlanned, result.Income, result.Spent, result.SafeToSpendPerDay);
        return new BudgetMonthView(result, s.IncomeMode, s.MonthlyDebtBudget);
    }

    // Sets a month's figure for a category or debt, replacing any figure it already had.
    public async Task<string?> SetAmountAsync(int year, int month, BudgetLineKey key, decimal amount)
    {
        if (await CheckKeyAsync(key) is { } problem) return problem;
        if (amount < 0) return "A budget can't be negative.";

        var period = PeriodFor(await settings.GetAsync(), year, month);
        var existing = await InMonth(period).FirstOrDefaultAsync(b => b.CategoryId == key.CategoryId && b.AccountId == key.AccountId);
        if (existing is null)
            db.BudgetMonthAmounts.Add(new BudgetMonthAmount
                { CategoryId = key.CategoryId, AccountId = key.AccountId, PeriodStart = period.Start, Amount = amount });
        else
            existing.Amount = amount;
        await db.SaveChangesAsync();

        logger.LogInformation("Set {Year}-{Month:00} budget for {Line} to £{Amount}", year, month, Describe(key), amount);
        return null;
    }

    // Back to the default: removes the month's own figure.
    public async Task ResetAsync(int year, int month, BudgetLineKey key)
    {
        var period = PeriodFor(await settings.GetAsync(), year, month);
        var removed = await InMonth(period)
            .Where(b => b.CategoryId == key.CategoryId && b.AccountId == key.AccountId)
            .ExecuteDeleteAsync();
        logger.LogInformation("Reset {Year}-{Month:00} budget for {Line} to its default ({Removed} removed)",
            year, month, Describe(key), removed);
    }

    // Copies last month's own figures into this month (replacing any this month already has).
    // Lines that were on their default stay on their default. Returns how many were copied.
    public async Task<int> CopyPreviousAsync(int year, int month)
    {
        var s = await settings.GetAsync();
        var period = PeriodFor(s, year, month);
        var previousStart = period.Start.AddMonths(-1);
        var previous = PeriodFor(s, previousStart.Year, previousStart.Month);

        var source = await InMonth(previous).AsNoTracking().ToListAsync();
        var target = await InMonth(period).ToListAsync();
        foreach (var b in source)
        {
            var existing = target.FirstOrDefault(t => t.CategoryId == b.CategoryId && t.AccountId == b.AccountId);
            if (existing is null)
                db.BudgetMonthAmounts.Add(new BudgetMonthAmount
                    { CategoryId = b.CategoryId, AccountId = b.AccountId, PeriodStart = period.Start, Amount = b.Amount });
            else
                existing.Amount = b.Amount;
        }
        await db.SaveChangesAsync();

        logger.LogInformation("Copied {Count} budget figures from {From:yyyy-MM} into {To:yyyy-MM}",
            source.Count, previous.Start, period.Start);
        return source.Count;
    }

    // The avalanche plan for the budget month I'm in now, with that month's debt budget
    // (its debt lines once any is set, otherwise the debt budget from Settings).
    public async Task<AvalanchePlan> AvalancheAsync(decimal extra)
    {
        var s = await settings.GetAsync();
        var period = BudgetPeriod.Containing(UkDate.Today(), s.MonthStartDay);
        var budget = DebtBudget(await DebtsAsync(period, await MonthAmountsAsync(period)), s);
        var debts = await PlannerDebtsAsync();

        var plan = AvalanchePlanner.Plan(debts, UkDate.Today(), extra, budget);
        if (!plan.CanBePaidOff)
            logger.LogWarning("Avalanche plan can't clear the debts within 50 years at £{Budget}/month", plan.MonthlyBudget);
        else
            logger.LogDebug("Avalanche plan: £{Budget}/month clears {Count} debts in {Months} months ({DebtFreeDate:yyyy-MM-dd})",
                plan.MonthlyBudget, debts.Count, plan.Months, plan.DebtFreeDate);
        return plan;
    }

    // A budget month: the named month, starting on payday (Settings.MonthStartDay).
    private static BudgetPeriod PeriodFor(AppSettings s, int? year, int? month) =>
        year is { } y && month is { } m ? BudgetPeriod.For(y, m, s.MonthStartDay) : BudgetPeriod.Containing(UkDate.Today(), s.MonthStartDay);

    // A month's figures are found by the month they're for, not the exact start day, so changing
    // payday later doesn't move a figure set for November into October.
    private IQueryable<BudgetMonthAmount> InMonth(BudgetPeriod period)
    {
        var first = new DateOnly(period.Year, period.Month, 1);
        var next = first.AddMonths(1);
        return db.BudgetMonthAmounts.Where(b => b.PeriodStart >= first && b.PeriodStart < next);
    }

    private async Task<Dictionary<BudgetLineKey, decimal>> MonthAmountsAsync(BudgetPeriod period) =>
        (await InMonth(period).ToListAsync())
            .GroupBy(b => new BudgetLineKey(b.CategoryId, b.AccountId))
            .ToDictionary(g => g.Key, g => g.OrderByDescending(b => b.Id).First().Amount);

    // A line's own figure for the month, or null when it has none (and so uses its default).
    // Not GetValueOrDefault: for a decimal that returns 0, which would mean "£0 this month".
    private static decimal? MonthAmount(Dictionary<BudgetLineKey, decimal> amounts, BudgetLineKey key) =>
        amounts.TryGetValue(key, out var amount) ? amount : null;

    private sealed record DebtFigures(Account Account, decimal? Default, decimal? MonthAmount, decimal Paid);

    // One line per card or loan that I owe on, or paid into this month, or set a figure for.
    // The default is the account's monthly payment in pounds (a naira loan converts at my latest
    // transfer rate, or has no default until there's one). Paid is the transfers into it this month.
    private async Task<List<DebtFigures>> DebtsAsync(BudgetPeriod period, Dictionary<BudgetLineKey, decimal> amounts)
    {
        var paid = await db.Transactions
            .Where(t => t.Type == TransactionType.Transfer && t.ToAccountId != null
                        && t.Date >= period.Start && t.Date < period.End)
            .GroupBy(t => t.ToAccountId!.Value)
            .Select(g => new { AccountId = g.Key, Total = g.Sum(t => t.GbpAmount) })
            .ToDictionaryAsync(x => x.AccountId, x => x.Total);

        var accounts = await db.Accounts
            .Where(a => a.Type == AccountType.CreditCard || a.Type == AccountType.Loan)
            .OrderByDescending(a => a.Apr).ThenBy(a => a.Name)
            .ToListAsync();

        var result = new List<DebtFigures>();
        foreach (var a in accounts)
        {
            var monthAmount = MonthAmount(amounts, new BudgetLineKey(null, a.Id));
            var paidIn = paid.GetValueOrDefault(a.Id);
            if (a.Balance <= 0 && paidIn == 0 && monthAmount is null) continue;

            result.Add(new DebtFigures(a, await rates.ToPoundsAsync(a.MonthlyPayment, a.Currency), monthAmount, paidIn));
        }
        return result;
    }

    // Decision 1: once any debt figure is set for the month, the month's debt lines (figure, or
    // default) are the debt budget; until then, the debt budget from Settings.
    private static decimal? DebtBudget(List<DebtFigures> debts, AppSettings s) =>
        debts.Any(d => d.MonthAmount is not null)
            ? debts.Sum(d => d.MonthAmount ?? d.Default ?? 0)
            : s.MonthlyDebtBudget;

    // The debts the avalanche plan works on, in pounds. A naira debt with no transfer rate yet is left out.
    private async Task<List<PlannerDebt>> PlannerDebtsAsync()
    {
        var accounts = await db.Accounts
            .Where(a => (a.Type == AccountType.CreditCard || a.Type == AccountType.Loan) && a.Balance > 0)
            .ToListAsync();

        var debts = new List<PlannerDebt>();
        foreach (var a in accounts)
        {
            if ((await rates.GetAsync(a.Currency, Currencies.Home)).Rate is not { } rate)
            {
                logger.LogWarning("{Name} is left out of the avalanche plan: no {Currency} to GBP rate yet", a.Name, a.Currency);
                continue;
            }
            debts.Add(new PlannerDebt(a.Id, a.Name,
                Currencies.Convert(a.Balance, rate), a.Apr, Currencies.Convert(a.MonthlyPayment, rate)));
        }
        return debts;
    }

    private async Task<string?> CheckKeyAsync(BudgetLineKey key)
    {
        if ((key.CategoryId is null) == (key.AccountId is null))
            return "Give either a category or a debt account.";

        if (key.CategoryId is { } c)
        {
            var category = await db.Categories.FindAsync(c);
            if (category is null) return $"Category {c} doesn't exist.";
            if (category.Kind != CategoryKind.Expense) return "Only spending categories have a budget.";
        }
        if (key.AccountId is { } a)
        {
            var account = await db.Accounts.FindAsync(a);
            if (account is null) return $"Account {a} doesn't exist.";
            if (account.Type == AccountType.Current) return $"{account.Name} isn't a card or loan.";
        }
        return null;
    }

    private static string Describe(BudgetLineKey key) =>
        key.CategoryId is { } c ? $"category {c}" : $"debt account {key.AccountId}";
}
