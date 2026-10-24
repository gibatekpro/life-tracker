using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Tests;

// The AddCategories migration creates the standard categories (Food, Transport, Salary, Other...),
// so every freshly migrated test database has them; tests look them up by name.
public static class TestCategories
{
    public static async Task<int> IdAsync(AppDbContext db, string name, CategoryKind kind = CategoryKind.Expense) =>
        (await db.Categories.SingleAsync(c => c.Name == name && c.Kind == kind && c.ParentId == null)).Id;
}
