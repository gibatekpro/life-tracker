using System.Globalization;
using LifeTracker.Api.Features.Summary;

namespace LifeTracker.Api.Features.Budgets;

// An expense category as the calculator sees it. DefaultAmount applies every month;
// MonthAmount is this month's own figure, which wins when set. All amounts are in pounds.
public record BudgetCategory(
    int Id, int? ParentId, string Name, int SortOrder, bool IsArchived,
    decimal? DefaultAmount, decimal? MonthAmount);

// A card or loan for the month: its default (the account's monthly payment, in pounds; null if a
// naira loan has no rate yet), this month's own figure, what's been paid in so far, and what
// the avalanche plan suggests paying.
public record DebtInput(
    int AccountId, string Name, decimal? DefaultAmount, decimal? MonthAmount, decimal Paid, decimal? Suggested);

public record BudgetInput(
    BudgetPeriod Period,
    DateOnly Today,
    decimal Income,
    IReadOnlyList<BudgetCategory> Categories,
    IReadOnlyDictionary<int, decimal> SpentByCategory,   // spending recorded directly on each category
    IReadOnlyList<DebtInput> Debts,
    decimal? FallbackDebtBudget);                        // Settings.MonthlyDebtBudget

// One category's line. Own* is the category itself; Planned and Spent include its subcategories.
public record BudgetLine(
    int CategoryId, string Name, bool IsArchived, decimal? DefaultAmount, decimal? MonthAmount,
    decimal OwnPlanned, decimal OwnSpent, decimal Planned, decimal Spent, decimal Remaining,
    decimal? PercentUsed, decimal Projected, decimal DailyAllowance, IReadOnlyList<BudgetLine> Children);

public record DebtLine(
    int AccountId, string Name, decimal? DefaultAmount, decimal? MonthAmount, decimal Planned, decimal Paid,
    decimal Remaining, decimal? PercentUsed, decimal? Suggested);

public record BudgetMonth(
    int Year, int Month, DateOnly PeriodStart, DateOnly PeriodEnd,
    int DaysInPeriod, int DaysElapsed, int DaysLeft,
    decimal Income, decimal PlannedSpending, decimal PlannedDebts, decimal TotalPlanned, decimal Unallocated,
    decimal Spent, decimal DebtPaid, decimal SafeToSpend, decimal SafeToSpendPerDay,
    bool HasMonthDebtAmounts, decimal? DebtBudget,
    IReadOnlyList<BudgetLine> Lines, IReadOnlyList<DebtLine> Debts);

