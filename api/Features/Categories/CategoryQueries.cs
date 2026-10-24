using LifeTracker.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Categories;

public static class CategoryQueries
{
    // Every category's path, e.g. 5 -> "Subscriptions › AI › Claude". There are only ever a few dozen
    // categories, so loading them all once is cheaper and simpler than walking parents per transaction.
    public static async Task<Dictionary<int, string>> CategoryPathsAsync(this AppDbContext db) =>
        CategoryTree.Paths(await db.Categories.Select(c => new CategoryNode(c.Id, c.ParentId, c.Name)).ToListAsync());
}
