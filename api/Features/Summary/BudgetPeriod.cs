namespace LifeTracker.Api.Features.Summary;

// One budget "month". With payday on the 25th, the October period runs from 25 October to
// 24 November, so one pay packet isn't split across two calendar months. With a start day of 1,
// it's just the calendar month. End is exclusive: the period is Start <= date < End.
//
// The start day is limited to 1-28 so every month has it (there's no 30 February).
// Pure, like BalanceRules, so it's easy to test.
public record BudgetPeriod(int Year, int Month, DateOnly Start, DateOnly End)
{
    public const int LatestStartDay = 28;

    public DateOnly LastDay => End.AddDays(-1);

    // The period named after `month`: it starts on startDay of that month.
    public static BudgetPeriod For(int year, int month, int startDay)
    {
        var start = new DateOnly(year, month, startDay);
        return new BudgetPeriod(year, month, start, start.AddMonths(1));
    }

    // The period a date falls in. Before payday, it's still the previous month's period.
    public static BudgetPeriod Containing(DateOnly date, int startDay)
    {
        var thisMonth = For(date.Year, date.Month, startDay);
        if (date >= thisMonth.Start) return thisMonth;

        var previous = thisMonth.Start.AddMonths(-1);
        return For(previous.Year, previous.Month, startDay);
    }
}
