namespace LifeTracker.Api.Models;

public class AppSettings
{
    public int Id { get; set; }
    public decimal MonthlyIncome { get; set; }
    public decimal? MonthlyDebtBudget { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}