using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Categories;

// What the caller wants a category to be. A subcategory always takes its parent's kind.
// IsEssential is its own setting; a subcategory of an essential one counts as essential anyway.
public record SaveCategory(string Name, CategoryKind Kind, int? ParentId, decimal? DefaultMonthlyAmount, int? SortOrder = null,
    bool IsEssential = false);

public enum CategoryProblem { NotFound, Invalid, Conflict }

// Either the category, or what went wrong and how (the endpoint turns Problem into 404/400/409).
public record CategoryResult(Category? Category, CategoryProblem? Problem = null, string? Error = null)
{
    public static CategoryResult Fail(CategoryProblem problem, string error) => new(null, problem, error);
}

// The rules for managing my categories, in one place: names unique among siblings, a subcategory
// shares its parent's kind, nothing moves under itself, and anything with history is archived
// rather than deleted, so old transactions and budgets keep their category.
public class CategoryService(AppDbContext db, ILogger<CategoryService> logger)
{
    public async Task<CategoryResult> CreateAsync(SaveCategory req)
    {
        var (parent, kind, error) = await CheckAsync(req, id: null);
        if (error is not null) return error;

        var siblings = db.Categories.Where(c => c.ParentId == req.ParentId && c.Kind == kind);
        var category = new Category
        {
            Name = req.Name.Trim(),
            Kind = kind,
            ParentId = parent?.Id,
            DefaultMonthlyAmount = req.DefaultMonthlyAmount,
            IsEssential = req.IsEssential,
            // New ones go at the end of their siblings unless told otherwise.
            SortOrder = req.SortOrder ?? ((await siblings.MaxAsync(c => (int?)c.SortOrder)) ?? -10) + 10,
        };
        db.Categories.Add(category);
        await db.SaveChangesAsync();

        logger.LogInformation("Created {Kind} category {CategoryId} ({Name}) under {ParentId}, default {Default}, essential {Essential}",
            category.Kind, category.Id, category.Name, category.ParentId, category.DefaultMonthlyAmount, category.IsEssential);
        return new CategoryResult(category);
    }

    // Rename, move, change the default amount, order or whether it's essential (and the kind, while nothing uses it).
    public async Task<CategoryResult> UpdateAsync(int id, SaveCategory req)
    {
        var category = await db.Categories.FindAsync(id);
        if (category is null) return CategoryResult.Fail(CategoryProblem.NotFound, $"Category {id} doesn't exist.");

        var (parent, kind, error) = await CheckAsync(req, id);
        if (error is not null) return error;

        // Changing between spending and income would make its transactions the wrong kind.
        if (kind != category.Kind && (await HasTransactionsAsync(id) || await db.Categories.AnyAsync(c => c.ParentId == id)))
            return CategoryResult.Fail(CategoryProblem.Conflict,
                $"{category.Name} has transactions or subcategories, so it can't change between spending and income.");

        var before = $"{category.Name} under {category.ParentId}";
        category.Name = req.Name.Trim();
        category.Kind = kind;
        category.ParentId = parent?.Id;
        category.DefaultMonthlyAmount = req.DefaultMonthlyAmount;
        category.IsEssential = req.IsEssential;
        category.SortOrder = req.SortOrder ?? category.SortOrder;
        await db.SaveChangesAsync();

        logger.LogInformation("Updated category {CategoryId}: {Before} -> {Name} under {ParentId}, default {Default}, essential {Essential}",
            id, before, category.Name, category.ParentId, category.DefaultMonthlyAmount, category.IsEssential);
        return new CategoryResult(category);
    }

    // Hides a category (and everything under it) from pickers and budgets, keeping its history.
    public async Task<CategoryResult> ArchiveAsync(int id) => await SetArchivedAsync(id, true);

    // Brings it back, with everything under it, and the parents above it so it isn't left under a hidden one.
    public async Task<CategoryResult> UnarchiveAsync(int id) => await SetArchivedAsync(id, false);

