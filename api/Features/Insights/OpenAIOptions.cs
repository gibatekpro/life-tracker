namespace LifeTracker.Api.Features.Insights;

// The "OpenAI" configuration section, bound with the Options pattern (like BudgetOptions).
// ApiKey comes from user secrets (dotnet user-secrets set "OpenAI:ApiKey" "...") and only ever
// lives in the API: it's never returned, logged, stored or put in an error message.
// The rest has sensible defaults in appsettings.json.
public class OpenAIOptions
{
    public const string Section = "OpenAI";

    public string? ApiKey { get; set; }
    public string Model { get; set; } = "gpt-5.4-mini";
    public int MaxOutputTokens { get; set; } = 4000;      // reasoning models count their thinking here too
    public int TimeoutSeconds { get; set; } = 60;
    public string? ReasoningEffort { get; set; } = "low"; // leave empty for models that don't reason

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}
