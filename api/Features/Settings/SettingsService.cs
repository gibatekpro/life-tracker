using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Summary;
using LifeTracker.Api.Models;
using Microsoft.Extensions.Options;

namespace LifeTracker.Api.Features.Settings;

// My personal numbers: take-home pay, the fixed monthly debt budget, and the default account
// for Apple Pay. They live in the database (not appsettings.json) so I can change them from
// the dashboard without restarting anything.
//
// There's only ever one row (Id 1). Anything that needs a setting asks this service,
// so there's one place that knows how to load, create and save it.
public class SettingsService(AppDbContext db, IOptions<BudgetOptions> defaults, ILogger<SettingsService> logger)
{
    private const int SingletonId = 1;

    public async Task<AppSettings> GetAsync()
    {
        var settings = await db.Settings.FindAsync(SingletonId);
        if (settings is not null) return settings;

        // First run: create the row, starting from whatever is in configuration.
        settings = new AppSettings
        {
            Id = SingletonId,
            MonthlyIncome = defaults.Value.MonthlyIncome,
            MonthlyDebtBudget = defaults.Value.MonthlyDebtBudget
        };
        db.Settings.Add(settings);
        await db.SaveChangesAsync();

        logger.LogInformation("No settings yet, so created them from configuration (income £{Income}, debt budget £{Budget})",
            settings.MonthlyIncome, settings.MonthlyDebtBudget);
        return settings;
    }

    public async Task<AppSettings> UpdateAsync(decimal monthlyIncome, decimal? monthlyDebtBudget)
    {
        var settings = await GetAsync();
        settings.MonthlyIncome = monthlyIncome;
        settings.MonthlyDebtBudget = monthlyDebtBudget;
        settings.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        logger.LogInformation("Saved settings: income £{Income}, debt budget £{Budget}", monthlyIncome, monthlyDebtBudget);
        return settings;
    }

    // Where Apple Pay captures go when the card name doesn't match any account. Null means no fallback.
    public async Task<AppSettings> SetDefaultAccountAsync(int? accountId)
    {
        var settings = await GetAsync();
        var previous = settings.DefaultAccountId;
        settings.DefaultAccountId = accountId;
        settings.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        logger.LogInformation("Default capture account changed from {Previous} to {AccountId}", previous, accountId);
        return settings;
    }
}
