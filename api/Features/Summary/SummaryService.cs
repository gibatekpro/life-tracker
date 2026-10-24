using LifeTracker.Api.Common;
using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Categories;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace LifeTracker.Api.Features.Summary;

public record CategoryTotal(string Category, decimal Total);

// One budget month at a glance: what I spent, what came in, what's left, and where the money went.
// PeriodStart/PeriodEnd are its first and last days (they follow payday if one is set).
// MonthlyIncome is the take-home pay setting or the recorded income, as IncomeMode says.
public record MonthlySummary(
    int Year,
    int Month,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    decimal TotalSpent,
    decimal MonthlyIncome,
    IncomeMode IncomeMode,
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
    // With no year and month, it's the period I'm in now (in UK time, and following payday).
    public async Task<MonthlySummary> GetMonthlyAsync(int? year = null, int? month = null)
    {
        var s = await settings.GetAsync();
        var period = year is { } y && month is { } m
            ? BudgetPeriod.For(y, m, s.MonthStartDay)
            : BudgetPeriod.Containing(UkDate.Today(), s.MonthStartDay);
        var (start, end) = (period.Start, period.End);

        // Only Expenses are spending. A card repayment is a Transfer between my own accounts,
        // so it's left out here; otherwise every card purchase would be counted twice
        // (once when I bought it, once when I paid the card off).
        // GbpAmount, not Amount: a ₦5,000 purchase counts as its £ value, not as £5,000.
        var totals = await db.Transactions
            .Where(t => t.Date >= start && t.Date < end && t.Type == TransactionType.Expense)
            .GroupBy(t => t.CategoryId)
            .Select(g => new { CategoryId = g.Key, Total = g.Sum(t => t.GbpAmount) })
            .ToListAsync();

        // Rolled up to the top-level categories, so "Subscriptions" includes AI, Claude and the rest.
        var categories = await db.Categories.Select(c => new { c.Id, c.ParentId, c.Name }).ToListAsync();
        var parents = categories.ToDictionary(c => c.Id, c => c.ParentId);
        var names = categories.ToDictionary(c => c.Id, c => c.Name);

        var byCategory = totals
            .GroupBy(x => x.CategoryId is { } id ? names[CategoryTree.TopLevel(id, parents)] : "Uncategorised")
            .Select(g => new CategoryTotal(g.Key, g.Sum(x => x.Total)))
            .OrderByDescending(x => x.Total)
            .ToList();

        var spent = byCategory.Sum(c => c.Total);

        var income = await IncomeAsync(s, period);

        logger.LogDebug("Summary for {Start} to {End}: spent £{Spent} of £{Income} ({IncomeMode}) across {Categories} categories",
            start, period.LastDay, spent, income, s.IncomeMode, byCategory.Count);

        return new MonthlySummary(period.Year, period.Month, start, period.LastDay,
            spent, income, s.IncomeMode, income - spent, byCategory);
    }

    // Either the take-home pay I've set, or what actually came in: the Income transactions for
    // this period, in pounds. Recorded suits pay that varies, or more than one income. Recorded
    // income counts from a few days before the period starts (Settings.EarlyIncomeDays), so a
    // salary paid early because payday fell on a weekend lands in the right month.
    // Also used by the budget, so both agree on what "income" means.
    public async Task<decimal> IncomeAsync(AppSettings s, BudgetPeriod period)
    {
        if (s.IncomeMode != IncomeMode.Recorded) return s.MonthlyIncome;

        var (from, to) = period.IncomeWindow(s.EarlyIncomeDays);
        return await db.Transactions
            .Where(t => t.Date >= from && t.Date < to && t.Type == TransactionType.Income)
            .SumAsync(t => t.GbpAmount);
    }
}
