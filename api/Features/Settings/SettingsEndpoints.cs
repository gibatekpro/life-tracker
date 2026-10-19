using LifeTracker.Api.Data;

namespace LifeTracker.Api.Features.Settings;

public record UpdateSettingsRequest(decimal MonthlyIncome, decimal? MonthlyDebtBudget);
public record DefaultAccountRequest(int? AccountId);

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

        // Separate from PUT /, so saving income and budget can't clear it by leaving it out.
        group.MapPut("/default-account", async (DefaultAccountRequest req, SettingsService settings, AppDbContext db) =>
        {
            if (req.AccountId is { } id && await db.Accounts.FindAsync(id) is null)
                return Results.BadRequest(new { error = $"Account {id} doesn't exist." });

            return Results.Ok(await settings.SetDefaultAccountAsync(req.AccountId));
        });

        return group;
    }
}