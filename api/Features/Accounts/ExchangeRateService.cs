using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Accounts;

// Exchange rates: the ones I set myself (one per direction), and the one my latest transfer
// between two currencies implied. RateResolver decides which applies; this service loads them,
// converts amounts to pounds, and saves my own rates.
public class ExchangeRateService(AppDbContext db)
{
    // The rate for from -> to (units of `to` per 1 `from`) and where it came from. A transfer-based
    // rate uses my latest transfer on or before `date` (back-dating uses the rate from back then),
    // or the latest at all if there's none that early. My own rates are a single current value.
    public async Task<RateQuote> GetAsync(string from, string to, DateOnly? date = null)
    {
        var manual = await db.ExchangeRates
            .Where(r => (r.FromCurrency == from && r.ToCurrency == to) || (r.FromCurrency == to && r.ToCurrency == from))
            .Select(r => new ManualRate(r.FromCurrency, r.ToCurrency, r.Rate, r.UpdatedAt))
            .ToListAsync();

        // Settings has one row; before it exists, nothing has asked to prefer transfers.
        var preferTransfer = await db.Settings.Select(s => s.UseTransferRates).FirstOrDefaultAsync();

        return RateResolver.Resolve(from, to, manual, await LatestTransferAsync(from, to, date), preferTransfer);
    }

    // An amount in pounds, at the rate for currency -> GBP. Null when there's no rate to use yet.
    public async Task<decimal?> ToPoundsAsync(decimal amount, string currency, DateOnly? date = null) =>
        (await GetAsync(currency, Currencies.Home, date)).Rate is { } rate ? Currencies.Convert(amount, rate) : null;

    // Both directions between pounds and every other currency in use (by an account, or by a rate I've set).
    public async Task<List<RateQuote>> AllAsync()
    {
        var currencies = (await db.Accounts.Select(a => a.Currency).Distinct().ToListAsync())
            .Concat(await db.ExchangeRates.Select(r => r.FromCurrency).ToListAsync())
            .Concat(await db.ExchangeRates.Select(r => r.ToCurrency).ToListAsync())
            .Where(c => c != Currencies.Home)
            .Distinct()
            .Order();

        var quotes = new List<RateQuote>();
        foreach (var c in currencies)
        {
            quotes.Add(await GetAsync(Currencies.Home, c));
            quotes.Add(await GetAsync(c, Currencies.Home));
        }
        return quotes;
    }

    // Sets (or replaces) my own rate for one direction. Returns what's wrong, or null.
    public async Task<string?> SetAsync(string from, string to, decimal rate)
    {
        if (Check(from, to) is { } problem) return problem;
        if (rate <= 0) return "A rate must be above zero.";

        var existing = await db.ExchangeRates.FirstOrDefaultAsync(r => r.FromCurrency == from && r.ToCurrency == to);
        if (existing is null)
            db.ExchangeRates.Add(new ExchangeRate { FromCurrency = from, ToCurrency = to, Rate = rate });
        else
        {
            existing.Rate = rate;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync();
        return null;
    }

    // Clears my own rate for one direction, so it falls back to the inverse or the latest transfer.
    public async Task<string?> ClearAsync(string from, string to)
    {
        if (Check(from, to) is { } problem) return problem;
        await db.ExchangeRates.Where(r => r.FromCurrency == from && r.ToCurrency == to).ExecuteDeleteAsync();
        return null;
    }

    private static string? Check(string from, string to)
    {
        if (!Currencies.IsSupported(from) || !Currencies.IsSupported(to))
            return $"Rates are for {string.Join(", ", Currencies.Supported)}.";
        if (from == to) return "A rate needs two different currencies.";
        return null;
    }

    // My most recent transfer between the two currencies, in either direction.
    private async Task<TransferRateSource?> LatestTransferAsync(string a, string b, DateOnly? date)
    {
        var transfers = db.Transactions
            .Where(t => t.Type == TransactionType.Transfer && t.ToAmount != null &&
                ((t.Account.Currency == a && t.ToAccount!.Currency == b) ||
                 (t.Account.Currency == b && t.ToAccount!.Currency == a)));

        // Filter before projecting: EF can't see through the record's constructor to t.Date.
        Task<TransferRateSource?> LatestAsync(IQueryable<Transaction> q) => q
            .OrderByDescending(t => t.Date)
            .ThenByDescending(t => t.Id)
            .Select(t => new TransferRateSource(t.Date, t.Account.Currency, t.Amount, t.ToAccount!.Currency, t.ToAmount!.Value))
            .FirstOrDefaultAsync();

        return (date is { } d ? await LatestAsync(transfers.Where(t => t.Date <= d)) : null)
               ?? await LatestAsync(transfers);
    }
}
