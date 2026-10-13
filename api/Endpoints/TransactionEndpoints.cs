using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Endpoints;

public static class TransactionEndpoints
{
    public static RouteGroupBuilder MapTransactionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/transactions").WithTags("Transactions");

        group.MapGet("/", async (AppDbContext db) =>
            await db.Transactions.OrderByDescending(t => t.Date).ToListAsync());

        group.MapGet("/{id:int}", async (int id, AppDbContext db) =>
            await db.Transactions.FindAsync(id) is { } t
                ? Results.Ok(t)
                : Results.NotFound());

        group.MapPost("/", async (CreateTransactionRequest req, AppDbContext db) =>
        {
            var t = new Transaction
            {
                Amount = req.Amount,
                Description = req.Description,
                Category = req.Category,
                Date = req.Date
            };
            db.Transactions.Add(t);
            await db.SaveChangesAsync();
            return Results.Created($"/transactions/{t.Id}", t);
        });

        return group;
    }
}

public record CreateTransactionRequest(decimal Amount, string Description, string Category, DateOnly Date);