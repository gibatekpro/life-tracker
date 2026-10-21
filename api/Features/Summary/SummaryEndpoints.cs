namespace LifeTracker.Api.Features.Summary;

// The monthly summary card on the dashboard. The numbers come from SummaryService.
public static class SummaryEndpoints
{
    public static RouteGroupBuilder MapSummaryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/summary").WithTags("Summary");

        var logger = app.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger("LifeTracker.Api.Features.Summary");

        // With no year or month, it's the budget month I'm in now, in UK time (so a late-night
        // purchase doesn't land in the wrong month just because the server clock is in UTC).
        // If payday is set, a "month" runs from payday to the day before the next one.
        group.MapGet("/monthly", async (int? year, int? month, SummaryService service) =>
        {
            if (month is < 1 or > 12 || (year is null) != (month is null))
            {
                logger.LogWarning("Rejected summary request for {Year}-{Month}", year, month);
                return Results.BadRequest("Give both year and month (1-12), or neither for the current month.");
            }

            return Results.Ok(await service.GetMonthlyAsync(year, month));
        });

        return group;
    }
}
