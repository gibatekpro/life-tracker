namespace LifeTracker.Api.Models;

public class Debt
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Balance { get; set; }
    public decimal Apr { get; set; }              // e.g. 24.9 for 24.9%
    public decimal MinimumPayment { get; set; }
    public decimal MonthlyPayment { get; set; }   // what you actually plan to pay
    public bool PaymentsCountAsSpending { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}