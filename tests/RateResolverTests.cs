using LifeTracker.Api.Features.Accounts;

namespace LifeTracker.Api.Tests;

public class RateResolverTests
{
    private static readonly DateTime Set = new(2026, 10, 20, 9, 0, 0, DateTimeKind.Utc);
    private static readonly ManualRate GbpToNgn = new("GBP", "NGN", 1850m, Set);
    private static readonly ManualRate NgnToGbp = new("NGN", "GBP", 0.00052m, Set);

    // £10 sent, ₦18,000 received: 1,800 per pound.
    private static readonly TransferRateSource Transfer = new(new DateOnly(2026, 10, 1), "GBP", 10m, "NGN", 18000m);

    [Fact]
    public void ManualRate_IsUsedForItsOwnDirection()
    {
        var quote = RateResolver.Resolve("NGN", "GBP", [GbpToNgn, NgnToGbp], Transfer, preferTransfer: false);

        Assert.Equal((0.00052m, RateSource.Manual), (quote.Rate, quote.Source));
        Assert.Equal(Set, quote.UpdatedAt);
    }

    [Fact]
    public void BothDirections_CanDiffer()
    {
        var there = RateResolver.Resolve("GBP", "NGN", [GbpToNgn, NgnToGbp], null, false);
        var back = RateResolver.Resolve("NGN", "GBP", [GbpToNgn, NgnToGbp], null, false);

        Assert.Equal(1850m, there.Rate);
        Assert.Equal(0.00052m, back.Rate);   // not 1/1850: converting back costs more
    }

    [Fact]
    public void OnlyOneDirectionSet_TheOtherUsesItsInverse()
    {
        var quote = RateResolver.Resolve("NGN", "GBP", [GbpToNgn], Transfer, false);

        Assert.Equal(RateSource.InverseOfManual, quote.Source);
        Assert.Equal(1m / 1850m, quote.Rate);
    }

    [Fact]
    public void NoManualRate_UsesTheLatestTransfer_InEitherDirection()
    {
        var there = RateResolver.Resolve("GBP", "NGN", [], Transfer, false);
        var back = RateResolver.Resolve("NGN", "GBP", [], Transfer, false);

        Assert.Equal((1800m, RateSource.Transfer), (there.Rate, there.Source));
        Assert.Equal(1m / 1800m, back.Rate);
        Assert.Equal(new DateOnly(2026, 10, 1), back.TransferDate);
    }

    [Fact]
    public void ManualRate_WinsOverTheTransfer()
    {
        Assert.Equal(RateSource.Manual, RateResolver.Resolve("GBP", "NGN", [GbpToNgn], Transfer, false).Source);
    }

    [Fact]
    public void PreferTransfer_PutsTheTransferFirst()
    {
        var quote = RateResolver.Resolve("GBP", "NGN", [GbpToNgn], Transfer, preferTransfer: true);

        Assert.Equal((1800m, RateSource.Transfer), (quote.Rate, quote.Source));
    }

    [Fact]
    public void PreferTransfer_FallsBackToMyRate_WhenThereIsNoTransfer()
    {
        var quote = RateResolver.Resolve("GBP", "NGN", [GbpToNgn], null, preferTransfer: true);

        Assert.Equal((1850m, RateSource.Manual), (quote.Rate, quote.Source));
    }

    [Fact]
    public void NothingToGoOn_HasNoRate()
    {
        var quote = RateResolver.Resolve("NGN", "GBP", [], null, false);

        Assert.Null(quote.Rate);
        Assert.Equal(RateSource.None, quote.Source);
    }

    [Fact]
    public void SameCurrency_IsOne()
    {
        Assert.Equal((1m, RateSource.Same), (RateResolver.Resolve("GBP", "GBP", [], null, false).Rate, RateResolver.Resolve("GBP", "GBP", [], null, false).Source));
    }

    [Fact]
    public void ATransferBetweenOtherCurrencies_DoesntCount()
    {
        var euros = new TransferRateSource(new DateOnly(2026, 10, 1), "GBP", 10m, "EUR", 11.6m);

        Assert.Equal(RateSource.None, RateResolver.Resolve("GBP", "NGN", [], euros, false).Source);
    }

    [Theory]
    [InlineData(5000, 0.00052, 2.60)]
    [InlineData(18000, 0.000555555555, 10.00)]
    [InlineData(10, 1850, 18500)]
    public void Convert_MultipliesAndRounds(double amount, double rate, double expected)
    {
        Assert.Equal((decimal)expected, Currencies.Convert((decimal)amount, (decimal)rate));
    }
}
