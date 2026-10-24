using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Categories;

// One category for the Settings page and the pickers. Path and Depth save the web from walking
// the tree; TransactionCount and ChildCount tell it whether delete is possible or archive is needed.
public record CategoryDto(
    int Id, string Name, CategoryKind Kind, int? ParentId, string Path, int Depth, int SortOrder,
    bool IsArchived, decimal? DefaultMonthlyAmount, int TransactionCount, int ChildCount);

// My categories: the tree that spending and income are filed under, and the default monthly
// budget of each spending one. The rules live in CategoryService; these endpoints only translate.
public static class CategoryEndpoints
{
    public static RouteGroupBuilder MapCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/categories").WithTags("Categories");

        // Every category (archived ones too; the web hides them where they don't belong),
        // in tree order: each parent followed by its subcategories.
        group.MapGet("/", async (AppDbContext db) =>
        {
            var all = await db.Categories
                .Select(c => new
                {
                    c.Id, c.Name, c.Kind, c.ParentId, c.SortOrder, c.IsArchived, c.DefaultMonthlyAmount,
                    Transactions = db.Transactions.Count(t => t.CategoryId == c.Id),
                    Children = db.Categories.Count(x => x.ParentId == c.Id),
                })
                .ToListAsync();

            var paths = CategoryTree.Paths(all.Select(c => new CategoryNode(c.Id, c.ParentId, c.Name)));
            var byParent = all.ToLookup(c => c.ParentId);
            var ordered = new List<CategoryDto>();

            void Add(int? parentId, int depth)
            {
                foreach (var c in byParent[parentId].OrderBy(c => c.Kind).ThenBy(c => c.SortOrder).ThenBy(c => c.Name))
                {
                    ordered.Add(new CategoryDto(c.Id, c.Name, c.Kind, c.ParentId, paths[c.Id], depth, c.SortOrder,
                        c.IsArchived, c.DefaultMonthlyAmount, c.Transactions, c.Children));
                    if (depth < 20) Add(c.Id, depth + 1);
                }
            }

            Add(null, 0);
            return ordered;
        });

        group.MapPost("/", async (SaveCategory req, CategoryService categories) =>
            ToResult(await categories.CreateAsync(req), created: true));

        group.MapPut("/{id:int}", async (int id, SaveCategory req, CategoryService categories) =>
            ToResult(await categories.UpdateAsync(id, req)));

        group.MapPost("/{id:int}/archive", async (int id, CategoryService categories) =>
            ToResult(await categories.ArchiveAsync(id)));

        group.MapPost("/{id:int}/unarchive", async (int id, CategoryService categories) =>
            ToResult(await categories.UnarchiveAsync(id)));

        group.MapDelete("/{id:int}", async (int id, CategoryService categories) =>
        {
            var result = await categories.DeleteAsync(id);
            return result.Problem is null ? Results.NoContent() : ToResult(result);
        });

        return group;
    }

    private static IResult ToResult(CategoryResult result, bool created = false) => result switch
    {
        { Problem: CategoryProblem.NotFound } => Results.NotFound(new { error = result.Error }),
        { Problem: CategoryProblem.Invalid } => Results.BadRequest(new { error = result.Error }),
        { Problem: CategoryProblem.Conflict } => Results.Conflict(new { error = result.Error }),
        { Category: { } c } when created => Results.Created($"/categories/{c.Id}", Summary(c)),
        { Category: { } c } => Results.Ok(Summary(c)),
        _ => Results.Problem(),
    };

    // The saved category, without its navigation properties (which would loop parent <-> children).
    private static object Summary(Category c) =>
        new { c.Id, c.Name, c.Kind, c.ParentId, c.SortOrder, c.IsArchived, c.DefaultMonthlyAmount };
}