    // Only a category nothing refers to can go; otherwise it's archived, so history keeps its name.
    public async Task<CategoryResult> DeleteAsync(int id)
    {
        var category = await db.Categories.FindAsync(id);
        if (category is null) return CategoryResult.Fail(CategoryProblem.NotFound, $"Category {id} doesn't exist.");

        var transactions = await db.Transactions.CountAsync(t => t.CategoryId == id);
        var children = await db.Categories.CountAsync(c => c.ParentId == id);
        var budgetMonths = await db.BudgetMonthAmounts.CountAsync(b => b.CategoryId == id);
        if (transactions > 0 || children > 0 || budgetMonths > 0)
        {
            var uses = string.Join(" and ", new[]
            {
                transactions > 0 ? $"{transactions} transaction{(transactions == 1 ? "" : "s")}" : null,
                children > 0 ? $"{children} subcategor{(children == 1 ? "y" : "ies")}" : null,
                budgetMonths > 0 ? $"budgets in {budgetMonths} month{(budgetMonths == 1 ? "" : "s")}" : null,
            }.OfType<string>());
            logger.LogWarning("Refused to delete category {CategoryId} ({Name}): it has {Uses}", id, category.Name, uses);
            return CategoryResult.Fail(CategoryProblem.Conflict, $"{category.Name} has {uses}. Archive it instead to keep its history.");
        }

        db.Categories.Remove(category);
        await db.SaveChangesAsync();
        logger.LogInformation("Deleted category {CategoryId} ({Name})", id, category.Name);
        return new CategoryResult(category);
    }

    // The checks shared by create and update. Returns the parent, the kind the category ends up
    // with (a subcategory always takes its parent's), or what's wrong.
    private async Task<(Category? Parent, CategoryKind Kind, CategoryResult? Error)> CheckAsync(SaveCategory req, int? id)
    {
        var name = req.Name?.Trim() ?? "";
        if (name.Length is 0 or > 100)
            return (null, req.Kind, CategoryResult.Fail(CategoryProblem.Invalid, "A category needs a name of up to 100 characters."));
        if (req.DefaultMonthlyAmount < 0)
            return (null, req.Kind, CategoryResult.Fail(CategoryProblem.Invalid, "The default budget can't be negative."));

        Category? parent = null;
        if (req.ParentId is { } parentId)
        {
            parent = await db.Categories.FindAsync(parentId);
            if (parent is null)
                return (null, req.Kind, CategoryResult.Fail(CategoryProblem.Invalid, $"Category {parentId} doesn't exist."));
            if (parent.IsArchived)
                return (null, req.Kind, CategoryResult.Fail(CategoryProblem.Invalid, $"{parent.Name} is archived; unarchive it first."));

            // Under itself, or under one of its own subcategories, would make a loop.
            if (id is { } self)
            {
                var nodes = await db.Categories.Select(c => new CategoryNode(c.Id, c.ParentId, c.Name)).ToListAsync();
                if (CategoryTree.WithDescendants(self, nodes).Contains(parentId))
                    return (null, req.Kind, CategoryResult.Fail(CategoryProblem.Invalid, "A category can't go under itself or one of its subcategories."));
            }
        }

        var kind = parent?.Kind ?? req.Kind;
        if (kind == CategoryKind.Income && req.DefaultMonthlyAmount is not null)
            return (parent, kind, CategoryResult.Fail(CategoryProblem.Invalid, "Only spending categories have a budget."));
        if (kind == CategoryKind.Income && req.IsEssential)
            return (parent, kind, CategoryResult.Fail(CategoryProblem.Invalid, "Only spending categories can be essential."));

        // The database would refuse a duplicate too; checking first gives a clear message.
        var duplicate = await db.Categories.AnyAsync(c =>
            c.Id != id && c.ParentId == req.ParentId && c.Kind == kind && c.Name.ToLower() == name.ToLower());
        if (duplicate)
            return (parent, kind, CategoryResult.Fail(CategoryProblem.Conflict,
                $"There's already a {kind.ToString().ToLowerInvariant()} category called {name} {(parent is null ? "at the top level" : $"under {parent.Name}")}."));

        return (parent, kind, null);
    }

    private async Task<CategoryResult> SetArchivedAsync(int id, bool archived)
    {
        var all = await db.Categories.ToListAsync();
        var category = all.FirstOrDefault(c => c.Id == id);
        if (category is null) return CategoryResult.Fail(CategoryProblem.NotFound, $"Category {id} doesn't exist.");

        var nodes = all.Select(c => new CategoryNode(c.Id, c.ParentId, c.Name)).ToList();
        var affected = CategoryTree.WithDescendants(id, nodes);
        if (!archived)
            for (var parent = category.ParentId; parent is { } p; parent = all.First(c => c.Id == p).ParentId)
                affected.Add(p);

        foreach (var c in all.Where(c => affected.Contains(c.Id))) c.IsArchived = archived;
        await db.SaveChangesAsync();

        logger.LogInformation("{Action} category {CategoryId} ({Name}) and {Others} more",
            archived ? "Archived" : "Unarchived", id, category.Name, affected.Count - 1);
        return new CategoryResult(category);
    }

    private Task<bool> HasTransactionsAsync(int id) => db.Transactions.AnyAsync(t => t.CategoryId == id);
}
