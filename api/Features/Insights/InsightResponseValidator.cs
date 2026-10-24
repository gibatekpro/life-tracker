using System.Text.Json;

namespace LifeTracker.Api.Features.Insights;

public record WasteItem(string Name, decimal MonthlyAmount, string Reason);

public record SavingTip(string Tip, decimal EstimatedMonthlySaving);

// What an insight says, once checked: a summary, possible waste, ways to save (with £ a month)
// and how it fits with paying off debt.
public record InsightResult(string Summary, IReadOnlyList<WasteItem> WasteItems, IReadOnlyList<SavingTip> SavingTips, string DebtAdvice);

// Checks OpenAI's answer before anything is saved or shown: it must be the JSON asked for, with
// text where text is needed and sensible amounts. Amounts are rounded to the penny, text trimmed,
// and lists and lengths capped. Pure, so every rule is a unit test.
public static class InsightResponseValidator
{
    public const int MaxItems = 10;
    public const int MaxText = 2000;
    public const int MaxItemText = 300;
    public const decimal MaxMonthlyAmount = 100_000m;

    // The shape OpenAI is told to answer in (structured output, strict: every field required,
    // nothing extra).
    public const string JsonSchema =
        """
        {
          "type": "object",
          "properties": {
            "summary": { "type": "string" },
            "wasteItems": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "monthlyAmount": { "type": "number" },
                  "reason": { "type": "string" }
                },
                "required": ["name", "monthlyAmount", "reason"],
                "additionalProperties": false
              }
            },
            "savingTips": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "tip": { "type": "string" },
                  "estimatedMonthlySaving": { "type": "number" }
                },
                "required": ["tip", "estimatedMonthlySaving"],
                "additionalProperties": false
              }
            },
            "debtAdvice": { "type": "string" }
          },
          "required": ["summary", "wasteItems", "savingTips", "debtAdvice"],
          "additionalProperties": false
        }
        """;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // The answer, checked; or why it can't be used.
    public static (InsightResult? Result, string? Error) Validate(string? json)
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
        if (string.IsNullOrWhiteSpace(raw.Summary)) return (null, "The answer had no summary.");
        if (string.IsNullOrWhiteSpace(raw.DebtAdvice)) return (null, "The answer had no debt advice.");
        if (raw.WasteItems is null || raw.SavingTips is null) return (null, "The answer was missing a list.");

        var waste = new List<WasteItem>();
        foreach (var w in raw.WasteItems.Take(MaxItems))
        {
            if (string.IsNullOrWhiteSpace(w.Name)) return (null, "A possible-waste item had no name.");
            if (Amount(w.MonthlyAmount) is not { } amount) return (null, $"'{Cut(w.Name, 40)}' had an impossible amount.");
            waste.Add(new WasteItem(Cut(w.Name, MaxItemText), amount, Cut(w.Reason ?? "", MaxItemText)));
        }

        var tips = new List<SavingTip>();
        foreach (var t in raw.SavingTips.Take(MaxItems))
        {
            if (string.IsNullOrWhiteSpace(t.Tip)) return (null, "A saving tip was empty.");
            if (Amount(t.EstimatedMonthlySaving) is not { } amount) return (null, "A saving tip had an impossible amount.");
            tips.Add(new SavingTip(Cut(t.Tip, MaxItemText), amount));
        }

        return (new InsightResult(Cut(raw.Summary, MaxText), waste, tips, Cut(raw.DebtAdvice, MaxText)), null);
    }

    public static string Serialize(InsightResult result) => JsonSerializer.Serialize(result, Json);

    public static InsightResult Deserialize(string json) => JsonSerializer.Deserialize<InsightResult>(json, Json)!;

    // Pounds a month: present, not negative and not absurd; rounded to the penny.
    private static decimal? Amount(decimal? value) =>
        value is { } v && v >= 0 && v <= MaxMonthlyAmount ? Math.Round(v, 2, MidpointRounding.AwayFromZero) : null;

    private static string Cut(string text, int max)
    {
        var t = text.Trim();
        return t.Length > max ? t[..max].TrimEnd() + "…" : t;
    }

    // The JSON as it arrives, before checking (everything nullable, since it can't be trusted yet).
    private sealed record Raw(string? Summary, List<RawWaste>? WasteItems, List<RawTip>? SavingTips, string? DebtAdvice);
    private sealed record RawWaste(string? Name, decimal? MonthlyAmount, string? Reason);
    private sealed record RawTip(string? Tip, decimal? EstimatedMonthlySaving);
}
