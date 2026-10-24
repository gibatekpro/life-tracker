using LifeTracker.Api.Features.Accounts;

namespace LifeTracker.Api.Tests;

public class CurrenciesTests
{
    [Fact]
    public void TransferRate_InItsOwnDirection()
    {
        Assert.Equal(1800m, Currencies.RateFromTransfer("GBP", "NGN", "GBP", 10m, "NGN", 18000m));
    }

    [Fact]
    public void TransferRate_TheOtherWay()
    {
        Assert.Equal(1m / 1800m, Currencies.RateFromTransfer("NGN", "GBP", "GBP", 10m, "NGN", 18000m));
    }

    [Theory]
    [InlineData("GBP", "GBP")]   // pounds to pounds says nothing about naira
    [InlineData("NGN", "NGN")]
    [InlineData("GBP", "EUR")]   // a different currency
    public void TransferNotBetweenTheTwoCurrencies_GivesNoRate(string sent, string received)
    {
        Assert.Null(Currencies.RateFromTransfer("GBP", "NGN", sent, 10m, received, 18000m));
    }

    [Fact]
    public void ZeroAmount_GivesNoRate()
    {
        Assert.Null(Currencies.RateFromTransfer("GBP", "NGN", "GBP", 0m, "NGN", 18000m));
    }

    [Theory]
    [InlineData("GBP", true)]
    [InlineData("NGN", true)]
    [InlineData("JPY", false)]
    [InlineData(null, false)]
    public void Supported_IsTheFixedList(string? code, bool expected)
    {
        Assert.Equal(expected, Currencies.IsSupported(code));
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
