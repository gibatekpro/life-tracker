using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Accounts;

public record SaveAccountRequest(
    string Name, AccountType Type, decimal Balance,
    decimal Apr = 0, decimal MinimumPayment = 0, decimal MonthlyPayment = 0, decimal? CreditLimit = null);

public record AddAliasRequest(string Alias);

public record AccountPaymentDto(int Id, decimal Amount, DateOnly Date, int FromAccountId, string FromAccountName);

public static class AccountEndpoints
{
    public static RouteGroupBuilder MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/accounts").WithTags("Accounts");

        group.MapGet("/", async (AppDbContext db) =>
            await db.Accounts
                .Include(a => a.Aliases)
                .OrderBy(a => a.Type == AccountType.Current ? 0 : 1)
                .ThenBy(a => a.Name)
                .ToListAsync());

        group.MapGet("/{id:int}", async (int id, AppDbContext db) =>
            await db.Accounts.Include(a => a.Aliases).FirstOrDefaultAsync(a => a.Id == id) is { } a
                ? Results.Ok(a)
                : Results.NotFound());

        group.MapPost("/", async (SaveAccountRequest req, AppDbContext db) =>
        {
            if (Validate(req) is { } error) return Results.BadRequest(new { error });

            var account = new Account();
            Copy(req, account);
            db.Accounts.Add(account);
            await db.SaveChangesAsync();
            return Results.Created($"/accounts/{account.Id}", account);
        });

        group.MapPut("/{id:int}", async (int id, SaveAccountRequest req, AppDbContext db) =>
        {
            var account = await db.Accounts.FindAsync(id);
            if (account is null) return Results.NotFound();
            if (Validate(req) is { } error) return Results.BadRequest(new { error });

            // Switching between holding money and owing it would make past balance changes wrong.
            if (req.Type != account.Type && await HasTransactionsAsync(db, id))
                return Results.Conflict(new { error = "An account's type can't change once it has transactions." });

            Copy(req, account);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        group.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
        {
            var account = await db.Accounts.FindAsync(id);
            if (account is null) return Results.NotFound();

            if (await HasTransactionsAsync(db, id))
                return Results.Conflict(new { error = "Move or delete this account's transactions first." });

            db.Accounts.Remove(account);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        group.MapPost("/{id:int}/aliases", async (int id, AddAliasRequest req, AppDbContext db) =>
        {
            if (await db.Accounts.FindAsync(id) is null) return Results.NotFound();

            var alias = req.Alias?.Trim() ?? "";
            var normalised = AccountResolver.Normalise(alias);
            if (normalised.Length == 0 || alias.Length > 100)
                return Results.BadRequest(new { error = "An alias needs a letter or digit, and at most 100 characters." });

            // "Lloyd's" and "LLOYDS" match the same card, so they can't belong to two accounts.
            var existing = await db.AccountAliases.ToListAsync();
            if (existing.Any(x => AccountResolver.Normalise(x.Alias) == normalised))
                return Results.Conflict(new { error = $"An alias matching '{alias}' already exists." });

            var created = new AccountAlias { AccountId = id, Alias = alias };
            db.AccountAliases.Add(created);
            await db.SaveChangesAsync();
            return Results.Created($"/accounts/{id}/aliases/{created.Id}", created);
        });

        group.MapDelete("/{id:int}/aliases/{aliasId:int}", async (int id, int aliasId, AppDbContext db) =>
        {
            var alias = await db.AccountAliases.FirstOrDefaultAsync(x => x.Id == aliasId && x.AccountId == id);
            if (alias is null) return Results.NotFound();

            db.AccountAliases.Remove(alias);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Payment history: the transfers that paid into this account.
        group.MapGet("/{id:int}/payments", async (int id, AppDbContext db) =>
            await db.Transactions
                .Where(t => t.Type == TransactionType.Transfer && t.ToAccountId == id)
                .OrderByDescending(t => t.Date)
                .ThenByDescending(t => t.Id)
                .Select(t => new AccountPaymentDto(t.Id, t.Amount, t.Date, t.AccountId, t.Account.Name))
                .ToListAsync());

        return group;
    }

    private static string? Validate(SaveAccountRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Length > 100)
            return "Name is required, at most 100 characters.";
        if (req.Apr < 0 || req.MinimumPayment < 0 || req.MonthlyPayment < 0)
            return "APR and payments can't be negative.";
        if (req.Type != AccountType.Current && req.Balance < 0)
            return "The amount owed can't be negative.";
        if (req.Type != AccountType.Current && req.MonthlyPayment <= 0)
            return "A card or loan needs a monthly payment above zero.";
        if (req.CreditLimit is not null && (req.Type != AccountType.CreditCard || req.CreditLimit < 0))
            return "Only a credit card has a credit limit, and it can't be negative.";
        return null;
    }

    private static void Copy(SaveAccountRequest req, Account account)
    {
        account.Name = req.Name.Trim();
        account.Type = req.Type;
        account.Balance = req.Balance;
        account.Apr = req.Apr;
        account.MinimumPayment = req.MinimumPayment;
        account.MonthlyPayment = req.MonthlyPayment;
        account.CreditLimit = req.CreditLimit;
    }

    private static Task<bool> HasTransactionsAsync(AppDbContext db, int id) =>
        db.Transactions.AnyAsync(t => t.AccountId == id || t.ToAccountId == id);
}
