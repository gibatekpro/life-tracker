using LifeTracker.Api.Models;

namespace LifeTracker.Api.Features.Accounts;

public record AccountRef(int Id, AccountType Type);

public record BalanceChange(int AccountId, decimal Delta);

public static class BalanceRules
{
    // Current accounts hold money; cards and loans hold what I owe.
    // So the same movement of money changes their balances in opposite directions.
    public static decimal MoneyOut(AccountType type, decimal amount) =>
        type == AccountType.Current ? -amount : amount;

    public static decimal MoneyIn(AccountType type, decimal amount) =>
        -MoneyOut(type, amount);

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
