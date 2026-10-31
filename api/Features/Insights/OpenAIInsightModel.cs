using System.ClientModel;
using System.Diagnostics;
using Microsoft.Extensions.Options;
using OpenAI;
using OpenAI.Chat;

namespace LifeTracker.Api.Features.Insights;

// Asks OpenAI (official OpenAI .NET SDK) for an answer as structured JSON matching the schema it's
// given: an insight (InsightResponseValidator.JsonSchema) or purchase advice. The only place the API
// key is used.
//
// Cost controls: it's only called when I press Generate, the answer is capped at MaxOutputTokens,
// the whole call (retries included) has a timeout, and each call logs its token usage, not its content.
public class OpenAIInsightModel(IOptions<OpenAIOptions> options, ILogger<OpenAIInsightModel> logger) : IInsightModel
{
    public async Task<InsightModelReply> AskAsync(string systemPrompt, string prompt, ModelSchema schema, CancellationToken cancellationToken)
    {
        var o = options.Value;
        if (!o.IsConfigured) throw new InvalidOperationException("OpenAI key not configured");

        var client = new ChatClient(o.Model, new ApiKeyCredential(o.ApiKey!),
            new OpenAIClientOptions { NetworkTimeout = TimeSpan.FromSeconds(o.TimeoutSeconds) });

        var request = new ChatCompletionOptions
        {
            MaxOutputTokenCount = o.MaxOutputTokens,
            ResponseFormat = ChatResponseFormat.CreateJsonSchemaFormat(
                schema.Name, BinaryData.FromString(schema.Json), jsonSchemaIsStrict: true),
        };
        // Marked experimental (OPENAI001) in SDK 2.14, so it may change in an update; it's kept because
        // low effort makes reasoning models cheaper and quicker. An empty setting skips it.
#pragma warning disable OPENAI001
        if (!string.IsNullOrWhiteSpace(o.ReasoningEffort))
            request.ReasoningEffortLevel = new ChatReasoningEffortLevel(o.ReasoningEffort);
#pragma warning restore OPENAI001

        // One deadline for everything, including the SDK's own retries after a rate limit.
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(o.TimeoutSeconds));
        var watch = Stopwatch.StartNew();

        ChatCompletion completion;
        try
        {
            completion = (await client.CompleteChatAsync(
                [new SystemChatMessage(systemPrompt), new UserChatMessage(prompt)], request, timeout.Token)).Value;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("OpenAI request timed out after {Seconds}s ({Model})", o.TimeoutSeconds, o.Model);
            throw new InsightModelException(InsightModelFailure.Timeout, "OpenAI took too long to answer. Try again in a moment.");
        }
        catch (ClientResultException e)
        {
            // Only the status is logged or used: the provider's message isn't passed on.
            logger.LogWarning("OpenAI request failed with status {Status} ({Model})", e.Status, o.Model);
            throw e.Status switch
            {
                429 => new InsightModelException(InsightModelFailure.RateLimited,
                    "OpenAI is busy or your usage limit has been reached. Try again in a minute."),
                401 or 403 => new InsightModelException(InsightModelFailure.Rejected,
                    "OpenAI didn't accept the API key. Check the key set in OpenAI:ApiKey."),
                400 or 404 => new InsightModelException(InsightModelFailure.Rejected,
                    $"OpenAI couldn't use the model '{o.Model}'. Check OpenAI:Model."),
                _ => new InsightModelException(InsightModelFailure.Unavailable,
                    $"OpenAI couldn't answer right now (status {e.Status}). Try again later."),
            };
        }

        logger.LogInformation("OpenAI {Schema}: {Model}, {InputTokens} input + {OutputTokens} output tokens, {Ms} ms, finished: {Finish}",
            schema.Name, completion.Model, completion.Usage?.InputTokenCount, completion.Usage?.OutputTokenCount, watch.ElapsedMilliseconds,
            completion.FinishReason);

        if (completion.FinishReason == ChatFinishReason.Length)
            throw new InsightModelException(InsightModelFailure.Invalid,
                "OpenAI's answer was cut short. Try again, or raise OpenAI:MaxOutputTokens.");
        if (!string.IsNullOrEmpty(completion.Refusal))
            throw new InsightModelException(InsightModelFailure.Invalid, "OpenAI declined to answer this one. Try again.");

        var json = completion.Content.Count > 0 ? completion.Content[0].Text : "";
        return new InsightModelReply(json, completion.Model ?? o.Model,
            completion.Usage?.InputTokenCount ?? 0, completion.Usage?.OutputTokenCount ?? 0);
    }
}
