namespace LifeTracker.Api.Features.Summary;
using LifeTracker.Api.Common;
public static class SummaryEndpoints
{
    public static RouteGroupBuilder MapSummaryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/summary").WithTags("Summary");

        group.MapGet("/monthly", async (int? year, int? month, SummaryService service) =>
        {
            var today = UkDate.Today();
            var y = year ?? today.Year;
            var m = month ?? today.Month;

            if (m is < 1 or > 12)
                return Results.BadRequest("Month must be between 1 and 12.");

            return Results.Ok(await service.GetMonthlyAsync(y, m));
        });

        return group;
    }
}