namespace LifeTracker.Api.Models;

public enum AccountType
{
    Current,     // Balance = money held
    CreditCard,  // Balance = amount owed
    Loan,        // Balance = amount owed
    Savings      // Balance = money held, put aside (e.g. for a planned purchase); filled by transfers
}

// Which side of the ledger an account is on. In-memory only: EF can't translate these into SQL,
// so database queries spell out the types (a.Type == CreditCard || a.Type == Loan).
public static class AccountTypeExtensions
{
    // Money I have: current and savings accounts.
    public static bool IsAsset(this AccountType type) => type is AccountType.Current or AccountType.Savings;

    // Money I owe: cards and loans.
    public static bool IsDebt(this AccountType type) => type is AccountType.CreditCard or AccountType.Loan;
}
