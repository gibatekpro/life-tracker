using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Accounts;

// The same shape is used to create and to update an account. Cards and loans fill in the
// APR and payments; a current account can leave them at zero.
public record SaveAccountRequest(
    string Name, AccountType Type, decimal Balance,
    decimal Apr = 0, decimal MinimumPayment = 0, decimal MonthlyPayment = 0, decimal? CreditLimit = null);

public record AddAliasRequest(string Alias);

// One repayment into a card or loan, and which account the money came from.
public record AccountPaymentDto(int Id, decimal Amount, DateOnly Date, int FromAccountId, string FromAccountName);

// Everything about the accounts themselves: the bank accounts that hold my money, and the
// cards and loans I owe money on. Moving money between them isn't done here; that's a
// transaction, and it goes through /transactions so the balances stay right.
public static class AccountEndpoints
{
    public static RouteGroupBuilder MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/accounts").WithTags("Accounts");

        // A static class can't be used as ILogger<T>, so the feature gets one named logger,
        // created once at startup and shared by every endpoint below.
        var logger = app.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger("LifeTracker.Api.Features.Accounts");

        // All accounts, current accounts first, so the dashboard can show "what I have" above "what I owe".
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

        // Adding a new account, e.g. a family loan or a new card. The starting balance is
        // whatever the bank (or the person I owe) says today.
        group.MapPost("/", async (SaveAccountRequest req, AppDbContext db) =>
        {
            if (Validate(req) is { } error)
            {
                logger.LogWarning("Rejected new account {Name}: {Reason}", req.Name, error);
                return Results.BadRequest(new { error });
            }

            var account = new Account();
            Copy(req, account);
            db.Accounts.Add(account);
            await db.SaveChangesAsync();

            logger.LogInformation("Created {Type} account {AccountId} ({Name}) with balance £{Balance}",
                account.Type, account.Id, account.Name, account.Balance);
            return Results.Created($"/accounts/{account.Id}", account);
        });

        // Editing an account. This is also how I line a balance up with my banking app:
        // the balance is simply overwritten, it isn't recorded as a transaction.
        group.MapPut("/{id:int}", async (int id, SaveAccountRequest req, AppDbContext db) =>
        {
            var account = await db.Accounts.FindAsync(id);
            if (account is null) return Results.NotFound();

            if (Validate(req) is { } error)
            {
                logger.LogWarning("Rejected update to account {AccountId}: {Reason}", id, error);
                return Results.BadRequest(new { error });
            }

            // A current account's balance means "money held" and a card's means "money owed".
            // Flipping the type after transactions have moved the balance would make that history wrong.
            if (req.Type != account.Type && await HasTransactionsAsync(db, id))
            {
                logger.LogWarning("Rejected changing account {AccountId} from {OldType} to {NewType}: it has transactions",
                    id, account.Type, req.Type);
                return Results.Conflict(new { error = "An account's type can't change once it has transactions." });
            }

            var oldBalance = account.Balance;
            Copy(req, account);
            await db.SaveChangesAsync();

            logger.LogInformation("Updated account {AccountId} ({Name}); balance £{OldBalance} -> £{NewBalance}",
                id, account.Name, oldBalance, account.Balance);
            return Results.NoContent();
        });

        // Only an account with no history can go. Otherwise its transactions would point at nothing.
        group.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
        {
            var account = await db.Accounts.FindAsync(id);
            if (account is null) return Results.NotFound();

            if (await HasTransactionsAsync(db, id))
            {
                logger.LogWarning("Rejected deleting account {AccountId} ({Name}): it has transactions", id, account.Name);
                return Results.Conflict(new { error = "Move or delete this account's transactions first." });
            }

            db.Accounts.Remove(account);
            await db.SaveChangesAsync();

            logger.LogInformation("Deleted account {AccountId} ({Name})", id, account.Name);
            return Results.NoContent();
        });

        // Aliases let Apple Pay find the right account. Wallet calls my card "Lloyd's", but the
        // account is "Lloyds Current", so I add "Lloyd's" as an alias and the capture lands in the right place.
        group.MapPost("/{id:int}/aliases", async (int id, AddAliasRequest req, AppDbContext db) =>
        {
            if (await db.Accounts.FindAsync(id) is null) return Results.NotFound();

            var alias = req.Alias?.Trim() ?? "";
            var normalised = AccountResolver.Normalise(alias);
            if (normalised.Length == 0 || alias.Length > 100)
            {
                logger.LogWarning("Rejected alias {Alias} for account {AccountId}: empty or too long", alias, id);
                return Results.BadRequest(new { error = "An alias needs a letter or digit, and at most 100 characters." });
            }

            // The resolver ignores case and punctuation, so "Lloyd's" and "LLOYDS" are the same card.
            // If they pointed at two different accounts, a capture couldn't know which one to pick.
            var existing = await db.AccountAliases.ToListAsync();
            if (existing.FirstOrDefault(x => AccountResolver.Normalise(x.Alias) == normalised) is { } clash)
            {
                logger.LogWarning("Rejected alias {Alias} for account {AccountId}: it matches {ExistingAlias} on account {OtherAccountId}",
                    alias, id, clash.Alias, clash.AccountId);
                return Results.Conflict(new { error = $"An alias matching '{alias}' already exists." });
            }

            var created = new AccountAlias { AccountId = id, Alias = alias };
            db.AccountAliases.Add(created);
            await db.SaveChangesAsync();

            logger.LogInformation("Added alias {Alias} to account {AccountId}", alias, id);
            return Results.Created($"/accounts/{id}/aliases/{created.Id}", created);
        });

        group.MapDelete("/{id:int}/aliases/{aliasId:int}", async (int id, int aliasId, AppDbContext db) =>
        {
            var alias = await db.AccountAliases.FirstOrDefaultAsync(x => x.Id == aliasId && x.AccountId == id);
            if (alias is null) return Results.NotFound();

            db.AccountAliases.Remove(alias);
            await db.SaveChangesAsync();

            logger.LogInformation("Removed alias {Alias} from account {AccountId}", alias.Alias, id);
            return Results.NoContent();
        });

        // Payment history for a card or loan. There's no separate "payments" table any more:
        // a payment is just a transfer that ended up in this account.
        group.MapGet("/{id:int}/payments", async (int id, AppDbContext db) =>
            await db.Transactions
                .Where(t => t.Type == TransactionType.Transfer && t.ToAccountId == id)
                .OrderByDescending(t => t.Date)
                .ThenByDescending(t => t.Id)
                .Select(t => new AccountPaymentDto(t.Id, t.Amount, t.Date, t.AccountId, t.Account.Name))
                .ToListAsync());

        return group;
    }

    // The rules an account has to follow, whether it's new or being edited.
    // Returns why it's invalid, or null if it's fine.
    private static string? Validate(SaveAccountRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Length > 100)
            return "Name is required, at most 100 characters.";
        if (req.Apr < 0 || req.MinimumPayment < 0 || req.MonthlyPayment < 0)
            return "APR and payments can't be negative.";

        // A current account can dip below zero (an overdraft), but I can't owe a negative amount.
        if (req.Type != AccountType.Current && req.Balance < 0)
            return "The amount owed can't be negative.";

        // The payoff projections divide the debt by this, so a card or loan needs one.
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

    // Has any transaction ever touched this account, as the source or as the destination?
    private static Task<bool> HasTransactionsAsync(AppDbContext db, int id) =>
        db.Transactions.AnyAsync(t => t.AccountId == id || t.ToAccountId == id);
}
