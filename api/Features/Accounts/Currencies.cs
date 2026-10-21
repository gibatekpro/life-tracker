namespace LifeTracker.Api.Features.Accounts;

// Money in more than one currency: my UK accounts are in pounds, my Nigerian ones in naira.
//
// Each account keeps its balance in its own currency. Pounds are the "home" currency: the
// monthly summary and the debt totals are in £, so anything in another currency needs a £ value.
// There's no exchange-rate feed. The rate is the one I actually got on my own transfers:
// sending £10 and receiving ₦18,000 means ₦1,800 to the pound.
//
// Pure (no database, no logging) like BalanceRules. ExchangeRateService finds the transfers.
public static class Currencies
{
    public const string Home = "GBP";

    // " ngn" -> "NGN". Null if it isn't a three-letter code like GBP or NGN.
    public static string? Normalise(string? code)
    {
        var c = (code ?? "").Trim().ToUpperInvariant();
        return c.Length == 3 && c.All(char.IsAsciiLetterUpper) ? c : null;
    }

    // How much of `currency` one pound bought in a transfer between pounds and that currency.
    // Works in either direction: £10 -> ₦18,000 and ₦18,000 -> £10 both give 1,800.
    // Null if the transfer wasn't between pounds and `currency`.
    public static decimal? RatePerPound(
        string currency, string fromCurrency, decimal amount, string toCurrency, decimal toAmount)
    {
        if (amount <= 0 || toAmount <= 0) return null;
        if (fromCurrency == Home && toCurrency == currency) return toAmount / amount;
        if (fromCurrency == currency && toCurrency == Home) return amount / toAmount;
        return null;
    }

    // ₦5,000 at ₦1,800 to the pound is £2.78. Rounded to the penny, like everything else stored.
    public static decimal ToPounds(decimal amount, decimal ratePerPound) =>
        Math.Round(amount / ratePerPound, 2);
}
