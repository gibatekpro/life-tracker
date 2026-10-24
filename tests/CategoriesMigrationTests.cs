using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LifeTracker.Api.Tests;

// AddCategories against real Postgres: text labels become categories and every transaction is
// linked, and migrating down puts the labels back. All data is made up.
[Trait("Category", "Integration")]
public class CategoriesMigrationTests(PostgresFixture pg) : IClassFixture<PostgresFixture>
{
    private const string BeforeCategories = "20261021235217_AddBudgetPreferences";

    private const string OldShapeData = """
        INSERT INTO "Accounts" ("Name", "Type", "Currency", "Balance", "Apr", "MinimumPayment", "MonthlyPayment", "CreatedAt")
        VALUES ('Card A', 'CreditCard', 'GBP', 500, 20, 10, 50, now());

        INSERT INTO "Transactions" ("Amount", "GbpAmount", "Description", "Category", "Type", "Date", "CreatedAt", "AccountId", "ToAccountId")
        SELECT v.amount, v.amount, v.description, v.category, v.type, DATE '2026-10-01', now(),
               (SELECT "Id" FROM "Accounts" WHERE "Name" = 'Lloyds Current'),
               CASE WHEN v.type = 'Transfer' THEN (SELECT "Id" FROM "Accounts" WHERE "Name" = 'Card A') END
        FROM (VALUES
            (12.50, 'Groceries', 'Food', 'Expense'),
            (30.00, 'Vet', 'Pets', 'Expense'),
            (5.00, 'Mystery', '', 'Expense'),
            (100.00, 'Bonus', 'Bonus', 'Income'),
            (20.00, 'Refund', 'Other', 'Income'),
            (50.00, 'Card payment', 'Debt', 'Transfer')
        ) AS v(amount, description, category, type);
        """;

    private async Task<(AppDbContext Db, IMigrator Migrator)> MigratedAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(pg.NewDatabase()).Options);
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync(BeforeCategories);
        await db.Database.ExecuteSqlRawAsync(OldShapeData);
        await migrator.MigrateAsync();
        return (db, migrator);
    }

    [Fact]
    public async Task StandardCategories_AndEveryLabelInUse_BecomeCategories()
    {
        var (db, _) = await MigratedAsync();
        await using var _db = db;

        var all = await db.Categories.ToListAsync();
        Assert.All(all, c => Assert.Null(c.ParentId));
        Assert.Contains(all, c => c is { Name: "Interest & fees", Kind: CategoryKind.Expense });
        Assert.Contains(all, c => c is { Name: "Salary", Kind: CategoryKind.Income });
        Assert.Contains(all, c => c is { Name: "Pets", Kind: CategoryKind.Expense });   // only used in a transaction
        Assert.Contains(all, c => c is { Name: "Bonus", Kind: CategoryKind.Income });
        Assert.Equal(2, all.Count(c => c.Name == "Other"));                              // one of each kind
        Assert.DoesNotContain(all, c => c.Name is "Debt" or "Transfer" or "");
    }

    [Fact]
    public async Task EveryTransaction_IsLinkedToItsCategory_AndTransfersToNone()
    {
        var (db, _) = await MigratedAsync();
        await using var _db = db;

        var linked = await db.Transactions.Include(t => t.Category)
            .ToDictionaryAsync(t => t.Description, t => t.Category);

        Assert.Equal(("Food", CategoryKind.Expense), (linked["Groceries"]!.Name, linked["Groceries"]!.Kind));
        Assert.Equal("Pets", linked["Vet"]!.Name);
        Assert.Equal(("Other", CategoryKind.Expense), (linked["Mystery"]!.Name, linked["Mystery"]!.Kind));   // was blank
        Assert.Equal(("Bonus", CategoryKind.Income), (linked["Bonus"]!.Name, linked["Bonus"]!.Kind));
        Assert.Equal(("Other", CategoryKind.Income), (linked["Refund"]!.Name, linked["Refund"]!.Kind));
        Assert.Null(linked["Card payment"]);
    }

    [Fact]
    public async Task TheTextColumnIsGone_AndTheRulesAreEnforced()
    {
        var (db, _) = await MigratedAsync();
        await using var _db = db;

        var column = await db.Database.SqlQueryRaw<int>("""
            SELECT count(*)::int AS "Value" FROM information_schema.columns
            WHERE table_name = 'Transactions' AND column_name = 'Category'
            """).SingleAsync();
        Assert.Equal(0, column);

        // An expense without a category breaks the check constraint.
        var ex = await Assert.ThrowsAnyAsync<Exception>(() => db.Database.ExecuteSqlRawAsync("""
            UPDATE "Transactions" SET "CategoryId" = NULL WHERE "Description" = 'Groceries'
            """));
        Assert.Contains("CK_Transactions_CategoryUnlessTransfer", ex.Message);
    }

    [Fact]
    public async Task MigratingDown_PutsTheLabelsBack()
    {
        var (db, migrator) = await MigratedAsync();
        await using var _db = db;

        await migrator.MigrateAsync(BeforeCategories);

        var labels = await db.Database.SqlQueryRaw<LabelRow>("""
            SELECT "Description", "Category" FROM "Transactions"
            """).ToDictionaryAsync(r => r.Description, r => r.Category);
        Assert.Equal("Food", labels["Groceries"]);
        Assert.Equal("Pets", labels["Vet"]);
        Assert.Equal("Other", labels["Mystery"]);
        Assert.Equal("Bonus", labels["Bonus"]);
        Assert.Equal("Debt", labels["Card payment"]);
    }

    private record LabelRow(string Description, string Category);
}
