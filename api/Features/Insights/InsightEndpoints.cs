using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Insights;

public record GenerateInsightRequest(int Year, int Month, bool Regenerate = false);

// An insight as the page shows it: the month, the checked answer, what it cost, and exactly what
// was sent to OpenAI.
public record InsightDto(
    int Id, int Year, int Month, DateOnly PeriodStart, DateTime CreatedAt, string Model,
    int InputTokens, int OutputTokens, string PromptSent, InsightResult Result)
{
    public static InsightDto From(Insight i) => new(
        i.Id, i.PeriodStart.Year, i.PeriodStart.Month, i.PeriodStart, i.CreatedAt, i.Model,
        i.InputTokens, i.OutputTokens, i.PromptSent, InsightResponseValidator.Deserialize(i.ResponseJson));
}

// AI insights for a budget month: what I'm spending on, possible waste, ways to save and how it all
// fits with paying off debt. The web app only ever calls these; only the API talks to OpenAI.
public static class InsightEndpoints
{
    public static RouteGroupBuilder MapInsightEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/insights").WithTags("Insights");

        // Makes one (only when asked: this is the one place the app spends OpenAI tokens), or returns
        // the month's existing one unless Regenerate is set.
        group.MapPost("/", async (GenerateInsightRequest req, InsightService insights, CancellationToken cancellationToken) =>
        {
            if (req.Month is < 1 or > 12 || req.Year is < 2000 or > 2100)
                return Results.BadRequest(new { error = "Give a year and a month (1-12)." });

            var outcome = await insights.GenerateAsync(req.Year, req.Month, req.Regenerate, cancellationToken);
            return outcome switch
            {
                { Insight: { } i, Created: true } => Results.Created($"/insights/{i.Id}", InsightDto.From(i)),
                { Insight: { } i } => Results.Ok(InsightDto.From(i)),
                _ => Results.Json(new { error = outcome.Error }, statusCode: outcome.Problem switch
                {
                    InsightProblem.NotConfigured => StatusCodes.Status503ServiceUnavailable,
                    InsightProblem.RateLimited => StatusCodes.Status429TooManyRequests,
                    InsightProblem.Timeout => StatusCodes.Status504GatewayTimeout,
                    _ => StatusCodes.Status502BadGateway,
                }),
            };
        });

        // Newest first, to compare months.
        group.MapGet("/", async (AppDbContext db) =>
            (await db.Insights.OrderByDescending(i => i.PeriodStart).ThenByDescending(i => i.CreatedAt).ToListAsync())
                .Select(InsightDto.From));

        group.MapGet("/{id:int}", async (int id, AppDbContext db) =>
            await db.Insights.FindAsync(id) is { } i ? Results.Ok(InsightDto.From(i)) : Results.NotFound());

        group.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
        {
            var deleted = await db.Insights.Where(i => i.Id == id).ExecuteDeleteAsync();
            return deleted > 0 ? Results.NoContent() : Results.NotFound();
        });

        return group;
    }
}
