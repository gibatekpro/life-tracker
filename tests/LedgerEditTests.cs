using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace LifeTracker.Api.Tests;

// Editing and deleting transactions through the real LedgerService against real Postgres:
// whatever changes, the balances must end up as if it had been right from the start.
[Trait("Category", "Integration")]
public class LedgerEditTests(PostgresFixture pg) : IClassFixture<PostgresFixture>
{
    private static readonly DateOnly Oct1 = new(2026, 10, 1);

    private sealed record Setup(AppDbContext Db, LedgerService Ledger, Account Lloyds, Account Aqua);

    private async Task<Setup> SetupAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(pg.NewDatabase()).Options);
        await db.Database.MigrateAsync();

        var lloyds = await db.Accounts.SingleAsync(a => a.Name == "Lloyds Current");
        lloyds.Balance = 1000m;
        var aqua = new Account { Name = "Aqua", Type = AccountType.CreditCard, Balance = 500m, Apr = 29.9m, MonthlyPayment = 50m };
        db.Accounts.Add(aqua);
        await db.SaveChangesAsync();
        _food = await TestCategories.IdAsync(db, "Food");

        return new Setup(db, new LedgerService(db, new ExchangeRateService(db), NullLogger<LedgerService>.Instance), lloyds, aqua);
    }

    private int _food;

    private LedgerEntry Expense(decimal amount, int accountId, string description = "Lunch") =>
        new(amount, description, _food, Oct1, TransactionType.Expense, accountId);

    [Fact]
    public async Task ChangingTheAmount_MovesTheBalanceByTheDifference()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var t = (await s.Ledger.RecordAsync(Expense(20m, s.Lloyds.Id))).Transaction!;

        var result = await s.Ledger.UpdateAsync(t.Id, Expense(12.50m, s.Lloyds.Id));

        Assert.Null(result!.Error);
        Assert.Equal(987.50m, s.Lloyds.Balance);
        Assert.Equal(12.50m, result.Transaction!.Amount);
        Assert.Equal(12.50m, result.Transaction.GbpAmount);
    }

    [Fact]
    public async Task ChangingDateCategoryAndDescription_KeepsTheBalance()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var t = (await s.Ledger.RecordAsync(Expense(20m, s.Lloyds.Id))).Transaction!;

        var transport = await TestCategories.IdAsync(s.Db, "Transport");

        var result = await s.Ledger.UpdateAsync(t.Id,
            new LedgerEntry(20m, "Train to Leeds", transport, new DateOnly(2026, 9, 30), TransactionType.Expense, s.Lloyds.Id));

        Assert.Equal(980m, s.Lloyds.Balance);
        Assert.Equal("Train to Leeds", result!.Transaction!.Description);
        Assert.Equal(transport, result.Transaction.CategoryId);
        Assert.Equal(new DateOnly(2026, 9, 30), result.Transaction.Date);
    }

    [Fact]
    public async Task MovingToACard_UndoesTheOldAccountAndChargesTheCard()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var t = (await s.Ledger.RecordAsync(Expense(20m, s.Lloyds.Id))).Transaction!;

        await s.Ledger.UpdateAsync(t.Id, Expense(20m, s.Aqua.Id));

        Assert.Equal(1000m, s.Lloyds.Balance);
        Assert.Equal(520m, s.Aqua.Balance);
    }

    [Fact]
    public async Task TurningAnExpenseIntoARepayment_LowersWhatIsOwed()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var t = (await s.Ledger.RecordAsync(Expense(100m, s.Lloyds.Id, "Aqua payment"))).Transaction!;

        var result = await s.Ledger.UpdateAsync(t.Id, new LedgerEntry(
            100m, "Aqua payment", null, Oct1, TransactionType.Transfer, s.Lloyds.Id, s.Aqua.Id));

        Assert.Null(result!.Error);
        Assert.Equal(900m, s.Lloyds.Balance);
        Assert.Equal(400m, s.Aqua.Balance);
    }

    [Fact]
    public async Task AnInvalidUpdate_ChangesNothing()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var t = (await s.Ledger.RecordAsync(Expense(20m, s.Lloyds.Id))).Transaction!;

        // Paying more than is owed is rejected, after the old effect was undone in memory.
        var result = await s.Ledger.UpdateAsync(t.Id, new LedgerEntry(
            600m, "Too much", null, Oct1, TransactionType.Transfer, s.Lloyds.Id, s.Aqua.Id));

        Assert.Contains("more than", result!.Error);
        await using var fresh = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(s.Db.Database.GetConnectionString()!).Options);
        Assert.Equal(980m, (await fresh.Accounts.SingleAsync(a => a.Id == s.Lloyds.Id)).Balance);
        Assert.Equal(20m, (await fresh.Transactions.SingleAsync(x => x.Id == t.Id)).Amount);
    }

    [Fact]
    public async Task UpdatingAMissingTransaction_IsNull()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        Assert.Null(await s.Ledger.UpdateAsync(999, Expense(1m, s.Lloyds.Id)));
    }

    [Fact]
    public async Task DeletingAnExpense_GivesTheMoneyBack()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var t = (await s.Ledger.RecordAsync(Expense(20m, s.Lloyds.Id))).Transaction!;

        Assert.True(await s.Ledger.DeleteAsync(t.Id));

        Assert.Equal(1000m, s.Lloyds.Balance);
        Assert.False(await s.Db.Transactions.AnyAsync(x => x.Id == t.Id));
    }

    [Fact]
    public async Task DeletingARepayment_PutsTheDebtBack()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var t = (await s.Ledger.RecordAsync(new LedgerEntry(
            100m, "Aqua payment", null, Oct1, TransactionType.Transfer, s.Lloyds.Id, s.Aqua.Id))).Transaction!;

        await s.Ledger.DeleteAsync(t.Id);

        Assert.Equal(1000m, s.Lloyds.Balance);
        Assert.Equal(500m, s.Aqua.Balance);
    }

    [Fact]
    public async Task DeletingAMissingTransaction_IsFalse()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        Assert.False(await s.Ledger.DeleteAsync(999));
    }
}
