namespace LifeTracker.Api.Features.Accounts;

// A rate I've set myself: units of To per 1 From (e.g. GBP->NGN 1,850, NGN->GBP 0.00052).
public record ManualRate(string From, string To, decimal Rate, DateTime UpdatedAt);

// My latest transfer between two currencies, whichever way it went.
public record TransferRateSource(DateOnly Date, string SentCurrency, decimal Sent, string ReceivedCurrency, decimal Received);

public enum RateSource { Same, Manual, InverseOfManual, Transfer, None }

// The rate to use for one direction, and where it came from: my own rate for that direction,
// the inverse of my rate for the other direction, or my latest transfer. Rate is null when
// there's nothing to go on.
public record RateQuote(string From, string To, decimal? Rate, RateSource Source, DateTime? UpdatedAt, DateOnly? TransferDate);

// Decides which exchange rate to use, given my manual rates and my latest transfer.
//
// Sending money and converting it back usually happen at different rates, so I can set each
// direction myself. If I've only set one, its inverse stands in for the other. Without either,
// it's the rate my latest transfer between the two currencies implied (as before manual rates).
// With preferTransfer (Settings.UseTransferRates), the transfer rate comes first and my own rates
// are only the fallback.
//
// Pure, like BalanceRules: ExchangeRateService loads the rates and the transfer and asks here.
public static class RateResolver
{
    public static RateQuote Resolve(
        string from, string to, IReadOnlyList<ManualRate> manual, TransferRateSource? latestTransfer, bool preferTransfer)
    {
        if (from == to) return new RateQuote(from, to, 1m, RateSource.Same, null, null);

        var manualQuote = Direct(from, to, manual) ?? Inverse(from, to, manual);
        var transferQuote = FromTransfer(from, to, latestTransfer);

        return (preferTransfer ? transferQuote ?? manualQuote : manualQuote ?? transferQuote)
               ?? new RateQuote(from, to, null, RateSource.None, null, null);
    }

    private static RateQuote? Direct(string from, string to, IReadOnlyList<ManualRate> manual) =>
        manual.FirstOrDefault(r => r.From == from && r.To == to && r.Rate > 0) is { } r
            ? new RateQuote(from, to, r.Rate, RateSource.Manual, r.UpdatedAt, null)
            : null;

    private static RateQuote? Inverse(string from, string to, IReadOnlyList<ManualRate> manual) =>
        manual.FirstOrDefault(r => r.From == to && r.To == from && r.Rate > 0) is { } r
            ? new RateQuote(from, to, 1m / r.Rate, RateSource.InverseOfManual, r.UpdatedAt, null)
            : null;

    private static RateQuote? FromTransfer(string from, string to, TransferRateSource? t) =>
        t is not null && Currencies.RateFromTransfer(from, to, t.SentCurrency, t.Sent, t.ReceivedCurrency, t.Received) is { } rate
            ? new RateQuote(from, to, rate, RateSource.Transfer, null, t.Date)
            : null;
}
