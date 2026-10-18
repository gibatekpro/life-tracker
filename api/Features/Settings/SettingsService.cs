using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Summary;
using LifeTracker.Api.Models;
using Microsoft.Extensions.Options;

namespace LifeTracker.Api.Features.Settings;

public class SettingsService(AppDbContext db, IOptions<BudgetOptions> defaults)
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
        return settings;
    }

    public async Task<AppSettings> UpdateAsync(decimal monthlyIncome, decimal? monthlyDebtBudget)
    {
        var settings = await GetAsync();
        settings.MonthlyIncome = monthlyIncome;
        settings.MonthlyDebtBudget = monthlyDebtBudget;
        settings.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return settings;
    }
}