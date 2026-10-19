namespace LifeTracker.Api.Models;

public enum TransactionType
{
    Expense,   // money leaves an account to the outside world
    Income,    // money arrives in an account from the outside world
    Transfer   // money moves between two of my accounts, never counts as spending
}
