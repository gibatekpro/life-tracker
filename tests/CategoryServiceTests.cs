using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Features.Categories;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace LifeTracker.Api.Tests;

// Managing categories against real Postgres: the tree rules and archive-instead-of-delete.
[Trait("Category", "Integration")]
public class CategoryServiceTests(PostgresFixture pg) : IClassFixture<PostgresFixture>
{
    private sealed record Setup(AppDbContext Db, CategoryService Categories);

    private async Task<Setup> SetupAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(pg.NewDatabase()).Options);
        await db.Database.MigrateAsync();
        return new Setup(db, new CategoryService(db, NullLogger<CategoryService>.Instance));
    }

    private static SaveCategory Expense(string name, int? parent = null, decimal? amount = null) =>
        new(name, CategoryKind.Expense, parent, amount);

    // Subscriptions > AI > Claude
    private static async Task<(int Subs, int Ai, int Claude)> SubscriptionsAsync(Setup s)
    {
        var subs = (await s.Categories.CreateAsync(Expense("Subscriptions"))).Category!.Id;
        var ai = (await s.Categories.CreateAsync(Expense("AI", subs))).Category!.Id;
        var claude = (await s.Categories.CreateAsync(Expense("Claude", ai, 18m))).Category!.Id;
        return (subs, ai, claude);
    }

    [Fact]
    public async Task Create_BuildsATreeOfAnyDepth()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        var (subs, ai, claude) = await SubscriptionsAsync(s);

        var c = await s.Db.Categories.FindAsync(claude);
        Assert.Equal(ai, c!.ParentId);
        Assert.Equal(18m, c.DefaultMonthlyAmount);
        Assert.Equal(subs, (await s.Db.Categories.FindAsync(ai))!.ParentId);
    }

    [Fact]
    public async Task Subcategory_TakesItsParentsKind()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var salary = await TestCategories.IdAsync(s.Db, "Salary", CategoryKind.Income);

        var bonus = await s.Categories.CreateAsync(new SaveCategory("Bonus", CategoryKind.Expense, salary, null));

        Assert.Equal(CategoryKind.Income, bonus.Category!.Kind);
    }

    [Fact]
    public async Task DuplicateSiblingName_IsAConflict_ButTheSameNameElsewhereIsFine()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var (subs, _, _) = await SubscriptionsAsync(s);

        var topLevelFood = await s.Categories.CreateAsync(Expense("food"));
        var foodUnderSubs = await s.Categories.CreateAsync(Expense("Food", subs));
        var otherIncome = await s.Categories.CreateAsync(new SaveCategory("Other", CategoryKind.Income, null, null));

        Assert.Equal(CategoryProblem.Conflict, topLevelFood.Problem);   // "Food" exists, case doesn't matter
        Assert.Null(foodUnderSubs.Problem);
        Assert.Equal(CategoryProblem.Conflict, otherIncome.Problem);    // the migration made income "Other"
    }

    [Fact]
    public async Task IncomeCategories_HaveNoBudget()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        var result = await s.Categories.CreateAsync(new SaveCategory("Tips", CategoryKind.Income, null, 50m));

        Assert.Equal(CategoryProblem.Invalid, result.Problem);
    }

    [Fact]
    public async Task Move_CantGoUnderItselfOrItsOwnSubcategory()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var (subs, ai, claude) = await SubscriptionsAsync(s);

        var underChild = await s.Categories.UpdateAsync(subs, Expense("Subscriptions", claude));
        var underSelf = await s.Categories.UpdateAsync(ai, Expense("AI", ai));
        var toTop = await s.Categories.UpdateAsync(claude, Expense("Claude", null, 18m));

        Assert.Equal(CategoryProblem.Invalid, underChild.Problem);
        Assert.Equal(CategoryProblem.Invalid, underSelf.Problem);
        Assert.Null(toTop.Category!.ParentId);
    }

    [Fact]
    public async Task KindCantChange_OnceItHasTransactions()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var food = await TestCategories.IdAsync(s.Db, "Food");
        var lloyds = (await s.Db.Accounts.SingleAsync(a => a.Name == "Lloyds Current")).Id;
        var ledger = new LedgerService(s.Db, new ExchangeRateService(s.Db), NullLogger<LedgerService>.Instance);
        await ledger.RecordAsync(new LedgerEntry(5m, "Lunch", food, new DateOnly(2026, 10, 1), TransactionType.Expense, lloyds));

        var result = await s.Categories.UpdateAsync(food, new SaveCategory("Food", CategoryKind.Income, null, null));

        Assert.Equal(CategoryProblem.Conflict, result.Problem);
    }

    [Fact]
    public async Task Delete_IsRefusedWithTransactionsOrSubcategories_ButWorksWhenUnused()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var (subs, _, claude) = await SubscriptionsAsync(s);
        var food = await TestCategories.IdAsync(s.Db, "Food");
        var lloyds = (await s.Db.Accounts.SingleAsync(a => a.Name == "Lloyds Current")).Id;
        var ledger = new LedgerService(s.Db, new ExchangeRateService(s.Db), NullLogger<LedgerService>.Instance);
        await ledger.RecordAsync(new LedgerEntry(5m, "Lunch", food, new DateOnly(2026, 10, 1), TransactionType.Expense, lloyds));

        var withTransactions = await s.Categories.DeleteAsync(food);
        var withChildren = await s.Categories.DeleteAsync(subs);
        var unused = await s.Categories.DeleteAsync(claude);

        Assert.Equal(CategoryProblem.Conflict, withTransactions.Problem);
        Assert.Contains("1 transaction", withTransactions.Error);
        Assert.Contains("Archive it instead", withTransactions.Error);
        Assert.Contains("1 subcategory", withChildren.Error);
        Assert.Null(unused.Problem);
        Assert.Null(await s.Db.Categories.FindAsync(claude));
    }

    [Fact]
    public async Task Archive_TakesTheWholeBranch_AndUnarchive_BringsBackTheParents()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var (subs, ai, claude) = await SubscriptionsAsync(s);

        await s.Categories.ArchiveAsync(ai);
        var afterArchive = await s.Db.Categories.Where(c => c.Id == subs || c.Id == ai || c.Id == claude)
            .ToDictionaryAsync(c => c.Id, c => c.IsArchived);

        await s.Categories.ArchiveAsync(subs);
        await s.Categories.UnarchiveAsync(claude);
        var afterUnarchive = await s.Db.Categories.Where(c => c.Id == subs || c.Id == ai || c.Id == claude)
            .ToDictionaryAsync(c => c.Id, c => c.IsArchived);

        Assert.Equal((false, true, true), (afterArchive[subs], afterArchive[ai], afterArchive[claude]));
        Assert.Equal((false, false, false), (afterUnarchive[subs], afterUnarchive[ai], afterUnarchive[claude]));
    }

    [Fact]
    public async Task NothingCanGoUnderAnArchivedCategory()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        var (subs, _, _) = await SubscriptionsAsync(s);
        await s.Categories.ArchiveAsync(subs);

        var result = await s.Categories.CreateAsync(Expense("Music", subs));

        Assert.Equal(CategoryProblem.Invalid, result.Problem);
    }
}
