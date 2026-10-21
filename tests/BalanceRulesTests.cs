using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Models;

namespace LifeTracker.Api.Tests;

public class BalanceRulesTests
{
    private static readonly AccountRef Lloyds = new(1, AccountType.Current);
    private static readonly AccountRef Aqua = new(2, AccountType.CreditCard);
    private static readonly AccountRef FamilyLoan = new(3, AccountType.Loan);

    [Fact]
    public void ExpenseOnCurrent_LowersTheMoneyHeld()
    {
        var changes = BalanceRules.For(TransactionType.Expense, 20m, Lloyds);

        Assert.Equal([new BalanceChange(1, -20m)], changes);
    }

    [Fact]
    public void ExpenseOnCard_RaisesTheAmountOwed()
    {
        var changes = BalanceRules.For(TransactionType.Expense, 20m, Aqua);

        Assert.Equal([new BalanceChange(2, 20m)], changes);
    }

    [Fact]
    public void IncomeOnCurrent_RaisesTheMoneyHeld()
    {
        var changes = BalanceRules.For(TransactionType.Income, 1500m, Lloyds);

        Assert.Equal([new BalanceChange(1, 1500m)], changes);
    }

    [Fact]
    public void RefundOnCard_LowersTheAmountOwed()
    {
        var changes = BalanceRules.For(TransactionType.Income, 15m, Aqua);

        Assert.Equal([new BalanceChange(2, -15m)], changes);
    }

    [Fact]
    public void RepayingACard_LowersBothTheMoneyHeldAndTheAmountOwed()
    {
        var changes = BalanceRules.For(TransactionType.Transfer, 100m, Lloyds, Aqua);

        Assert.Equal([new BalanceChange(1, -100m), new BalanceChange(2, -100m)], changes);
    }

    [Fact]
    public void RepayingALoan_WorksLikeACard()
    {
        var changes = BalanceRules.For(TransactionType.Transfer, 50m, Lloyds, FamilyLoan);

        Assert.Equal([new BalanceChange(1, -50m), new BalanceChange(3, -50m)], changes);
    }

    [Fact]
    public void TransferBetweenCurrentAccounts_MovesTheMoney()
    {
        var revolut = new AccountRef(4, AccountType.Current);

        var changes = BalanceRules.For(TransactionType.Transfer, 30m, Lloyds, revolut);

        Assert.Equal([new BalanceChange(1, -30m), new BalanceChange(4, 30m)], changes);
    }

    [Fact]
    public void TransferBetweenCurrencies_MovesEachSideByItsOwnAmount()
    {
        var palmPay = new AccountRef(5, AccountType.Current);

        // £10 leaves Lloyds, ₦18,000 arrives in PalmPay.
        var changes = BalanceRules.For(TransactionType.Transfer, 10m, Lloyds, palmPay, toAmount: 18000m);

        Assert.Equal([new BalanceChange(1, -10m), new BalanceChange(5, 18000m)], changes);
    }

    [Fact]
    public void RepayingANairaLoanFromPounds_LowersTheOwedNaira()
    {
        var loanApp = new AccountRef(6, AccountType.Loan);

        var changes = BalanceRules.For(TransactionType.Transfer, 20m, Lloyds, loanApp, toAmount: 36000m);

        Assert.Equal([new BalanceChange(1, -20m), new BalanceChange(6, -36000m)], changes);
    }

    [Fact]
    public void ReversingATransferBetweenCurrencies_LeavesBalancesUnchanged()
    {
        var palmPay = new AccountRef(5, AccountType.Current);
        var balances = new Dictionary<int, decimal> { [1] = 500m, [5] = 2000m };

        foreach (var c in BalanceRules.For(TransactionType.Transfer, 10m, Lloyds, palmPay, 18000m)) balances[c.AccountId] += c.Delta;
        foreach (var c in BalanceRules.For(TransactionType.Transfer, -10m, Lloyds, palmPay, -18000m)) balances[c.AccountId] += c.Delta;

        Assert.Equal(500m, balances[1]);
        Assert.Equal(2000m, balances[5]);
    }

    [Fact]
    public void TransferWithoutDestination_Throws()
    {
        Assert.Throws<ArgumentException>(() => BalanceRules.For(TransactionType.Transfer, 30m, Lloyds));
    }

    [Theory]
    [InlineData(TransactionType.Expense)]
    [InlineData(TransactionType.Income)]
    [InlineData(TransactionType.Transfer)]
    public void ApplyingThenReversing_LeavesBalancesUnchanged(TransactionType type)
    {
        var balances = new Dictionary<int, decimal> { [1] = 500m, [2] = 1200m };

        foreach (var c in BalanceRules.For(type, 75m, Lloyds, Aqua)) balances[c.AccountId] += c.Delta;
        foreach (var c in BalanceRules.For(type, -75m, Lloyds, Aqua)) balances[c.AccountId] += c.Delta;

        Assert.Equal(500m, balances[1]);
        Assert.Equal(1200m, balances[2]);
    }
}