// Works out a budget month: for every category and debt, what's planned, what's gone, what's left,
// and whether spending is on pace; then the month's totals and how much is safe to spend per day.
//
// Pure (no database, no logging), like BalanceRules and AvalanchePlanner, so each rule is a unit
// test. BudgetService gathers the numbers from the database and hands them in.
public static class BudgetCalculator
{
    public static BudgetMonth Calculate(BudgetInput input)
    {
        var p = input.Period;
        var days = p.End.DayNumber - p.Start.DayNumber;

        // Days gone, counting today; and days left, counting today. A past month has none left;
        // a month that hasn't started has none gone.
        var elapsed = Math.Clamp(input.Today.DayNumber - p.Start.DayNumber + 1, 0, days);
        var left = Math.Clamp(p.End.DayNumber - input.Today.DayNumber, 0, days);

        var byParent = input.Categories.ToLookup(c => c.ParentId);
        var lines = Build(null).ToList();

        BudgetLine? Line(BudgetCategory c)
        {
            var children = Build(c.Id).ToList();
            // An archived category's default no longer applies, but a figure set for this month does.
            var ownPlanned = c.MonthAmount ?? (c.IsArchived ? null : c.DefaultAmount);
            var ownSpent = input.SpentByCategory.GetValueOrDefault(c.Id);

            // Only categories with a budget, some spending, or a subcategory that has either.
            if (ownPlanned is null && ownSpent == 0 && children.Count == 0) return null;

            var planned = (ownPlanned ?? 0) + children.Sum(x => x.Planned);
            var spent = ownSpent + children.Sum(x => x.Spent);
            return new BudgetLine(
                c.Id, c.Name, c.IsArchived, c.DefaultAmount, c.MonthAmount,
                ownPlanned ?? 0, ownSpent, planned, spent, planned - spent,
                Percent(spent, planned), Projected(spent, elapsed, days), PerDay(planned - spent, left), children);
        }

        IEnumerable<BudgetLine> Build(int? parentId) =>
            byParent[parentId].OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
                .Select(Line).OfType<BudgetLine>();

        var debts = input.Debts.Select(d =>
        {
            var planned = d.MonthAmount ?? d.DefaultAmount ?? 0;
            return new DebtLine(d.AccountId, d.Name, d.DefaultAmount, d.MonthAmount, planned, d.Paid,
                planned - d.Paid, Percent(d.Paid, planned), d.Suggested);
        }).ToList();

        var plannedSpending = lines.Sum(l => l.Planned);
        var plannedDebts = debts.Sum(d => d.Planned);
        var spentTotal = lines.Sum(l => l.Spent);
        var debtPaid = debts.Sum(d => d.Paid);

        // Money still set aside: what's left on each line's own amount (an overspent line holds nothing
        // back), and what's still to pay on each debt. Safe to spend is what isn't spent or set aside.
        var reserved = Flatten(lines).Sum(l => Math.Max(0, l.OwnPlanned - l.OwnSpent))
                       + debts.Sum(d => Math.Max(0, d.Remaining));
        var safe = input.Income - spentTotal - debtPaid - reserved;

        // Decision 1: once any debt amount is set for this month, the month's debt lines are the
        // avalanche plan's budget; until then it uses the monthly debt budget from Settings.
        var hasMonthDebtAmounts = input.Debts.Any(d => d.MonthAmount is not null);

        return new BudgetMonth(
            p.Year, p.Month, p.Start, p.LastDay, days, elapsed, left,
            input.Income, plannedSpending, plannedDebts, plannedSpending + plannedDebts,
            input.Income - plannedSpending - plannedDebts,
            spentTotal, debtPaid, safe, PerDay(safe, left),
            hasMonthDebtAmounts, hasMonthDebtAmounts ? plannedDebts : input.FallbackDebtBudget,
            lines, debts);
    }

    // The line that a category's spending is measured against: the category itself if it has a
    // budget, otherwise the nearest parent that does. Null if none of them has one.
    public static BudgetLine? LineFor(BudgetMonth month, int categoryId, IReadOnlyList<BudgetCategory> categories)
    {
        var lines = Flatten(month.Lines).ToDictionary(l => l.CategoryId);
        var parents = categories.ToDictionary(c => c.Id, c => c.ParentId);

        for (int? id = categoryId; id is { } current; id = parents.GetValueOrDefault(current))
            if (lines.TryGetValue(current, out var line) && line.Planned > 0) return line;
        return null;
    }

    // The text for the Apple Pay notification: "Food: £150.00 of £200.00 · £3.20/day left".
    // Invariant culture, so it's "150.00" whatever the server's language settings.
    public static string Notification(BudgetLine line) =>
        line.Remaining < 0
            ? string.Create(CultureInfo.InvariantCulture, $"{line.Name}: £{line.Spent:0.00} of £{line.Planned:0.00} · £{-line.Remaining:0.00} over")
            : string.Create(CultureInfo.InvariantCulture, $"{line.Name}: £{line.Spent:0.00} of £{line.Planned:0.00} · £{line.DailyAllowance:0.00}/day left");

    public static IEnumerable<BudgetLine> Flatten(IEnumerable<BudgetLine> lines) =>
        lines.SelectMany(l => Flatten(l.Children).Prepend(l));

    // Percent of the budget used, or null when nothing was budgeted.
    private static decimal? Percent(decimal spent, decimal planned) =>
        planned > 0 ? Math.Round(spent / planned * 100, 1) : null;

    // Where spending is heading by the end of the month at today's pace.
    private static decimal Projected(decimal spent, int elapsed, int days) =>
        elapsed == 0 || elapsed == days ? spent : Math.Round(spent / elapsed * days, 2);

    // What can go per day for the rest of the month without going over (never below zero).
    private static decimal PerDay(decimal remaining, int daysLeft) =>
        daysLeft > 0 && remaining > 0 ? Math.Round(remaining / daysLeft, 2) : 0;
}
