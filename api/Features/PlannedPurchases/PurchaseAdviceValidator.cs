using System.Text.Json;
using System.Text.Json.Serialization;
using LifeTracker.Api.Features.Insights;

namespace LifeTracker.Api.Features.PlannedPurchases;

public enum AdviceVerdict { GoodIdea, GoodIdeaLater, Reconsider }

// Advice on a planned purchase, once checked. SuggestedMonths is worked out from the suggested monthly
// amount and what's still needed (the calculator's rule), so the two always agree.
public record PurchaseAdviceResult(
    AdviceVerdict Verdict, decimal SuggestedMonthlyAmount, int SuggestedMonths, string Reasoning,
    IReadOnlyList<string> Risks, IReadOnlyList<string> Alternatives);

// Checks OpenAI's advice before it's saved or shown, like InsightResponseValidator: the JSON asked for,
// a known verdict, a sensible monthly amount and some reasoning. Text is trimmed and capped, lists are
// capped, and the months are recomputed from the amount. Pure, so every rule is a unit test.
public static class PurchaseAdviceValidator
{
    public const int MaxReasoning = 1500;   // about 150 words asked for, with room to spare
    public const int MaxItems = 5;
    public const int MaxItemText = 300;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    // remaining: what the purchase still needs (target less what's saved).
    public static (PurchaseAdviceResult? Result, string? Error) Validate(string? json, decimal remaining)
    {
        if (string.IsNullOrWhiteSpace(json)) return (null, "The answer was empty.");

        Raw? raw;
        try
        {
            raw = JsonSerializer.Deserialize<Raw>(json, Json);
        }
        catch (JsonException)
        {
            return (null, "The answer wasn't in the expected format.");
        }

        if (raw is null) return (null, "The answer was empty.");
        // Only the three names, exactly (Enum.TryParse would also take "1").
        if (raw.Verdict is null || !Enum.GetNames<AdviceVerdict>().Contains(raw.Verdict)) return (null, "The answer had no verdict.");
        var verdict = Enum.Parse<AdviceVerdict>(raw.Verdict);
        if (string.IsNullOrWhiteSpace(raw.Reasoning)) return (null, "The answer had no reasoning.");
        if (raw.Risks is null || raw.Alternatives is null) return (null, "The answer was missing a list.");
        if (raw.SuggestedMonthlyAmount is not { } suggested || suggested <= 0 || suggested > InsightResponseValidator.MaxMonthlyAmount)
            return (null, "The suggested monthly amount wasn't possible.");

        var monthly = Math.Round(suggested, 2, MidpointRounding.AwayFromZero);
        if (monthly <= 0) return (null, "The suggested monthly amount wasn't possible.");

        // From the amount when something's still needed (as the calculator counts months); otherwise
        // the model's own count. Either way 1 to 120.
        var months = remaining > 0 ? (int)Math.Min(int.MaxValue, Math.Ceiling(remaining / monthly)) : raw.SuggestedMonths ?? 0;
        if (months is < 1 or > PlannedPurchaseCalculator.MaxMonths)
            return (null, "The suggested plan would take more than 120 months.");

        return (new PurchaseAdviceResult(verdict, monthly, months, Cut(raw.Reasoning, MaxReasoning),
            Items(raw.Risks), Items(raw.Alternatives)), null);
    }

    public static string Serialize(PurchaseAdviceResult result) => JsonSerializer.Serialize(result, Json);

    public static PurchaseAdviceResult Deserialize(string json) => JsonSerializer.Deserialize<PurchaseAdviceResult>(json, Json)!;

    private static List<string> Items(IEnumerable<string?> items) =>
        items.Where(i => !string.IsNullOrWhiteSpace(i)).Select(i => Cut(i!, MaxItemText)).Take(MaxItems).ToList();

    private static string Cut(string text, int max)
    {
        var t = text.Trim();
        return t.Length > max ? t[..max].TrimEnd() + "…" : t;
    }

    // As it arrives, before checking: everything nullable, and the verdict as text.
    private sealed record Raw(string? Verdict, decimal? SuggestedMonthlyAmount, int? SuggestedMonths, string? Reasoning,
        List<string?>? Risks, List<string?>? Alternatives);
}
