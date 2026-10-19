namespace LifeTracker.Api.Models;

public enum AccountType
{
    Current,     // Balance = money held
    CreditCard,  // Balance = amount owed
    Loan         // Balance = amount owed
}
