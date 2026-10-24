namespace LifeTracker.Api.Models;

// An AI insight for one budget month: exactly what was sent (PromptSent, so I can always see what
// was shared), the checked answer (ResponseJson, an InsightResult), and what it cost.
public class Insight
{
    public int Id { get; set; }
    public DateOnly PeriodStart { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string Model { get; set; } = string.Empty;
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
    public string PromptSent { get; set; } = string.Empty;
    public string ResponseJson { get; set; } = string.Empty;
}
