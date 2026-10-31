using System.Globalization;
using LifeTracker.Api.Features.Summary;

namespace LifeTracker.Api.Features.Budgets;

// An expense category as the calculator sees it. DefaultAmount applies every month;
// MonthAmount is this month's own figure, which wins when set. All amounts are in pounds.
public record BudgetCategory(
    int Id, int? ParentId, string Name, int SortOrder, bool IsArchived,
    decimal? DefaultAmount, decimal? MonthAmount);

// A card or loan for the month, in pounds: its default (the account's monthly payment; null if a
// naira loan has no rate yet), this month's own figure, what's been paid in so far, and what the
// avalanche plan suggests paying. Then the same in the account's own currency, and Rate, the
// account currency -> GBP rate (1 for pounds; null with no rate yet). For a £ account the
// Native* figures can be left out: they're the £ ones.
public record DebtInput(
    int AccountId, string Name, decimal? DefaultAmount, decimal? MonthAmount, decimal Paid, decimal? Suggested,
    string Currency = "GBP", decimal? Rate = 1m,
    decimal? NativeDefault = null, decimal? NativeMonthAmount = null, decimal? NativePaid = null);

// A planned purchase for the month, in pounds: its monthly amount (the default, while it's active),
// this month's own figure, what was transferred into its savings account this month, and what was
// still needed at the start of the month (target - saved then), which caps the line.
public record SavingsInput(
    int PlannedPurchaseId, int AccountId, string Name, bool IsEssential, bool IsActive,
    decimal DefaultAmount, decimal? MonthAmount, decimal Paid, decimal StillNeeded);

public record BudgetInput(
    BudgetPeriod Period,
    DateOnly Today,
    decimal Income,
    IReadOnlyList<BudgetCategory> Categories,
    IReadOnlyDictionary<int, decimal> SpentByCategory,   // spending recorded directly on each category
    IReadOnlyList<DebtInput> Debts,
    decimal? FallbackDebtBudget,                         // Settings.MonthlyDebtBudget
    decimal? AvalancheBudget = null,                     // what the avalanche plan pays per month (its MonthlyBudget)
    IReadOnlyList<SavingsInput>? Savings = null);        // planned purchases; never part of the debt budget

// One category's line. Own* is the category itself; Planned and Spent include its subcategories.
public record BudgetLine(
    int CategoryId, string Name, bool IsArchived, decimal? DefaultAmount, decimal? MonthAmount,
    decimal OwnPlanned, decimal OwnSpent, decimal Planned, decimal Spent, decimal Remaining,
    decimal? PercentUsed, decimal Projected, decimal DailyAllowance, IReadOnlyList<BudgetLine> Children);

// A debt's line, in pounds (what counts in the month's totals), then in its own currency (what I
// see and set for a naira loan). NativeSuggested is the avalanche suggestion converted back.
public record DebtLine(
    int AccountId, string Name, decimal? DefaultAmount, decimal? MonthAmount, decimal Planned, decimal Paid,
    decimal Remaining, decimal? PercentUsed, decimal? Suggested,
    string Currency, decimal? Rate, decimal? NativeDefault, decimal? NativeMonthAmount, decimal NativePlanned,
    decimal NativePaid, decimal NativeRemaining, decimal? NativeSuggested);

// A planned purchase's line: this month's figure or its monthly amount, never more than StillNeeded
// (so 0 once the target's reached). Paid is what went into its savings account this month.
public record SavingsLine(
    int PlannedPurchaseId, int AccountId, string Name, bool IsEssential, decimal DefaultAmount, decimal? MonthAmount,
    decimal StillNeeded, decimal Planned, decimal Paid, decimal Remaining, decimal? PercentUsed);

// AvalancheExtra: what the avalanche plan pays beyond the debt lines (e.g. a £800 debt budget
// against £565.95 of card payments), so the month's debt total is what the plan actually pays.
// AvalancheExtraPaid: payments beyond each debt's own line, which go towards it.
public record BudgetMonth(
    int Year, int Month, DateOnly PeriodStart, DateOnly PeriodEnd,
    int DaysInPeriod, int DaysElapsed, int DaysLeft,
    decimal Income, decimal PlannedSpending, decimal PlannedDebts, decimal PlannedSavings, decimal TotalPlanned, decimal Unallocated,
    decimal Spent, decimal DebtPaid, decimal SavingsPaid, decimal SafeToSpend, decimal SafeToSpendPerDay,
    bool HasMonthDebtAmounts, decimal? DebtBudget,
    decimal AvalancheExtra, decimal AvalancheExtraPaid,
    IReadOnlyList<BudgetLine> Lines, IReadOnlyList<DebtLine> Debts, IReadOnlyList<SavingsLine> Savings);

