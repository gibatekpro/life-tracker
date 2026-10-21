using LifeTracker.Api.Features.Summary;

namespace LifeTracker.Api.Tests;

public class BudgetPeriodTests
{
    [Fact]
    public void StartDayOne_IsTheCalendarMonth()
    {
        var p = BudgetPeriod.For(2026, 10, 1);

        Assert.Equal(new DateOnly(2026, 10, 1), p.Start);
        Assert.Equal(new DateOnly(2026, 10, 31), p.LastDay);
        Assert.Equal(new DateOnly(2026, 11, 1), p.End);
    }

    [Fact]
    public void Payday_RunsToTheDayBeforeNextPayday()
    {
        var p = BudgetPeriod.For(2026, 10, 25);

        Assert.Equal(new DateOnly(2026, 10, 25), p.Start);
        Assert.Equal(new DateOnly(2026, 11, 24), p.LastDay);
    }

    [Fact]
    public void DecemberPeriod_EndsInJanuary()
    {
        var p = BudgetPeriod.For(2026, 12, 25);

        Assert.Equal(new DateOnly(2027, 1, 24), p.LastDay);
    }

    [Theory]
    [InlineData(2026, 10, 24, 2026, 9)]    // the day before payday is still September's period
    [InlineData(2026, 10, 25, 2026, 10)]   // payday starts October's period
    [InlineData(2026, 11, 3, 2026, 10)]    // early November is still October's period
    [InlineData(2026, 1, 10, 2025, 12)]    // before January's payday it's December's period
    public void Containing_FollowsPayday(int y, int m, int d, int expectedYear, int expectedMonth)
    {
        var p = BudgetPeriod.Containing(new DateOnly(y, m, d), 25);

        Assert.Equal((expectedYear, expectedMonth), (p.Year, p.Month));
    }

    [Fact]
    public void Containing_WithStartDayOne_IsTheDatesMonth()
    {
        var p = BudgetPeriod.Containing(new DateOnly(2026, 3, 31), 1);

        Assert.Equal((2026, 3), (p.Year, p.Month));
    }

    [Fact]
    public void StartDay28_WorksInFebruary()
    {
        var p = BudgetPeriod.For(2027, 2, 28);

        Assert.Equal(new DateOnly(2027, 3, 27), p.LastDay);
    }
}
