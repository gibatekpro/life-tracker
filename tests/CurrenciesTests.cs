using LifeTracker.Api.Features.Accounts;

namespace LifeTracker.Api.Tests;

public class CurrenciesTests
{
    [Fact]
    public void PoundsToNaira_GivesNairaPerPound()
    {
        Assert.Equal(1800m, Currencies.RatePerPound("NGN", "GBP", 10m, "NGN", 18000m));
    }

    [Fact]
    public void NairaToPounds_GivesTheSameKindOfRate()
    {
        Assert.Equal(1800m, Currencies.RatePerPound("NGN", "NGN", 18000m, "GBP", 10m));
    }

    [Theory]
    [InlineData("GBP", "GBP")]   // pounds to pounds says nothing about naira
    [InlineData("NGN", "NGN")]
    [InlineData("GBP", "EUR")]   // a different currency
    public void TransferNotBetweenPoundsAndTheCurrency_GivesNoRate(string from, string to)
    {
        Assert.Null(Currencies.RatePerPound("NGN", from, 10m, to, 18000m));
    }

    [Fact]
    public void ZeroAmount_GivesNoRate()
    {
        Assert.Null(Currencies.RatePerPound("NGN", "GBP", 0m, "NGN", 18000m));
    }

    [Theory]
    [InlineData(5000, 1800, 2.78)]
    [InlineData(18000, 1800, 10.00)]
    [InlineData(1, 1800, 0.00)]
    public void ToPounds_ConvertsAndRoundsToThePenny(int naira, int rate, double expected)
    {
        Assert.Equal((decimal)expected, Currencies.ToPounds(naira, rate));
    }

    [Theory]
    [InlineData("ngn", "NGN")]
    [InlineData(" GBP ", "GBP")]
    [InlineData("naira", null)]
    [InlineData("N1", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void Normalise_AcceptsThreeLetterCodesOnly(string? code, string? expected)
    {
        Assert.Equal(expected, Currencies.Normalise(code));
    }
}
