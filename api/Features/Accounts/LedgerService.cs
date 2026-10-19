using LifeTracker.Api.Data;
using LifeTracker.Api.Models;

namespace LifeTracker.Api.Features.Accounts;

public record LedgerEntry(
    decimal Amount, string Description, string Category, DateOnly Date,
    TransactionType Type, int AccountId, int? ToAccountId = null);

public record LedgerResult(Transaction? Transaction, string? Error)
{
    public static LedgerResult Ok(Transaction t) => new(t, null);
    public static LedgerResult Fail(string error) => new(null, error);
}

// Every transaction goes through here, so its balance changes are always applied
// in the same SaveChangesAsync: the transaction and the balances save together, or not at all.
public class LedgerService(AppDbContext db)
{
    public async Task<LedgerResult> RecordAsync(LedgerEntry entry)
    {
        if (entry.Amount <= 0)
            return LedgerResult.Fail("Amount must be above zero.");

        var (account, toAccount, error) = await LoadAsync(entry.Type, entry.AccountId, entry.ToAccountId, entry.Amount);
        if (error is not null) return LedgerResult.Fail(error);

        var t = new Transaction
        {
            Amount = entry.Amount,
            Description = entry.Description,
            Category = entry.Category,
            Date = entry.Date,
            Type = entry.Type,
            Account = account!,
            ToAccount = toAccount
        };

        Apply(t.Type, t.Amount, account!, toAccount);
        db.Transactions.Add(t);
        await db.SaveChangesAsync();
        return LedgerResult.Ok(t);
    }

    // Moves an existing transaction to another account or type: undo its old effect, apply the new one.
    // Returns null if the transaction doesn't exist.
    public async Task<LedgerResult?> CorrectAsync(int id, TransactionType type, int accountId, int? toAccountId)
    {
        var t = await db.Transactions.FindAsync(id);
        if (t is null) return null;

        var oldAccount = (await db.Accounts.FindAsync(t.AccountId))!;
        var oldTo = t.ToAccountId is { } oldToId ? await db.Accounts.FindAsync(oldToId) : null;
        Apply(t.Type, -t.Amount, oldAccount, oldTo);

        // Validated after the undo, so "more than is owed" sees the balance without this payment.
        var (account, toAccount, error) = await LoadAsync(type, accountId, toAccountId, t.Amount);
        if (error is not null) return LedgerResult.Fail(error);   // nothing saved, so the undo is discarded

        Apply(type, t.Amount, account!, toAccount);
        t.Type = type;
        t.Account = account!;
        t.ToAccount = toAccount;
        t.ToAccountId = toAccount?.Id;
        await db.SaveChangesAsync();
        return LedgerResult.Ok(t);
    }

    private async Task<(Account? Account, Account? ToAccount, string? Error)> LoadAsync(
        TransactionType type, int accountId, int? toAccountId, decimal amount)
    {
        var account = await db.Accounts.FindAsync(accountId);
        if (account is null) return (null, null, $"Account {accountId} doesn't exist.");

        if (type != TransactionType.Transfer)
        {
            return toAccountId is null
                ? (account, null, null)
                : (null, null, "Only a transfer has a 'to' account.");
        }

        if (toAccountId is null) return (null, null, "A transfer needs a 'to' account.");
        if (toAccountId == accountId) return (null, null, "A transfer needs two different accounts.");

        var toAccount = await db.Accounts.FindAsync(toAccountId);
        if (toAccount is null) return (null, null, $"Account {toAccountId} doesn't exist.");

        if (toAccount.Type != AccountType.Current && amount > toAccount.Balance)
            return (null, null, $"That's more than the £{toAccount.Balance:0.00} owed on {toAccount.Name}.");

        return (account, toAccount, null);
    }

    private static void Apply(TransactionType type, decimal amount, Account account, Account? toAccount)
    {
        var changes = BalanceRules.For(type, amount,
            new AccountRef(account.Id, account.Type),
            toAccount is null ? null : new AccountRef(toAccount.Id, toAccount.Type));

        foreach (var c in changes)
            (c.AccountId == account.Id ? account : toAccount!).Balance += c.Delta;
    }
}
