using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Summary;
using LifeTracker.Api.Models;

namespace LifeTracker.Api.Features.Settings;

// Everything after the debt budget is optional: left out, it stays as it is.
public record UpdateSettingsRequest(
    decimal MonthlyIncome, decimal? MonthlyDebtBudget, IncomeMode? IncomeMode = null, int? MonthStartDay = null,
    bool? UseTransferRates = null, int? EarlyIncomeDays = null);
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

            // Every month has a 28th, so payday is limited to 1-28.
            if (req.MonthStartDay is < 1 or > BudgetPeriod.LatestStartDay)
            {
                logger.LogWarning("Rejected settings: month start day {Day}", req.MonthStartDay);
                return Results.BadRequest($"The month can start on day 1 to {BudgetPeriod.LatestStartDay}.");
            }

            if (req.EarlyIncomeDays is < 0 or > BudgetPeriod.MaxEarlyIncomeDays)
            {
                logger.LogWarning("Rejected settings: early income days {Days}", req.EarlyIncomeDays);
                return Results.BadRequest($"Early income can count from 0 to {BudgetPeriod.MaxEarlyIncomeDays} days before the month.");
            }

            return Results.Ok(await settings.UpdateAsync(
                req.MonthlyIncome, req.MonthlyDebtBudget, req.IncomeMode, req.MonthStartDay, req.UseTransferRates,
                req.EarlyIncomeDays));
        });

        // A separate endpoint, not part of PUT /, so that saving income and budget from the
        // dashboard (which doesn't know about this field) can't wipe the default by leaving it out.
        group.MapPut("/default-account", async (DefaultAccountRequest req, SettingsService settings, AppDbContext db) =>
        {
            if (req.AccountId is { } id)
            {
                var account = await db.Accounts.FindAsync(id);
                if (account is null)
                {
                    logger.LogWarning("Rejected default capture account {AccountId}: it doesn't exist", id);
                    return Results.BadRequest(new { error = $"Account {id} doesn't exist." });
                }

                // Apple Pay spends from a card or current account, never from money put aside.
                if (account.Type == AccountType.Savings)
                {
                    logger.LogWarning("Rejected default capture account {AccountId}: it's a savings account", id);
                    return Results.BadRequest(new { error = $"{account.Name} is a savings account, so Apple Pay can't spend from it." });
                }
            }

            return Results.Ok(await settings.SetDefaultAccountAsync(req.AccountId));
        });

        return group;
    }
}
