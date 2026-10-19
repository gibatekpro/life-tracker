namespace LifeTracker.Api.Common;

public static class UkDate
{
    private static readonly TimeZoneInfo London =
        TimeZoneInfo.FindSystemTimeZoneById("Europe/London");

    public static DateOnly FromUtc(DateTimeOffset utc) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(utc, London).DateTime);

    public static DateOnly Today() => FromUtc(DateTimeOffset.UtcNow);
}