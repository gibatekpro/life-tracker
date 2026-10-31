namespace LifeTracker.Api.Models;

// AI advice on a planned purchase: exactly what was sent (PromptSent), the checked answer
// (ResponseJson, a PurchaseAdviceResult) and what it cost, like an Insight. PlannedPurchaseId is
// null for advice asked about a draft before saving it; Name is what was asked about either way.
public class PurchaseAdvice
{
    public int Id { get; set; }
    public int? PlannedPurchaseId { get; set; }
    public PlannedPurchase? PlannedPurchase { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string Model { get; set; } = string.Empty;
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
    public string PromptSent { get; set; } = string.Empty;
    public string ResponseJson { get; set; } = string.Empty;
}
