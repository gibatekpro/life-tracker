using LifeTracker.Api.Data;
using LifeTracker.Api.Models;

namespace LifeTracker.Api.Features.Accounts;

// What a caller wants to record. ToAccountId is only for transfers.
// ToAmount: for a transfer between currencies, what arrived (e.g. ₦18,000 for £10 sent).
// GbpAmount: my own £ value for something in another currency, instead of the automatic one.
public record LedgerEntry(
    decimal Amount, string Description, string Category, DateOnly Date,
    TransactionType Type, int AccountId, int? ToAccountId = null,
    decimal? ToAmount = null, decimal? GbpAmount = null);

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
public class LedgerService(AppDbContext db, ExchangeRateService rates, ILogger<LedgerService> logger)
{
    public async Task<LedgerResult> RecordAsync(LedgerEntry entry)
    {
        if (entry.Amount <= 0)
            return Reject(entry.Type, entry.Amount, "Amount must be above zero.");

        var (account, toAccount, error) = await LoadAsync(
            entry.Type, entry.AccountId, entry.ToAccountId, entry.Amount, entry.ToAmount, entry.GbpAmount);
        if (error is not null) return Reject(entry.Type, entry.Amount, error);

        var (pounds, poundsError) = await PoundsAsync(entry.Amount, entry.Date, account!, toAccount, entry.ToAmount, entry.GbpAmount);
        if (poundsError is not null) return Reject(entry.Type, entry.Amount, poundsError);

        var t = new Transaction
        {
            Amount = entry.Amount,
            GbpAmount = pounds!.Value,
            ToAmount = entry.ToAmount,
            Description = entry.Description,
            Category = entry.Category,
            Date = entry.Date,
            Type = entry.Type,
            Account = account!,
            ToAccount = toAccount
        };

        Apply(t.Type, t.Amount, t.ToAmount, account!, toAccount);
        db.Transactions.Add(t);
        await db.SaveChangesAsync();

        LogBalances("Recorded", t, account!, toAccount);
        return LedgerResult.Ok(t);
    }

    // Changes a transaction: its amount, date, category, description, account or type.
    // E.g. a purchase logged against Lloyds that was really on the Aqua card, or a typo in the amount.
    // The old effect on the balances is undone first, then the new one is applied, so the balances
    // end up as if it had been right from the start. Returns null if the transaction doesn't exist.
    public async Task<LedgerResult?> UpdateAsync(int id, LedgerEntry entry)
    {
        var t = await db.Transactions.FindAsync(id);
        if (t is null) return null;

        if (entry.Amount <= 0)
            return Reject(entry.Type, entry.Amount, "Amount must be above zero.");

        var oldAccount = (await db.Accounts.FindAsync(t.AccountId))!;
        var oldTo = t.ToAccountId is { } oldToId ? await db.Accounts.FindAsync(oldToId) : null;
        var before = $"{Describe(t.Type, oldAccount, oldTo)}, {t.Amount} {oldAccount.Currency} on {t.Date}";
        Apply(t.Type, -t.Amount, t.ToAmount is { } oldToAmount ? -oldToAmount : null, oldAccount, oldTo);

        // Checked after the undo, so "more than is owed" sees the balance without this payment in it.
        // If anything is wrong, nothing is saved, so the undo above is simply thrown away.
        var (account, toAccount, error) = await LoadAsync(
            entry.Type, entry.AccountId, entry.ToAccountId, entry.Amount, entry.ToAmount, entry.GbpAmount);
        if (error is not null) return Reject(entry.Type, entry.Amount, error);

        var (pounds, poundsError) = await PoundsAsync(entry.Amount, entry.Date, account!, toAccount, entry.ToAmount, entry.GbpAmount);
        if (poundsError is not null) return Reject(entry.Type, entry.Amount, poundsError);

        Apply(entry.Type, entry.Amount, entry.ToAmount, account!, toAccount);
        t.Amount = entry.Amount;
        t.GbpAmount = pounds!.Value;
        t.ToAmount = entry.ToAmount;
        t.Description = entry.Description;
        t.Category = entry.Category;
        t.Date = entry.Date;
        t.Type = entry.Type;
        t.Account = account!;
        t.ToAccount = toAccount;
        t.ToAccountId = toAccount?.Id;
        await db.SaveChangesAsync();

        logger.LogInformation("Updated transaction {TransactionId}: {Before} -> {After}",
            t.Id, before, $"{Describe(t.Type, account!, toAccount)}, {t.Amount} {account!.Currency} on {t.Date}");
        LogBalances("Updated", t, account!, toAccount);
        return LedgerResult.Ok(t);
    }

    // Removes a transaction and undoes what it did to the balances, as if it had never happened.
    // Returns false if it doesn't exist.
    public async Task<bool> DeleteAsync(int id)
    {
        var t = await db.Transactions.FindAsync(id);
        if (t is null) return false;

        var account = (await db.Accounts.FindAsync(t.AccountId))!;
        var toAccount = t.ToAccountId is { } toId ? await db.Accounts.FindAsync(toId) : null;
        Apply(t.Type, -t.Amount, t.ToAmount is { } toAmount ? -toAmount : null, account, toAccount);

        db.Transactions.Remove(t);
        await db.SaveChangesAsync();

        if (toAccount is null)
            logger.LogInformation("Deleted {Type} {TransactionId} ({Description}, {Amount} {Currency}); {Account} balance now {Balance}",
                t.Type, t.Id, t.Description, t.Amount, account.Currency, account.Name, account.Balance);
        else
            logger.LogInformation("Deleted {Type} {TransactionId} ({Description}); balances now {From} {FromBalance}, {To} {ToBalance}",
                t.Type, t.Id, t.Description, account.Name, account.Balance, toAccount.Name, toAccount.Balance);
        return true;
    }

