using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace LifeTracker.Api.Tests;

// The ledger's category rules against real Postgres.
[Trait("Category", "Integration")]
public class LedgerCategoryTests(PostgresFixture pg) : IClassFixture<PostgresFixture>
{
    private static readonly DateOnly Oct1 = new(2026, 10, 1);

    private sealed record Setup(AppDbContext Db, LedgerService Ledger, int Lloyds, int Revolut, int Food, int Salary);

    private async Task<Setup> SetupAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(pg.NewDatabase()).Options);
        await db.Database.MigrateAsync();
        var ledger = new LedgerService(db, new ExchangeRateService(db), NullLogger<LedgerService>.Instance);
        return new Setup(db, ledger,
            (await db.Accounts.SingleAsync(a => a.Name == "Lloyds Current")).Id,
            (await db.Accounts.SingleAsync(a => a.Name == "Revolut")).Id,
            await TestCategories.IdAsync(db, "Food"),
            await TestCategories.IdAsync(db, "Salary", CategoryKind.Income));
    }

    private static LedgerEntry Expense(Setup s, int? category) =>
        new(10m, "Lunch", category, Oct1, TransactionType.Expense, s.Lloyds);

    [Fact]
    public async Task Expense_NeedsACategory()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        Assert.Contains("Choose a category", (await s.Ledger.RecordAsync(Expense(s, null))).Error);
    }

    [Fact]
    public async Task Expense_CantUseAnIncomeCategory()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        Assert.Contains("income category", (await s.Ledger.RecordAsync(Expense(s, s.Salary))).Error);
    }

    [Fact]
    public async Task Transfer_HasNoCategory()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        var result = await s.Ledger.RecordAsync(new LedgerEntry(10m, "Move", s.Food, Oct1, TransactionType.Transfer, s.Lloyds, s.Revolut));

        Assert.Contains("no category", result.Error);
    }

    [Fact]
    public async Task ArchivedCategory_CantBeUsedForNewTransactions_ButAnEditCanKeepIt()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var lunch = (await s.Ledger.RecordAsync(Expense(s, s.Food))).Transaction!;
        var food = await s.Db.Categories.FindAsync(s.Food);
        food!.IsArchived = true;
        await s.Db.SaveChangesAsync();

        var newOne = await s.Ledger.RecordAsync(Expense(s, s.Food));
        var edit = await s.Ledger.UpdateAsync(lunch.Id, new LedgerEntry(12m, "Lunch", s.Food, Oct1, TransactionType.Expense, s.Lloyds));

        Assert.Contains("archived", newOne.Error);
        Assert.Null(edit!.Error);
        Assert.Equal(12m, edit.Transaction!.Amount);
    }
}
