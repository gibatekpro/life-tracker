namespace LifeTracker.Api.Features.Insights;

// What came back: the answer's JSON, the model that wrote it, and the tokens it cost.
public record InsightModelReply(string Json, string Model, int InputTokens, int OutputTokens);

public enum InsightModelFailure { RateLimited, Timeout, Rejected, Unavailable, Invalid }

// A failure with a message that's safe to show: never the provider's own text, which could
// contain anything.
public class InsightModelException(InsightModelFailure kind, string message) : Exception(message)
{
    public InsightModelFailure Kind { get; } = kind;
}

// The JSON shape to answer in (strict structured output): a short name and the JSON Schema itself.
public record ModelSchema(string Name, string Json)
{
    public static readonly ModelSchema Insight = new("insight", InsightResponseValidator.JsonSchema);
}

// The AI that writes an insight or a piece of advice. Behind an interface so tests use a fake and
// never call OpenAI; OpenAIInsightModel is the real one, and the only place the key is used.
public interface IInsightModel
{
    Task<InsightModelReply> AskAsync(string systemPrompt, string prompt, ModelSchema schema, CancellationToken cancellationToken);
}
