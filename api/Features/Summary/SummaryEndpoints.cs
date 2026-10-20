namespace LifeTracker.Api.Features.Summary;
using LifeTracker.Api.Common;

// The monthly summary card on the dashboard. The numbers come from SummaryService.
public static class SummaryEndpoints
{
    public static RouteGroupBuilder MapSummaryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/summary").WithTags("Summary");

        var logger = app.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger("LifeTracker.Api.Features.Summary");

        // With no year or month, it's "this month", in UK time (so a late-night purchase on the
        // 31st doesn't land in next month just because the server clock is in UTC).
        group.MapGet("/monthly", async (int? year, int? month, SummaryService service) =>
        {
            var today = UkDate.Today();
            var y = year ?? today.Year;
            var m = month ?? today.Month;

            if (m is < 1 or > 12)
            {
                logger.LogWarning("Rejected summary request for month {Month}", m);
                return Results.BadRequest("Month must be between 1 and 12.");
            }

            return Results.Ok(await service.GetMonthlyAsync(y, m));
        });

        return group;
    }
}
