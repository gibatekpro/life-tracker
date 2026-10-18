using LifeTracker.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace LifeTracker.Api.Features.Summary;

public record CategoryTotal(string Category, decimal Total);

public record MonthlySummary(
    int Year,
    int Month,
    decimal TotalSpent,
    decimal MonthlyIncome,
    decimal Remaining,
    IReadOnlyList<CategoryTotal> ByCategory);

public class BudgetOptions
{
    public decimal MonthlyIncome { get; set; }
    public decimal? MonthlyDebtBudget { get; set; }
}

public class SummaryService(AppDbContext db, IOptions<BudgetOptions> budget)
{
    public async Task<MonthlySummary> GetMonthlyAsync(int year, int month)
    {
        var start = new DateOnly(year, month, 1);
        var end = start.AddMonths(1);

        var totals = await db.Transactions
            .Where(t => t.Date >= start && t.Date < end)
            .GroupBy(t => t.Category)
            .Select(g => new { Category = g.Key, Total = g.Sum(t => t.Amount) })
            .ToListAsync();

        var byCategory = totals
            .OrderByDescending(x => x.Total)
            .Select(x => new CategoryTotal(x.Category, x.Total))
            .ToList();

        var spent = byCategory.Sum(c => c.Total);
        var income = budget.Value.MonthlyIncome;

        return new MonthlySummary(year, month, spent, income, income - spent, byCategory);
    }
}