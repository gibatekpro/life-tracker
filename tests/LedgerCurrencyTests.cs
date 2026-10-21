using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Features.Summary;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace LifeTracker.Api.Tests;

// Pounds and naira together, through the real LedgerService against real Postgres:
// transfers between currencies, naira spending converted at my own transfer rate, and naira loans.
[Trait("Category", "Integration")]
public class LedgerCurrencyTests(PostgresFixture pg) : IClassFixture<PostgresFixture>
{
    private static readonly DateOnly Oct1 = new(2026, 10, 1);

    private sealed record Setup(AppDbContext Db, LedgerService Ledger, Account Lloyds, Account PalmPay, Account LoanApp);

    // A fresh, fully migrated database (which already has Lloyds Current and Revolut),
    // plus a naira current account and a naira loan app.
    private async Task<Setup> SetupAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(pg.NewDatabase()).Options);
        await db.Database.MigrateAsync();

        var lloyds = await db.Accounts.SingleAsync(a => a.Name == "Lloyds Current");
        lloyds.Balance = 1000m;
        var palmPay = new Account { Name = "PalmPay", Type = AccountType.Current, Currency = "NGN" };
        var loanApp = new Account { Name = "Loan app", Type = AccountType.Loan, Currency = "NGN", Balance = 50000m, MonthlyPayment = 25000m };
        db.Accounts.AddRange(palmPay, loanApp);
        await db.SaveChangesAsync();

        var ledger = new LedgerService(db, new ExchangeRateService(db), NullLogger<LedgerService>.Instance);
        return new Setup(db, ledger, lloyds, palmPay, loanApp);
    }

    private static LedgerEntry PoundsToNaira(Setup s, decimal pounds, decimal naira, DateOnly date) =>
        new(pounds, "Send home", "Transfer", date, TransactionType.Transfer, s.Lloyds.Id, s.PalmPay.Id, ToAmount: naira);

    private static LedgerEntry NairaExpense(Setup s, decimal naira, DateOnly date, decimal? gbp = null) =>
        new(naira, "Market", "Food", date, TransactionType.Expense, s.PalmPay.Id, GbpAmount: gbp);

    [Fact]
    public async Task PoundsToNaira_MovesEachBalanceInItsOwnCurrency()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        var result = await s.Ledger.RecordAsync(PoundsToNaira(s, 10m, 18000m, Oct1));

        Assert.Null(result.Error);
        Assert.Equal(990m, s.Lloyds.Balance);
        Assert.Equal(18000m, s.PalmPay.Balance);
        Assert.Equal(10m, result.Transaction!.GbpAmount);
        Assert.Equal(18000m, result.Transaction.ToAmount);
    }

    [Fact]
    public async Task TransferBetweenCurrencies_NeedsTheAmountReceived()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        var result = await s.Ledger.RecordAsync(
            new LedgerEntry(10m, "Send home", "Transfer", Oct1, TransactionType.Transfer, s.Lloyds.Id, s.PalmPay.Id));

        Assert.Contains("amount received in NGN", result.Error);
        Assert.Equal(1000m, s.Lloyds.Balance);
    }

    [Fact]
    public async Task TransferWithinOneCurrency_RejectsAReceivedAmount()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var revolut = await s.Db.Accounts.SingleAsync(a => a.Name == "Revolut");

        var result = await s.Ledger.RecordAsync(new LedgerEntry(
            10m, "Move", "Transfer", Oct1, TransactionType.Transfer, s.Lloyds.Id, revolut.Id, ToAmount: 12m));

        Assert.Contains("no separate received amount", result.Error);
    }

    [Fact]
    public async Task NairaExpense_ConvertsAtTheLatestTransferRate_AndCountsInTheSummaryInPounds()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        await s.Ledger.RecordAsync(PoundsToNaira(s, 10m, 18000m, new DateOnly(2026, 10, 1)));    // ₦1,800 per £
        await s.Ledger.RecordAsync(PoundsToNaira(s, 10m, 20000m, new DateOnly(2026, 10, 10)));   // ₦2,000 per £

        var recent = await s.Ledger.RecordAsync(NairaExpense(s, 5000m, new DateOnly(2026, 10, 15)));
        var backDated = await s.Ledger.RecordAsync(NairaExpense(s, 3600m, new DateOnly(2026, 10, 5)));

        Assert.Equal(2.50m, recent.Transaction!.GbpAmount);      // 5,000 / 2,000
        Assert.Equal(2.00m, backDated.Transaction!.GbpAmount);   // 3,600 / 1,800, the rate back then
        Assert.Equal(38000m - 8600m, s.PalmPay.Balance);

        var settings = new SettingsService(s.Db, Options.Create(new BudgetOptions()), NullLogger<SettingsService>.Instance);
        var summary = await new SummaryService(s.Db, settings, NullLogger<SummaryService>.Instance).GetMonthlyAsync(2026, 10);

        Assert.Equal(4.50m, summary.TotalSpent);   // the two expenses in pounds; the transfers aren't spending
    }

    [Fact]
    public async Task NairaExpense_BeforeAnyTransfer_NeedsAPoundValue()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        var withoutValue = await s.Ledger.RecordAsync(NairaExpense(s, 5000m, Oct1));
        var withValue = await s.Ledger.RecordAsync(NairaExpense(s, 5000m, Oct1, gbp: 3m));

        Assert.Contains("enter the £ value", withoutValue.Error);
        Assert.Equal(3m, withValue.Transaction!.GbpAmount);
    }

    [Fact]
    public async Task PoundValue_IsRejectedOnAPoundsAccount()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        var result = await s.Ledger.RecordAsync(
            new LedgerEntry(5m, "Lunch", "Food", Oct1, TransactionType.Expense, s.Lloyds.Id, GbpAmount: 5m));

        Assert.Contains("only for something in another currency", result.Error);
    }

    [Fact]
    public async Task RepayingANairaLoanFromPounds_ChecksWhatIsOwedInNaira()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        var tooMuch = await s.Ledger.RecordAsync(new LedgerEntry(
            30m, "Loan repayment", "Debt", Oct1, TransactionType.Transfer, s.Lloyds.Id, s.LoanApp.Id, ToAmount: 60000m));
        var ok = await s.Ledger.RecordAsync(new LedgerEntry(
            25m, "Loan repayment", "Debt", Oct1, TransactionType.Transfer, s.Lloyds.Id, s.LoanApp.Id, ToAmount: 45000m));

        Assert.Contains("50000.00 NGN owed", tooMuch.Error);
        Assert.Null(ok.Error);
        Assert.Equal(975m, s.Lloyds.Balance);
        Assert.Equal(5000m, s.LoanApp.Balance);
    }

    [Fact]
    public async Task Update_ToAnotherCurrency_UsesTheNewAmount()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Ledger.RecordAsync(PoundsToNaira(s, 10m, 18000m, Oct1));   // PalmPay ₦18,000, rate ₦1,800
        var lunch = await s.Ledger.RecordAsync(
            new LedgerEntry(5m, "Lunch", "Food", Oct1, TransactionType.Expense, s.Lloyds.Id));

        // It was really ₦9,000 from PalmPay: the amount is re-entered in naira.
        var result = await s.Ledger.UpdateAsync(lunch.Transaction!.Id,
            new LedgerEntry(9000m, "Lunch", "Food", Oct1, TransactionType.Expense, s.PalmPay.Id));

        Assert.Null(result!.Error);
        Assert.Equal(990m, s.Lloyds.Balance);       // the £5 is back
        Assert.Equal(9000m, s.PalmPay.Balance);     // 18,000 - 9,000
        Assert.Equal(5.00m, result.Transaction!.GbpAmount);
    }
}
