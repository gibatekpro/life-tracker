using LifeTracker.Api.Features.Capture;

namespace LifeTracker.Api.Tests;

public class CaptureParsingTests
{
    [Theory]
    [InlineData("£4.50", 4.50)]
    [InlineData("4.50", 4.50)]
    [InlineData("£1,234.56", 1234.56)]
    [InlineData(" £0.35 ", 0.35)]
    public void AmountParser_ReadsValidAmounts(string raw, double expected)
    {
        Assert.True(AmountParser.TryParse(raw, out var amount));
        Assert.Equal((decimal)expected, amount);
    }

    [Theory]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("-£3.00")]
    [InlineData(null)]
    public void AmountParser_RejectsInvalidAmounts(string? raw)
    {
        Assert.False(AmountParser.TryParse(raw, out _));
    }

    [Theory]
    [InlineData("CRV*JOLLY VENDING SERV", "Food")]
    [InlineData("Tesco Express", "Food")]
    [InlineData("Centrebus Leicester", "Transport")]
    [InlineData("Some Random Shop", "Other")]
    public void CategoryGuesser_MatchesKeywords(string merchant, string expected)
    {
        Assert.Equal(expected, CategoryGuesser.Guess(merchant));
    }
}