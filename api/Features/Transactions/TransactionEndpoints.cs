using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Transactions;

public record CreateTransactionRequest(
    decimal Amount, string Description, string Category, DateOnly Date,
    int AccountId, TransactionType Type = TransactionType.Expense, int? ToAccountId = null);

public record CorrectTransactionRequest(int AccountId, TransactionType Type, int? ToAccountId = null);

public record TransactionDto(
    int Id, decimal Amount, string Description, string Category, DateOnly Date, TransactionType Type,
    int AccountId, string AccountName, int? ToAccountId, string? ToAccountName, DateTime CreatedAt)
{
    // For a transaction whose Account (and ToAccount) are loaded.
    public static TransactionDto From(Transaction t) => new(
        t.Id, t.Amount, t.Description, t.Category, t.Date, t.Type,
        t.AccountId, t.Account.Name, t.ToAccountId, t.ToAccount?.Name, t.CreatedAt);
}

public static class TransactionEndpoints
{
    public static RouteGroupBuilder MapTransactionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/transactions").WithTags("Transactions");

        group.MapGet("/", async (AppDbContext db) =>
            (await db.Transactions
                .Include(t => t.Account)
                .Include(t => t.ToAccount)
                .OrderByDescending(t => t.Date)
                .ThenByDescending(t => t.Id)
                .ToListAsync())
            .Select(TransactionDto.From));

        group.MapGet("/{id:int}", async (int id, AppDbContext db) =>
            await db.Transactions
                .Include(t => t.Account)
                .Include(t => t.ToAccount)
                .FirstOrDefaultAsync(t => t.Id == id) is { } t
                ? Results.Ok(TransactionDto.From(t))
                : Results.NotFound());

        group.MapPost("/", async (CreateTransactionRequest req, LedgerService ledger) =>
        {
            var result = await ledger.RecordAsync(new LedgerEntry(
                req.Amount, req.Description, req.Category, req.Date, req.Type, req.AccountId, req.ToAccountId));

            return result.Transaction is { } t
                ? Results.Created($"/transactions/{t.Id}", TransactionDto.From(t))
                : Results.BadRequest(new { error = result.Error });
        });

        // Move a transaction to the right account or type; the balances follow.
        group.MapPatch("/{id:int}", async (int id, CorrectTransactionRequest req, LedgerService ledger) =>
        {
            var result = await ledger.CorrectAsync(id, req.Type, req.AccountId, req.ToAccountId);

            if (result is null) return Results.NotFound();
            return result.Transaction is { } t
                ? Results.Ok(TransactionDto.From(t))
                : Results.BadRequest(new { error = result.Error });
        });

        return group;
    }
}
