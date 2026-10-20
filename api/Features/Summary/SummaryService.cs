using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace LifeTracker.Api.Features.Summary;

public record CategoryTotal(string Category, decimal Total);

// One month at a glance: what I spent, what came in, what's left, and where the money went.
public record MonthlySummary(
    int Year,
    int Month,
    decimal TotalSpent,
    decimal MonthlyIncome,
    decimal Remaining,
    IReadOnlyList<CategoryTotal> ByCategory);

// The "Budget" section of configuration. It's only used to seed Settings the first time;
// after that, the values in the database win (see SettingsService).
public class BudgetOptions
{
    public decimal MonthlyIncome { get; set; }
    public decimal? MonthlyDebtBudget { get; set; }
}



// Works out the monthly summary on the dashboard: "how am I doing this month?"
public class SummaryService(AppDbContext db, SettingsService settings, ILogger<SummaryService> logger)
{
    public async Task<MonthlySummary> GetMonthlyAsync(int year, int month)
    {
        // From the 1st of the month up to (but not including) the 1st of the next.
        var start = new DateOnly(year, month, 1);
        var end = start.AddMonths(1);

        // Only Expenses are spending. A card repayment is a Transfer between my own accounts,
        // so it's left out here; otherwise every card purchase would be counted twice
        // (once when I bought it, once when I paid the card off).
        var totals = await db.Transactions
            .Where(t => t.Date >= start && t.Date < end && t.Type == TransactionType.Expense)
            .GroupBy(t => t.Category)
            .Select(g => new { Category = g.Key, Total = g.Sum(t => t.Amount) })
            .ToListAsync();

        var byCategory = totals
            .OrderByDescending(x => x.Total)
            .Select(x => new CategoryTotal(x.Category, x.Total))
            .ToList();

        var spent = byCategory.Sum(c => c.Total);

        // Income is the take-home pay from Settings for now, not the Income transactions.
        // Whether to switch is still to be decided.
        var income = (await settings.GetAsync()).MonthlyIncome;

        logger.LogDebug("Summary for {Year}-{Month:00}: spent £{Spent} of £{Income} across {Categories} categories",
            year, month, spent, income, byCategory.Count);

        return new MonthlySummary(year, month, spent, income, income - spent, byCategory);
    }
}