// Works out a budget month: for every category, debt and planned purchase, what's planned, what's gone, what's left,
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

            // In the account's own currency (for a £ account, the same figures).
            var native = d.Currency == "GBP";
            var nativeDefault = native ? d.DefaultAmount : d.NativeDefault;
            var nativeMonth = native ? d.MonthAmount : d.NativeMonthAmount;
            var nativePlanned = nativeMonth ?? nativeDefault ?? 0;
            var nativePaid = native ? d.Paid : d.NativePaid ?? 0;
            // The plan works in pounds; its suggestion back in the account's currency. When it's just
            // the line's default or month figure, use that exactly: converting a rounded £ figure back
            // would turn a ₦170,574 instalment into ₦170,576.92.
            var nativeSuggested = native ? d.Suggested
                : d.Suggested is not { } s ? null
                : s == d.DefaultAmount ? d.NativeDefault
                : s == d.MonthAmount ? d.NativeMonthAmount
                : d.Rate is > 0 ? Math.Round(s / d.Rate.Value, 2) : null;

            return new DebtLine(d.AccountId, d.Name, d.DefaultAmount, d.MonthAmount, planned, d.Paid,
                planned - d.Paid, Percent(d.Paid, planned), d.Suggested,
                d.Currency, d.Rate, nativeDefault, nativeMonth, nativePlanned, nativePaid,
                nativePlanned - nativePaid, nativeSuggested);
        }).ToList();

        // A planned purchase's default only applies while it's active, but a figure set for the month
        // does (like an archived category). Either way, never more than is still needed.
        var savings = (input.Savings ?? []).Select(s =>
        {
            var planned = Math.Min(s.MonthAmount ?? (s.IsActive ? s.DefaultAmount : 0), Math.Max(0, s.StillNeeded));
            return new SavingsLine(s.PlannedPurchaseId, s.AccountId, s.Name, s.IsEssential, s.DefaultAmount, s.MonthAmount,
                s.StillNeeded, planned, s.Paid, planned - s.Paid, Percent(s.Paid, planned));
        }).ToList();

        var plannedSpending = lines.Sum(l => l.Planned);
        var spentTotal = lines.Sum(l => l.Spent);
        var debtPaid = debts.Sum(d => d.Paid);
        var plannedSavings = savings.Sum(s => s.Planned);
        var savingsPaid = savings.Sum(s => s.Paid);

        // The debt total is what the avalanche plan pays, so unallocated and safe-to-spend match the
        // plan: anything it pays beyond the debt lines is an extra line. Paying more than a debt's own
        // line goes towards that extra.
        var debtLines = debts.Sum(d => d.Planned);
        var extra = input.AvalancheBudget is { } plan && plan > debtLines ? plan - debtLines : 0;
        var extraPaid = Math.Min(extra, debts.Sum(d => Math.Max(0, -d.Remaining)));
        var plannedDebts = debtLines + extra;

        // Money still set aside: what's left on each line's own amount (an overspent line holds nothing
        // back), what's still to pay on each debt and each planned purchase, and what's left of the
        // avalanche extra. Safe to spend is what isn't spent, paid, saved or set aside.
        var reserved = Flatten(lines).Sum(l => Math.Max(0, l.OwnPlanned - l.OwnSpent))
                       + debts.Sum(d => Math.Max(0, d.Remaining))
                       + savings.Sum(s => Math.Max(0, s.Remaining))
                       + (extra - extraPaid);
        var safe = input.Income - spentTotal - debtPaid - savingsPaid - reserved;

        // Decision 1: once any debt amount is set for this month, the month's debt lines are the
        // avalanche plan's budget; until then it uses the monthly debt budget from Settings.
        var hasMonthDebtAmounts = input.Debts.Any(d => d.MonthAmount is not null || d.NativeMonthAmount is not null);

        return new BudgetMonth(
            p.Year, p.Month, p.Start, p.LastDay, days, elapsed, left,
            input.Income, plannedSpending, plannedDebts, plannedSavings, plannedSpending + plannedDebts + plannedSavings,
            input.Income - plannedSpending - plannedDebts - plannedSavings,
            spentTotal, debtPaid, savingsPaid, safe, PerDay(safe, left),
            hasMonthDebtAmounts, hasMonthDebtAmounts ? debtLines : input.FallbackDebtBudget,
            extra, extraPaid,
            lines, debts, savings);
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
