using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;
using Testcontainers.PostgreSql;

namespace LifeTracker.Api.Tests;

// One throwaway Postgres container for the whole class; each test gets its own database in it.
public class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17").Build();

    public Task InitializeAsync() => _container.StartAsync();

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();

    public string NewDatabase() =>
        new NpgsqlConnectionStringBuilder(_container.GetConnectionString())
        {
            Database = $"test_{Guid.NewGuid():N}"
        }.ConnectionString;
}

[Trait("Category", "Integration")]
public class AccountsMigrationTests(PostgresFixture pg) : IClassFixture<PostgresFixture>
{
    private const string BeforeAccounts = "20261019170716_AddSpendingFlags";

    // Old-shape data, all fake: two debts, a linked payment, an unlinked one (its transaction
    // was deleted), and a transaction that was excluded from spending.
    private const string OldShapeData = """
        INSERT INTO "Debts" ("Name", "Balance", "Apr", "MinimumPayment", "MonthlyPayment", "PaymentsCountAsSpending", "CreatedAt")
        VALUES ('Card A', 1000.00, 24.9, 25, 100, true, now()),
               ('Card B', 500.00, 0, 10, 50, false, now());

        INSERT INTO "Transactions" ("Amount", "Description", "Category", "Date", "CreatedAt", "CountsAsSpending")
        VALUES (12.50, 'Groceries', 'Food', '2026-10-01', now(), true),
               (100.00, 'Payment to Card A', 'Debt', '2026-10-02', now(), true),
               (5.00, 'Excluded thing', 'Other', '2026-10-03', now(), false);

        INSERT INTO "DebtPayments" ("DebtId", "TransactionId", "Amount", "Date", "CreatedAt")
        VALUES ((SELECT "Id" FROM "Debts" WHERE "Name" = 'Card A'),
                (SELECT "Id" FROM "Transactions" WHERE "Description" = 'Payment to Card A'),
                100.00, '2026-10-02', now()),
               ((SELECT "Id" FROM "Debts" WHERE "Name" = 'Card B'), NULL, 50.00, '2026-10-04', now());

        INSERT INTO "Settings" ("Id", "MonthlyIncome", "MonthlyDebtBudget", "UpdatedAt")
        VALUES (1, 2000, 300, now());
        """;

