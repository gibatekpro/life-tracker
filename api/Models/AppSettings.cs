namespace LifeTracker.Api.Models;

public class AppSettings
{
    public int Id { get; set; }
    public decimal MonthlyIncome { get; set; }
    public decimal? MonthlyDebtBudget { get; set; }
    public int? DefaultAccountId { get; set; }    // Apple Pay captures land here when no card name matches
    public IncomeMode IncomeMode { get; set; } = IncomeMode.Fixed;
    public int MonthStartDay { get; set; } = 1;   // budget months start on this day (payday); 1-28
    public bool UseTransferRates { get; set; }    // true: my latest transfer's rate first, my own rates as fallback
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
