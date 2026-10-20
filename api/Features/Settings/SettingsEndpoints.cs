using LifeTracker.Api.Data;

namespace LifeTracker.Api.Features.Settings;

public record UpdateSettingsRequest(decimal MonthlyIncome, decimal? MonthlyDebtBudget);
public record DefaultAccountRequest(int? AccountId);

// Reading and changing my settings from the dashboard (the Settings card) or Scalar.
// The real work is in SettingsService; these endpoints just check the input.
public static class SettingsEndpoints
{
    public static RouteGroupBuilder MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/settings").WithTags("Settings");

        var logger = app.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger("LifeTracker.Api.Features.Settings");

        group.MapGet("/", async (SettingsService settings) => await settings.GetAsync());

        // Income and debt budget, as saved from the Settings card.
        group.MapPut("/", async (UpdateSettingsRequest req, SettingsService settings) =>
        {
            if (req.MonthlyIncome < 0 || req.MonthlyDebtBudget < 0)
            {
                logger.LogWarning("Rejected settings: income £{Income} and debt budget £{Budget} can't be negative",
                    req.MonthlyIncome, req.MonthlyDebtBudget);
                return Results.BadRequest("Values can't be negative.");
            }

            return Results.Ok(await settings.UpdateAsync(req.MonthlyIncome, req.MonthlyDebtBudget));
        });

        // A separate endpoint, not part of PUT /, so that saving income and budget from the
        // dashboard (which doesn't know about this field) can't wipe the default by leaving it out.
        group.MapPut("/default-account", async (DefaultAccountRequest req, SettingsService settings, AppDbContext db) =>
        {
            if (req.AccountId is { } id && await db.Accounts.FindAsync(id) is null)
            {
                logger.LogWarning("Rejected default capture account {AccountId}: it doesn't exist", id);
                return Results.BadRequest(new { error = $"Account {id} doesn't exist." });
            }

            return Results.Ok(await settings.SetDefaultAccountAsync(req.AccountId));
        });

        return group;
    }
}
