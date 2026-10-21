namespace LifeTracker.Api.Models;

public class Account
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public AccountType Type { get; set; }
    public string Currency { get; set; } = "GBP"; // e.g. GBP, NGN. Balance, payments and limit are all in this currency
    public decimal Balance { get; set; }          // Current: money held. CreditCard/Loan: amount owed.
    public decimal Apr { get; set; }              // e.g. 24.9 for 24.9%
    public decimal MinimumPayment { get; set; }
    public decimal MonthlyPayment { get; set; }   // what you actually plan to pay
    public decimal? CreditLimit { get; set; }     // credit cards only
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<AccountAlias> Aliases { get; set; } = [];

    // Getter-only, so EF doesn't map it to a column, but it still appears in the JSON.
    public decimal? AvailableCredit =>
        Type == AccountType.CreditCard && CreditLimit is { } limit ? limit - Balance : null;
}
