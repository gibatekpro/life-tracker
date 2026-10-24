using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Features.Categories;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Transactions;

// A transaction from the dashboard form, new or edited (an edit sends the whole thing again). Type defaults to Expense because that's what
// I'm logging most of the time; ToAccountId is only for transfers.
// ToAmount is what arrived on a transfer between currencies (£10 sent, ₦18,000 received).
// GbpAmount is optional: my own £ value for a naira transaction, instead of the automatic one.
public record CreateTransactionRequest(
    decimal Amount, string Description, int? CategoryId, DateOnly Date,
    int AccountId, TransactionType Type = TransactionType.Expense, int? ToAccountId = null,
    decimal? ToAmount = null, decimal? GbpAmount = null);


// What the API sends back for a transaction: the entity's fields plus the account names and
// currencies, and the category's full path, so the dashboard can show
// "Subscriptions › AI › Claude" or "Lloyds Current -> PalmPay, £10.00 -> ₦18,000.00" without
// looking anything up itself. Category is null for transfers.
public record TransactionDto(
    int Id, decimal Amount, string Currency, decimal GbpAmount, string Description,
    int? CategoryId, string? Category,
    DateOnly Date, TransactionType Type,
    int AccountId, string AccountName, int? ToAccountId, string? ToAccountName,
    decimal? ToAmount, string? ToCurrency, DateTime CreatedAt)
{
    // For a transaction whose Account (and ToAccount) are loaded; paths from CategoryPathsAsync.
    public static TransactionDto From(Transaction t, IReadOnlyDictionary<int, string> categoryPaths) => new(
        t.Id, t.Amount, t.Account.Currency, t.GbpAmount, t.Description,
        t.CategoryId, t.CategoryId is { } c ? categoryPaths.GetValueOrDefault(c) : null,
        t.Date, t.Type,
        t.AccountId, t.Account.Name, t.ToAccountId, t.ToAccount?.Name,
        t.ToAmount, t.ToAccount?.Currency, t.CreatedAt);
}

// Every movement of money: what I spend, what comes in, and what I move between my own
// accounts (like paying off a card). Saving goes through LedgerService, which keeps the
// account balances in step and logs every change, so these endpoints stay thin.
public static class TransactionEndpoints
{
    public static RouteGroupBuilder MapTransactionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/transactions").WithTags("Transactions");

        var logger = app.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger("LifeTracker.Api.Features.Transactions");

        // Newest first, for the list on the dashboard.
        group.MapGet("/", async (AppDbContext db) =>
        {
            var paths = await db.CategoryPathsAsync();
            return (await db.Transactions
                    .Include(t => t.Account)
                    .Include(t => t.ToAccount)
                    .OrderByDescending(t => t.Date)
                    .ThenByDescending(t => t.Id)
                    .ToListAsync())
                .Select(t => TransactionDto.From(t, paths));
        });

        group.MapGet("/{id:int}", async (int id, AppDbContext db) =>
            await db.Transactions
                .Include(t => t.Account)
                .Include(t => t.ToAccount)
                .FirstOrDefaultAsync(t => t.Id == id) is { } t
                ? Results.Ok(TransactionDto.From(t, await db.CategoryPathsAsync()))
                : Results.NotFound());

        // Recording a transaction from the dashboard (the form, or the Pay button on a debt).
        group.MapPost("/", async (CreateTransactionRequest req, LedgerService ledger, AppDbContext db) =>
        {
            var result = await ledger.RecordAsync(ToEntry(req));

            return result.Transaction is { } t
                ? Results.Created($"/transactions/{t.Id}", TransactionDto.From(t, await db.CategoryPathsAsync()))
                : Results.BadRequest(new { error = result.Error });
        });

        // Editing a transaction: the whole thing is sent again, and the balances follow the change.
        // Used for fixing mistakes, e.g. a purchase logged against Lloyds that was really on a card.
        group.MapPut("/{id:int}", async (int id, CreateTransactionRequest req, LedgerService ledger, AppDbContext db) =>
        {
            var result = await ledger.UpdateAsync(id, ToEntry(req));

            if (result is null)
            {
                logger.LogWarning("Couldn't update transaction {TransactionId}: it doesn't exist", id);
                return Results.NotFound();
            }

            return result.Transaction is { } t
                ? Results.Ok(TransactionDto.From(t, await db.CategoryPathsAsync()))
                : Results.BadRequest(new { error = result.Error });
        });

        // Deleting a transaction undoes its effect on the balances.
        group.MapDelete("/{id:int}", async (int id, LedgerService ledger) =>
        {
            if (await ledger.DeleteAsync(id)) return Results.NoContent();

            logger.LogWarning("Couldn't delete transaction {TransactionId}: it doesn't exist", id);
            return Results.NotFound();
        });

        return group;
    }

    private static LedgerEntry ToEntry(CreateTransactionRequest req) => new(
        req.Amount, req.Description, req.CategoryId, req.Date, req.Type, req.AccountId, req.ToAccountId,
        req.ToAmount, req.GbpAmount);
}
