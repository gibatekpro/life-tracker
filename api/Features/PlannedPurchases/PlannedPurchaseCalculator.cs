using System.Globalization;
using LifeTracker.Api.Models;

namespace LifeTracker.Api.Features.PlannedPurchases;

// How I choose a plan: exactly one of these, and the calculator works out the other two.
// A closed set of records (like a TypeScript union): Plan's switch handles each one.
public abstract record PlanBy;
public sealed record ByMonthlyAmount(decimal Amount) : PlanBy;
public sealed record ByMonths(int Months) : PlanBy;
public sealed record ByTargetMonth(DateOnly Month) : PlanBy;   // the 1st of the last month I save in

// MonthlyAmount for Months months, ending in TargetMonth; the last month is LastAmount, which may be smaller.
public record PurchasePlan(decimal MonthlyAmount, int Months, DateOnly TargetMonth, decimal LastAmount);

// Either a plan, or why there can't be one (a message to show).
public record PlanResult(PurchasePlan? Plan, string? Error);

// A planned purchase now. Saved is its account's balance. Contributed* are the transfers in since
// StartMonth: before this month, and in it. Months are the 1st of the month.
public record ProgressInput(
    decimal Target, decimal Saved, decimal MonthlyAmount, DateOnly StartMonth, DateOnly TargetMonth,
    DateOnly CurrentMonth, decimal ContributedBefore, decimal ContributedThisMonth);

// Percent is rounded down (99.9% until it's really there). NeededByNow: what should be saved by now
// for the monthly amount to reach the target by the target month. ExpectedFinish: the month it's
// reached at the pace so far, or null if that's not within MaxMonths (or nothing is coming in).
public record PurchaseProgress(
    decimal Saved, decimal Remaining, decimal Percent, decimal NeededByNow, bool OnTrack, int MonthsLeft,
    DateOnly? ExpectedFinish);

// The maths of saving for something: a plan from a target and one choice, how it's going, and when it
// should finish. Pure (no database), like BudgetCalculator, so every rule is a unit test. Mirrored in
// @lifetracker/core (plannedPurchases.ts) with the same test cases, so the forms preview instantly.
public static class PlannedPurchaseCalculator
{
    public const int MaxMonths = 120;

    public static PlanResult Plan(decimal target, decimal saved, DateOnly currentMonth, PlanBy by)
    {
        target = ToPenny(target);
        if (target <= 0) return Fail("Enter a target above zero.");
        var remaining = target - Math.Max(0, saved);
        if (remaining <= 0) return Fail($"That's already saved: {Pounds(saved)} of {Pounds(target)}.");

        switch (by)
        {
            case ByMonthlyAmount { Amount: var raw }:
                var amount = ToPenny(raw);
                if (amount <= 0) return Fail("Enter a monthly amount above zero.");
                var needed = Math.Ceiling(remaining / amount);
                if (needed > MaxMonths)
                    return Fail($"At {Pounds(amount)} a month that takes {needed:0} months; the most is {MaxMonths}.");
                return Ok(remaining, amount, currentMonth);

            case ByMonths { Months: var months }:
                if (months is < 1 or > MaxMonths) return Fail($"Choose 1 to {MaxMonths} months.");
                return Ok(remaining, UpToPenny(remaining / months), currentMonth);

            case ByTargetMonth { Month: var month }:
                var last = FirstOfMonth(month);
                if (last < currentMonth) return Fail("The target month can't be in the past.");
                var count = MonthsBetween(currentMonth, last) + 1;
                if (count > MaxMonths) return Fail($"Choose a target month within {MaxMonths} months.");
                return Ok(remaining, UpToPenny(remaining / count), currentMonth);

            default:
                throw new ArgumentOutOfRangeException(nameof(by));
        }
    }

    public static PurchaseProgress Progress(ProgressInput p)
    {
        var saved = Math.Max(0, p.Saved);
        var remaining = Math.Max(0, p.Target - saved);
        var percent = p.Target > 0 ? Math.Min(100, Math.Floor(saved * 1000 / p.Target) / 10) : 0;

        // Counting this month: on track means the monthly amount over the months left still gets there.
        var monthsLeft = Math.Max(0, MonthsBetween(p.CurrentMonth, p.TargetMonth) + 1);
        var neededByNow = Math.Max(0, p.Target - p.MonthlyAmount * monthsLeft);

        // The pace: what came in per month since the start, counting this month once money has come in
        // (until then, this month's payment may still be on its way). With nothing to go on yet, the plan.
        // More months = remaining ÷ pace, written as remaining × months ÷ contributed so it stays exact.
        var paidThisMonth = p.ContributedThisMonth > 0;
        var counted = Math.Max(0, MonthsBetween(p.StartMonth, p.CurrentMonth)) + (paidThisMonth ? 1 : 0);
        var contributed = p.ContributedBefore + p.ContributedThisMonth;
        decimal? more = counted == 0 ? (p.MonthlyAmount > 0 ? Math.Ceiling(remaining / p.MonthlyAmount) : null)
            : contributed > 0 ? Math.Ceiling(remaining * counted / contributed) : null;

        DateOnly? finish = null;
        if (remaining == 0) finish = p.CurrentMonth;
        // This month still counts as a saving month until money has come in.
        else if (more <= MaxMonths) finish = p.CurrentMonth.AddMonths((int)more.Value - (paidThisMonth ? 0 : 1));

        return new PurchaseProgress(saved, remaining, percent, neededByNow, remaining == 0 || saved >= neededByNow,
            monthsLeft, finish);
    }

    // Achieved follows the money: reached means Achieved, and taking money back out means Active again.
    // Bought and Cancelled are my decisions, so they never change by themselves.
    public static PlannedPurchaseStatus StatusFor(PlannedPurchaseStatus status, decimal saved, decimal target) => status switch
    {
        PlannedPurchaseStatus.Active when saved >= target => PlannedPurchaseStatus.Achieved,
        PlannedPurchaseStatus.Achieved when saved < target => PlannedPurchaseStatus.Active,
        _ => status
    };

    // Whole months from one month to another: November to January is 2.
    public static int MonthsBetween(DateOnly from, DateOnly to) => (to.Year - from.Year) * 12 + to.Month - from.Month;

    public static DateOnly FirstOfMonth(DateOnly date) => new(date.Year, date.Month, 1);

    // The monthly amount, rounded up so the months cover it; the count follows from it, so the last
    // month takes what's left (smaller, never zero).
    private static PlanResult Ok(decimal remaining, decimal monthly, DateOnly currentMonth)
    {
        var months = (int)Math.Ceiling(remaining / monthly);
        return new PlanResult(new PurchasePlan(monthly, months, currentMonth.AddMonths(months - 1), remaining - monthly * (months - 1)), null);
    }

    private static decimal UpToPenny(decimal amount) => Math.Ceiling(amount * 100) / 100;

    // Half a penny rounds up, as JavaScript's Math.round does in the core copy.
    private static decimal ToPenny(decimal amount) => Math.Round(amount, 2, MidpointRounding.AwayFromZero);

    private static PlanResult Fail(string error) => new(null, error);

    private static string Pounds(decimal amount) => string.Create(CultureInfo.InvariantCulture, $"£{amount:#,0.00}");
}
