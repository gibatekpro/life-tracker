using LifeTracker.Api.Features.Insights;

namespace LifeTracker.Api.Features.PlannedPurchases;

// Saving towards something each month: a visa fee, a laptop. Each one has its own savings account;
// money goes in as transfers through /transactions, and the rules live in PlannedPurchaseService.
public static class PlannedPurchaseEndpoints
{
    public static RouteGroupBuilder MapPlannedPurchaseEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/planned-purchases").WithTags("Planned purchases");

        // Each with what's saved, progress, whether it's on track and when it should finish.
        group.MapGet("/", async (PlannedPurchaseService purchases) => await purchases.ListAsync());

        group.MapGet("/{id:int}", async (int id, PlannedPurchaseService purchases) =>
            await purchases.GetAsync(id) is { } p ? Results.Ok(p) : Results.NotFound());

        // Optionally creating its savings account in the same save.
        group.MapPost("/", async (CreatePlannedPurchaseRequest req, PlannedPurchaseService purchases) =>
            ToResult(await purchases.CreateAsync(req), created: true));

        group.MapPut("/{id:int}", async (int id, UpdatePlannedPurchaseRequest req, PlannedPurchaseService purchases) =>
            ToResult(await purchases.UpdateAsync(id, req)));

        // Status only: the money stays in the account until I move it.
        group.MapPost("/{id:int}/cancel", async (int id, PlannedPurchaseService purchases) =>
            ToResult(await purchases.CancelAsync(id)));

        // Records the expense from its savings account; anything left over stays there.
        group.MapPost("/{id:int}/bought", async (int id, BoughtRequest req, PlannedPurchaseService purchases) =>
            ToResult(await purchases.BoughtAsync(id, req)));

        // AI advice: is it a good idea, and what's a reasonable monthly amount? About a saved planned
        // purchase or a draft (before saving it). Only the API talks to OpenAI; with no key, 503.
        group.MapPost("/advice", async (AskAdviceRequest req, PurchaseAdviceService advice, CancellationToken cancellationToken) =>
        {
            var outcome = await advice.AskAsync(req, cancellationToken);
            return outcome switch
            {
                { Advice: { } a } => Results.Created(a.PlannedPurchaseId is { } id ? $"/planned-purchases/{id}/advice" : null,
                    PurchaseAdviceDto.From(a)),
                { RequestProblem: PlannedPurchaseProblem.NotFound } => Results.NotFound(new { error = outcome.Error }),
                { RequestProblem: PlannedPurchaseProblem.Conflict } => Results.Conflict(new { error = outcome.Error }),
                { RequestProblem: not null } => Results.BadRequest(new { error = outcome.Error }),
                _ => Results.Json(new { error = outcome.Error }, statusCode: InsightEndpoints.StatusFor(outcome.ModelProblem)),
            };
        });

        // A planned purchase's advice, newest first.
        group.MapGet("/{id:int}/advice", async (int id, PurchaseAdviceService advice) =>
            await advice.ForPurchaseAsync(id) is { } list ? Results.Ok(list) : Results.NotFound());

        return group;
    }

    private static IResult ToResult(PlannedPurchaseResult result, bool created = false) => result switch
    {
        { Problem: PlannedPurchaseProblem.NotFound } => Results.NotFound(new { error = result.Error }),
        { Problem: PlannedPurchaseProblem.Invalid } => Results.BadRequest(new { error = result.Error }),
        { Problem: PlannedPurchaseProblem.Conflict } => Results.Conflict(new { error = result.Error }),
        { Purchase: { } p } when created => Results.Created($"/planned-purchases/{p.Id}", p),
        { Purchase: { } p } => Results.Ok(p),
        _ => Results.Problem(),
    };
}
