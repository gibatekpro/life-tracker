using LifeTracker.Api.Features.Debts;

namespace LifeTracker.Api.Tests;

public class DebtPayoffCalculatorTests
{
    private static readonly DateOnly Start = new(2026, 10, 1);

    [Fact]
    public void ZeroBalance_IsAlreadyPaidOff()
    {
        var result = DebtPayoffCalculator.Calculate(0m, 24.9m, 100m, Start);

        Assert.True(result.CanBePaidOff);
        Assert.Equal(0, result.Months);
        Assert.Equal(0m, result.TotalInterest);
    }

    [Fact]
    public void PaymentBelowInterest_CannotBePaidOff()
    {
        // £5,000 at 24.9% builds about £103.75 interest in month one, so £100 never gets ahead.
        var result = DebtPayoffCalculator.Calculate(5000m, 24.9m, 100m, Start);

        Assert.False(result.CanBePaidOff);
        Assert.Null(result.PayoffDate);
    }

    [Fact]
    public void ZeroApr_IsSimpleDivision()
    {
        var result = DebtPayoffCalculator.Calculate(1000m, 0m, 100m, Start);

        Assert.True(result.CanBePaidOff);
        Assert.Equal(10, result.Months);
        Assert.Equal(0m, result.TotalInterest);
        Assert.Equal(1000m, result.TotalPaid);
        Assert.Equal(new DateOnly(2027, 8, 1), result.PayoffDate);
    }

    [Fact]
    public void LastPayment_IsOnlyWhatIsLeft()
    {
        // 100 + 100 + 50, not 300
        var result = DebtPayoffCalculator.Calculate(250m, 0m, 100m, Start);

        Assert.Equal(3, result.Months);
        Assert.Equal(250m, result.TotalPaid);
    }

    [Theory]
    [InlineData(150, 58, 3593.58)]
    [InlineData(250, 27, 1526.62)]
    [InlineData(350, 18, 992.08)]
    public void KnownScenarios_MatchExpectedMonthsAndInterest(
        int payment, int expectedMonths, double expectedInterest)
    {
        var result = DebtPayoffCalculator.Calculate(5000m, 24.9m, payment, Start);

        Assert.True(result.CanBePaidOff);
        Assert.Equal(expectedMonths, result.Months);
        Assert.Equal((decimal)expectedInterest, result.TotalInterest);
    }
}