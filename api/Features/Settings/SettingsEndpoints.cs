namespace LifeTracker.Api.Features.Settings;

public record UpdateSettingsRequest(decimal MonthlyIncome, decimal? MonthlyDebtBudget);

public static class SettingsEndpoints
{
    public static RouteGroupBuilder MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/settings").WithTags("Settings");

        group.MapGet("/", async (SettingsService settings) => await settings.GetAsync());

        group.MapPut("/", async (UpdateSettingsRequest req, SettingsService settings) =>
        {
            if (req.MonthlyIncome < 0 || req.MonthlyDebtBudget < 0)
                return Results.BadRequest("Values can't be negative.");

            return Results.Ok(await settings.UpdateAsync(req.MonthlyIncome, req.MonthlyDebtBudget));
        });

        return group;
    }
}