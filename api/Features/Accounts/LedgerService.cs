using LifeTracker.Api.Data;
using LifeTracker.Api.Models;

namespace LifeTracker.Api.Features.Accounts;

// What a caller wants to record. ToAccountId is only for transfers.
public record LedgerEntry(
    decimal Amount, string Description, string Category, DateOnly Date,
    TransactionType Type, int AccountId, int? ToAccountId = null);

// Either the saved transaction, or a message explaining why it wasn't saved.
// Bad input is an everyday thing here, not an exceptional one, so it's a return value, not an exception.
public record LedgerResult(Transaction? Transaction, string? Error)
{
    public static LedgerResult Ok(Transaction t) => new(t, null);
    public static LedgerResult Fail(string error) => new(null, error);
}

// The one place money moves. Every transaction (typed into the dashboard, captured from
// Apple Pay, or a card repayment) comes through here, so the balance rules are applied the
// same way every time. The transaction and the balance changes are saved in the same
// SaveChangesAsync: they all save, or none of them do.
public class LedgerService(AppDbContext db, ILogger<LedgerService> logger)
{
    public async Task<LedgerResult> RecordAsync(LedgerEntry entry)
    {
        if (entry.Amount <= 0)
            return Reject(entry.Type, entry.Amount, "Amount must be above zero.");

        var (account, toAccount, error) = await LoadAsync(entry.Type, entry.AccountId, entry.ToAccountId, entry.Amount);
        if (error is not null) return Reject(entry.Type, entry.Amount, error);

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

        LogBalances("Recorded", t, account!, toAccount);
        return LedgerResult.Ok(t);
    }

    // Fixes a transaction that was put in the wrong place, e.g. a purchase logged against
    // Lloyds that was really on the Aqua card. The old effect on the balances is undone first,
    // then the new one is applied, so the balances end up as if it had been right from the start.
    // Returns null if the transaction doesn't exist.
    public async Task<LedgerResult?> CorrectAsync(int id, TransactionType type, int accountId, int? toAccountId)
    {
        var t = await db.Transactions.FindAsync(id);
        if (t is null) return null;

        var oldAccount = (await db.Accounts.FindAsync(t.AccountId))!;
        var oldTo = t.ToAccountId is { } oldToId ? await db.Accounts.FindAsync(oldToId) : null;
        var before = Describe(t.Type, oldAccount, oldTo);
        Apply(t.Type, -t.Amount, oldAccount, oldTo);

        // Checked after the undo, so "more than is owed" sees the balance without this payment in it.
        var (account, toAccount, error) = await LoadAsync(type, accountId, toAccountId, t.Amount);
        if (error is not null)
            return Reject(type, t.Amount, error);   // nothing is saved, so the undo above is thrown away

        Apply(type, t.Amount, account!, toAccount);
        t.Type = type;
        t.Account = account!;
        t.ToAccount = toAccount;
        t.ToAccountId = toAccount?.Id;
        await db.SaveChangesAsync();

        logger.LogInformation("Corrected transaction {TransactionId}: {Before} -> {After}",
            t.Id, before, Describe(t.Type, account!, toAccount));
        LogBalances("Corrected", t, account!, toAccount);
        return LedgerResult.Ok(t);
    }

    // Finds the accounts involved and checks the entry makes sense for them.
    // Returns the accounts, or a reason it can't go ahead.
    private async Task<(Account? Account, Account? ToAccount, string? Error)> LoadAsync(
        TransactionType type, int accountId, int? toAccountId, decimal amount)
    {
        var account = await db.Accounts.FindAsync(accountId);
        if (account is null) return (null, null, $"Account {accountId} doesn't exist.");

        // Expenses and income only involve one account.
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

        // Paying off more than I owe is almost always a typo (£1000 instead of £100).
        if (toAccount.Type != AccountType.Current && amount > toAccount.Balance)
            return (null, null, $"That's more than the £{toAccount.Balance:0.00} owed on {toAccount.Name}.");

        return (account, toAccount, null);
    }

    // Asks BalanceRules what should change, then changes it on the tracked entities.
    // Nothing touches the database until SaveChangesAsync.
    private static void Apply(TransactionType type, decimal amount, Account account, Account? toAccount)
    {
        var changes = BalanceRules.For(type, amount,
            new AccountRef(account.Id, account.Type),
            toAccount is null ? null : new AccountRef(toAccount.Id, toAccount.Type));

        foreach (var c in changes)
            (c.AccountId == account.Id ? account : toAccount!).Balance += c.Delta;
    }

    private LedgerResult Reject(TransactionType type, decimal amount, string reason)
    {
        logger.LogWarning("Rejected {Type} of £{Amount}: {Reason}", type, amount, reason);
        return LedgerResult.Fail(reason);
    }

    // After each change, log where the money went and what the balances are now.
    // If a balance ever looks wrong, these lines show which transaction moved it.
    private void LogBalances(string action, Transaction t, Account account, Account? toAccount)
    {
        if (toAccount is null)
            logger.LogInformation("{Action} {Type} {TransactionId} of £{Amount} on {Account}; balance now £{Balance}",
                action, t.Type, t.Id, t.Amount, account.Name, account.Balance);
        else
            logger.LogInformation(
                "{Action} {Type} {TransactionId} of £{Amount} from {From} to {To}; balances now £{FromBalance} and £{ToBalance}",
                action, t.Type, t.Id, t.Amount, account.Name, toAccount.Name, account.Balance, toAccount.Balance);
    }

    private static string Describe(TransactionType type, Account account, Account? toAccount) =>
        toAccount is null ? $"{type} on {account.Name}" : $"{type} {account.Name} -> {toAccount.Name}";
}
