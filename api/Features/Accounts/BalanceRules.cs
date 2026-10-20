using LifeTracker.Api.Models;

namespace LifeTracker.Api.Features.Accounts;

// Just enough about an account to work out its balance change: which one, and what kind.
public record AccountRef(int Id, AccountType Type);

// "Add this much to this account's balance" (negative means take away).
public record BalanceChange(int AccountId, decimal Delta);

// The heart of the accounts model: how a transaction changes the balances.
//
// The thing to keep in mind is that the balances mean different things. A current account's
// balance is money I have; a card's or loan's balance is money I owe. So spending £20 lowers
// Lloyds by £20 but raises Aqua by £20, and repaying Aqua from Lloyds lowers both.
//
// This is a plain static class with no database and no logging on purpose. It's the part most
// worth testing, and keeping it pure means the tests are just "given this, expect that".
// LedgerService does the saving and the logging.
public static class BalanceRules
{
    public static decimal MoneyOut(AccountType type, decimal amount) =>
        type == AccountType.Current ? -amount : amount;

    public static decimal MoneyIn(AccountType type, decimal amount) =>
        -MoneyOut(type, amount);

    // Expense: money leaves the account. Income: money arrives (on a card that's a refund).
    // Transfer: money leaves one account and arrives in the other.
    // To undo a transaction, call this with -amount.
    public static IReadOnlyList<BalanceChange> For(
        TransactionType type, decimal amount, AccountRef account, AccountRef? toAccount = null) =>
        type switch
        {
            TransactionType.Expense => [new(account.Id, MoneyOut(account.Type, amount))],
            TransactionType.Income => [new(account.Id, MoneyIn(account.Type, amount))],
            TransactionType.Transfer when toAccount is not null =>
            [
                new(account.Id, MoneyOut(account.Type, amount)),
                new(toAccount.Id, MoneyIn(toAccount.Type, amount))
            ],
            TransactionType.Transfer =>
                throw new ArgumentException("A transfer needs a destination account.", nameof(toAccount)),
            _ => throw new ArgumentOutOfRangeException(nameof(type))
        };
}
