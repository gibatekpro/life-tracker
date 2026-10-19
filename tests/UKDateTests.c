using LifeTracker.Api.Common;

namespace LifeTracker.Api.Tests;

public class UkDateTests
{
    [Fact]
    public void LateEveningInSummer_IsAlreadyTheNextDayInTheUk()
    {
        // 23:30 UTC in July is 00:30 BST the next day.
        var utc = new DateTimeOffset(2026, 7, 1, 23, 30, 0, TimeSpan.Zero);
        Assert.Equal(new DateOnly(2026, 7, 2), UkDate.FromUtc(utc));
    }

    [Fact]
    public void LateEveningInWinter_IsTheSameDay()
    {
        // In winter the UK is on GMT, so UTC and UK time match.
        var utc = new DateTimeOffset(2026, 12, 1, 23, 30, 0, TimeSpan.Zero);
        Assert.Equal(new DateOnly(2026, 12, 1), UkDate.FromUtc(utc));
    }
}