    private static AppDbContext Context(string connectionString) =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options);

    // Builds the old schema, fills it, then runs AccountsAndTransfers.
    // Returns the connection string and the old debt Ids by name.
    private async Task<(string ConnectionString, Dictionary<string, int> DebtIds)> MigrateOldDataAsync()
    {
        var cs = pg.NewDatabase();
        await using var db = Context(cs);
        var migrator = db.GetService<IMigrator>();

        await migrator.MigrateAsync(BeforeAccounts);
        await db.Database.ExecuteSqlRawAsync(OldShapeData);

        var debtIds = await db.Database
            .SqlQueryRaw<DebtRow>("""SELECT "Id", "Name" FROM "Debts" """)
            .ToDictionaryAsync(d => d.Name, d => d.Id);

        await migrator.MigrateAsync();
        return (cs, debtIds);
    }

    private record DebtRow(int Id, string Name);

    [Fact]
    public async Task Debts_BecomeCreditCardAccounts_KeepingIdsAndValues()
    {
        var (cs, debtIds) = await MigrateOldDataAsync();
        await using var db = Context(cs);

        var cardA = await db.Accounts.SingleAsync(a => a.Id == debtIds["Card A"]);
        Assert.Equal("Card A", cardA.Name);
        Assert.Equal(AccountType.CreditCard, cardA.Type);
        Assert.Equal(1000.00m, cardA.Balance);   // not recalculated from the payments
        Assert.Equal(24.9m, cardA.Apr);
        Assert.Equal(100m, cardA.MonthlyPayment);
        Assert.Null(cardA.CreditLimit);

        var cardB = await db.Accounts.SingleAsync(a => a.Id == debtIds["Card B"]);
        Assert.Equal(AccountType.CreditCard, cardB.Type);
        Assert.Equal(500.00m, cardB.Balance);
    }

    [Fact]
    public async Task CurrentAccounts_AreCreated_AndLloydsIsTheDefault()
    {
        var (cs, _) = await MigrateOldDataAsync();
        await using var db = Context(cs);

        var current = await db.Accounts.Where(a => a.Type == AccountType.Current).OrderBy(a => a.Name).ToListAsync();
        Assert.Equal(["Lloyds Current", "Revolut"], current.Select(a => a.Name));
        Assert.All(current, a => Assert.Equal(0m, a.Balance));

        var settings = await db.Settings.SingleAsync();
        Assert.Equal(current[0].Id, settings.DefaultAccountId);
        Assert.Equal(300m, settings.MonthlyDebtBudget);
    }

    [Fact]
    public async Task Transactions_AreLloydsExpenses_AndPaymentsBecomeTransfers()
    {
        var (cs, debtIds) = await MigrateOldDataAsync();
        await using var db = Context(cs);
        var lloydsId = (await db.Accounts.SingleAsync(a => a.Name == "Lloyds Current")).Id;

        var all = await db.Transactions.OrderBy(t => t.Date).ToListAsync();
        Assert.Equal(4, all.Count);
        Assert.All(all, t => Assert.Equal(lloydsId, t.AccountId));

        // Both the counted and the excluded transaction become plain expenses.
        var expenses = all.Where(t => t.Type == TransactionType.Expense).ToList();
        Assert.Equal(["Groceries", "Excluded thing"], expenses.Select(t => t.Description));
        Assert.All(expenses, t => Assert.Null(t.ToAccountId));

        // The linked payment keeps its transaction, now a transfer to the card.
        var linked = all.Single(t => t.Description == "Payment to Card A");
        Assert.Equal(TransactionType.Transfer, linked.Type);
        Assert.Equal(debtIds["Card A"], linked.ToAccountId);
        Assert.Equal(100.00m, linked.Amount);
        Assert.Equal(new DateOnly(2026, 10, 2), linked.Date);

        // The unlinked payment gets a new transfer.
        var created = all.Single(t => t.Description == "Payment to Card B");
        Assert.Equal(TransactionType.Transfer, created.Type);
        Assert.Equal(debtIds["Card B"], created.ToAccountId);
        Assert.Equal(50.00m, created.Amount);
        Assert.Equal(new DateOnly(2026, 10, 4), created.Date);
        Assert.Equal("Debt", created.Category);
    }

    [Fact]
    public async Task OldTableAndFlags_AreGone()
    {
        var (cs, _) = await MigrateOldDataAsync();
        await using var db = Context(cs);

        var leftovers = await db.Database.SqlQueryRaw<string>("""
            SELECT 'table DebtPayments' AS "Value" WHERE to_regclass('"DebtPayments"') IS NOT NULL
            UNION ALL
            SELECT 'column ' || column_name FROM information_schema.columns
            WHERE column_name IN ('CountsAsSpending', 'PaymentsCountAsSpending')
            """).ToListAsync();

        Assert.Empty(leftovers);
    }

    [Fact]
    public async Task MigratedDatabase_RejectsATransferWithoutADestination()
    {
        var (cs, _) = await MigrateOldDataAsync();
        await using var db = Context(cs);
        var lloyds = await db.Accounts.SingleAsync(a => a.Name == "Lloyds Current");

        db.Transactions.Add(new Transaction
        {
            Amount = 10m, Description = "Broken", Category = "Debt", Date = new DateOnly(2026, 10, 5),
            Type = TransactionType.Transfer, Account = lloyds
        });

        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        Assert.Contains("CK_Transactions_TransferHasDestination", ex.InnerException?.Message);
    }

    [Fact]
    public async Task MigratedData_WorksWithTheLedger()
    {
        var (cs, debtIds) = await MigrateOldDataAsync();
        await using var db = Context(cs);
        var lloyds = await db.Accounts.SingleAsync(a => a.Name == "Lloyds Current");

        var result = await new LedgerService(db).RecordAsync(new LedgerEntry(
            30m, "Payment to Card A", "Debt", new DateOnly(2026, 10, 6),
            TransactionType.Transfer, lloyds.Id, debtIds["Card A"]));

        Assert.Null(result.Error);
        await using var fresh = Context(cs);
        Assert.Equal(-30m, (await fresh.Accounts.SingleAsync(a => a.Id == lloyds.Id)).Balance);
        Assert.Equal(970m, (await fresh.Accounts.SingleAsync(a => a.Id == debtIds["Card A"])).Balance);
    }
}
