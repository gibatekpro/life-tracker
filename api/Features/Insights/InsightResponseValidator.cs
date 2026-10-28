using System.Text.Json;

namespace LifeTracker.Api.Features.Insights;

public record WasteItem(string Name, decimal MonthlyAmount, string Reason);

// Line: the budget line the tip would reduce (null if none, or for insights saved before it was asked for).
public record SavingTip(string Tip, decimal EstimatedMonthlySaving, string? Line = null);

// What an insight says, once checked: a summary, possible waste, ways to save (with £ a month)
// and how it fits with paying off debt; and Answer, the reply to my question (null with none).
public record InsightResult(string Summary, IReadOnlyList<WasteItem> WasteItems, IReadOnlyList<SavingTip> SavingTips, string DebtAdvice,
    string? Answer = null);

// Checks OpenAI's answer before anything is saved or shown: it must be the JSON asked for, with
// text where text is needed and sensible amounts. Amounts are rounded to the penny, text trimmed,
// and lists and lengths capped. Advice the prompt rules out is dropped rather than shown: a saving
// that cuts an essential line, and anything under £5 a month. Pure, so every rule is a unit test.
public static class InsightResponseValidator
{
    public const int MaxItems = 10;
    public const int MaxText = 2000;
    public const int MaxItemText = 300;
    public const decimal MaxMonthlyAmount = 100_000m;
    public const decimal MinMonthlyAmount = 5m;
    public const int MaxAnswer = 1500;   // about 150 words asked for, with room to spare

    // The rules an item can be dropped by: what the logs say, never the item itself.
    public const string CutsEssentialLine = "saving tip cuts an essential line";
    public const string UnderMinimum = "under £5 a month";

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
                  "estimatedMonthlySaving": { "type": "number" },
                  "line": {
                    "type": "string",
                    "description": "The budget line this tip would reduce, exactly as named in the data, or an empty string if none."
                  }
                },
                "required": ["tip", "estimatedMonthlySaving", "line"],
                "additionalProperties": false
              }
            },
            "debtAdvice": { "type": "string" },
            "answer": {
              "type": ["string", "null"],
              "description": "The reply to the user's question, or null if there was no question."
            }
          },
          "required": ["summary", "wasteItems", "savingTips", "debtAdvice", "answer"],
          "additionalProperties": false
        }
        """;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // The names of the essential budget lines (inherited ones included), as Validate takes them.
    public static HashSet<string> EssentialLines(IEnumerable<InsightBudgetLine> lines)
    {
        var names = new HashSet<string>();
        void Collect(IEnumerable<InsightBudgetLine> ls)
        {
            foreach (var l in ls)
            {
                if (l.IsEssential) names.Add(LineKey(l.Name));
                Collect(l.Children);
            }
        }
        Collect(lines);
        return names;
    }

    // The answer, checked; or why it can't be used. Dropped lists the rule each dropped item hit.
    // With a question there must be an answer to it; without one there mustn't.
    public static (InsightResult? Result, string? Error, IReadOnlyList<string> Dropped) Validate(
        string? json, IReadOnlySet<string>? essentialLines = null, bool hasQuestion = false)
    {
        var dropped = new List<string>();
        var (result, error) = Check(json, essentialLines ?? new HashSet<string>(), hasQuestion, dropped);
        return (result, error, dropped);
    }

    private static (InsightResult? Result, string? Error) Check(
        string? json, IReadOnlySet<string> essentialLines, bool hasQuestion, List<string> dropped)
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
        var reply = string.IsNullOrWhiteSpace(raw.Answer) ? null : Cut(raw.Answer, MaxAnswer);
        if (hasQuestion && reply is null) return (null, "It didn't answer your question.");
        if (!hasQuestion && reply is not null) return (null, "It answered a question that wasn't asked.");

        var waste = new List<WasteItem>();
        foreach (var w in raw.WasteItems.TakeWhile(_ => waste.Count < MaxItems))   // capped after dropping, so dropped ones take no place
        {
            if (string.IsNullOrWhiteSpace(w.Name)) return (null, "A possible-waste item had no name.");
            if (Amount(w.MonthlyAmount) is not { } amount) return (null, $"'{Cut(w.Name, 40)}' had an impossible amount.");
            if (amount < MinMonthlyAmount) { dropped.Add(UnderMinimum); continue; }
            waste.Add(new WasteItem(Cut(w.Name, MaxItemText), amount, Cut(w.Reason ?? "", MaxItemText)));
        }

        var tips = new List<SavingTip>();
        foreach (var t in raw.SavingTips.TakeWhile(_ => tips.Count < MaxItems))
        {
            if (string.IsNullOrWhiteSpace(t.Tip)) return (null, "A saving tip was empty.");
            if (Amount(t.EstimatedMonthlySaving) is not { } amount) return (null, "A saving tip had an impossible amount.");
            var line = string.IsNullOrWhiteSpace(t.Line) ? null : Cut(t.Line, 100);
            if (line is not null && IsEssential(line, essentialLines)) { dropped.Add(CutsEssentialLine); continue; }
            if (amount < MinMonthlyAmount) { dropped.Add(UnderMinimum); continue; }
            tips.Add(new SavingTip(Cut(t.Tip, MaxItemText), amount, line));
        }

        return (new InsightResult(Cut(raw.Summary, MaxText), waste, tips, Cut(raw.DebtAdvice, MaxText), reply), null);
    }

    public static string Serialize(InsightResult result) => JsonSerializer.Serialize(result, Json);

    public static InsightResult Deserialize(string json) => JsonSerializer.Deserialize<InsightResult>(json, Json)!;

    // Line names compared ignoring case, spaces and punctuation. The model may answer with the line's
    // name ("Bus") or its path ("Transport › Bus"); either the whole or the last part counts.
    private static string LineKey(string name) => new(name.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

    private static bool IsEssential(string line, IReadOnlySet<string> essentialLines) =>
        essentialLines.Contains(LineKey(line)) || essentialLines.Contains(LineKey(line.Split('›', '>')[^1]));

    // Pounds a month: present, not negative and not absurd; rounded to the penny.
    private static decimal? Amount(decimal? value) =>
        value is { } v && v >= 0 && v <= MaxMonthlyAmount ? Math.Round(v, 2, MidpointRounding.AwayFromZero) : null;

    private static string Cut(string text, int max)
    {
        var t = text.Trim();
        return t.Length > max ? t[..max].TrimEnd() + "…" : t;
    }

    // The JSON as it arrives, before checking (everything nullable, since it can't be trusted yet).
    private sealed record Raw(string? Summary, List<RawWaste>? WasteItems, List<RawTip>? SavingTips, string? DebtAdvice, string? Answer);
    private sealed record RawWaste(string? Name, decimal? MonthlyAmount, string? Reason);
    private sealed record RawTip(string? Tip, decimal? EstimatedMonthlySaving, string? Line);
}