    // Finds the accounts involved and checks the entry makes sense for them.
    // Returns the accounts, or a reason it can't go ahead.
    private async Task<(Account? Account, Account? ToAccount, string? Error)> LoadAsync(
        TransactionType type, int accountId, int? toAccountId, decimal amount, decimal? toAmount, decimal? gbpAmount)
    {
        var account = await db.Accounts.FindAsync(accountId);
        if (account is null) return (null, null, $"Account {accountId} doesn't exist.");

        // A typed-in £ value only means something for money that isn't in pounds.
        if (gbpAmount is not null && (gbpAmount <= 0 || account.Currency == Currencies.Home))
            return (null, null, "A £ value is only for something in another currency, and must be above zero.");

        // Expenses and income only involve one account.
        if (type != TransactionType.Transfer)
        {
            if (toAccountId is not null) return (null, null, "Only a transfer has a 'to' account.");
            if (toAmount is not null) return (null, null, "Only a transfer between currencies has a received amount.");
            return (account, null, null);
        }

        if (toAccountId is null) return (null, null, "A transfer needs a 'to' account.");
        if (toAccountId == accountId) return (null, null, "A transfer needs two different accounts.");

        var toAccount = await db.Accounts.FindAsync(toAccountId);
        if (toAccount is null) return (null, null, $"Account {toAccountId} doesn't exist.");

        // Between currencies, I have to say what arrived: the rate on the day (and any markup) is in that number.
        // Within one currency, what leaves is what arrives, so a second amount would only be a mistake.
        var crossesCurrencies = account.Currency != toAccount.Currency;
        if (crossesCurrencies && (toAmount is null || toAmount <= 0))
            return (null, null, $"{account.Currency} to {toAccount.Currency}: enter the amount received in {toAccount.Currency}.");
        if (!crossesCurrencies && toAmount is not null)
            return (null, null, $"Both accounts are in {account.Currency}, so there's no separate received amount.");

        // Paying off more than I owe is almost always a typo (£1000 instead of £100).
        var received = toAmount ?? amount;
        if (toAccount.Type != AccountType.Current && received > toAccount.Balance)
            return (null, null, $"That's more than the {toAccount.Balance:0.00} {toAccount.Currency} owed on {toAccount.Name}.");

        return (account, toAccount, null);
    }

    // The transaction's value in pounds, for the monthly summary.
    private async Task<(decimal? Pounds, string? Error)> PoundsAsync(
        decimal amount, DateOnly date, Account account, Account? toAccount, decimal? toAmount, decimal? gbpAmount)
    {
        // In pounds already.
        if (account.Currency == Currencies.Home) return (amount, null);

        // Naira into a pounds account: the pounds that arrived are the exact value.
        if (toAccount?.Currency == Currencies.Home) return (toAmount, null);

        // My own figure, if I typed one.
        if (gbpAmount is not null) return (gbpAmount, null);

        // Otherwise, convert at the rate from my latest transfer between pounds and this currency.
        var rate = await rates.RatePerPoundAsync(account.Currency, date);
        if (rate is null)
            return (null, $"There's no transfer between GBP and {account.Currency} yet to take a rate from, so enter the £ value.");

        var pounds = Currencies.ToPounds(amount, rate.Value);
        logger.LogInformation("Converted {Amount} {Currency} to £{Pounds} at {Rate:0.##} per pound",
            amount, account.Currency, pounds, rate.Value);
        return (pounds, null);
    }

    // Asks BalanceRules what should change, then changes it on the tracked entities.
    // Nothing touches the database until SaveChangesAsync.
    private static void Apply(TransactionType type, decimal amount, decimal? toAmount, Account account, Account? toAccount)
    {
        var changes = BalanceRules.For(type, amount,
            new AccountRef(account.Id, account.Type),
            toAccount is null ? null : new AccountRef(toAccount.Id, toAccount.Type),
            toAmount);

        foreach (var c in changes)
            (c.AccountId == account.Id ? account : toAccount!).Balance += c.Delta;
    }

    private LedgerResult Reject(TransactionType type, decimal amount, string reason)
    {
        logger.LogWarning("Rejected {Type} of {Amount}: {Reason}", type, amount, reason);
        return LedgerResult.Fail(reason);
    }

    // After each change, log where the money went and what the balances are now.
    // If a balance ever looks wrong, these lines show which transaction moved it.
    private void LogBalances(string action, Transaction t, Account account, Account? toAccount)
    {
        if (toAccount is null)
            logger.LogInformation("{Action} {Type} {TransactionId} of {Amount} {Currency} on {Account}; balance now {Balance}",
                action, t.Type, t.Id, t.Amount, account.Currency, account.Name, account.Balance);
        else
            logger.LogInformation(
                "{Action} {Type} {TransactionId}: {Amount} {Currency} from {From} to {To} ({Received} {ToCurrency}); balances now {FromBalance} and {ToBalance}",
                action, t.Type, t.Id, t.Amount, account.Currency, account.Name, toAccount.Name,
                t.ToAmount ?? t.Amount, toAccount.Currency, account.Balance, toAccount.Balance);
    }

    private static string Describe(TransactionType type, Account account, Account? toAccount) =>
        toAccount is null ? $"{type} on {account.Name}" : $"{type} {account.Name} -> {toAccount.Name}";
}
