using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Accounts;

// Finds the exchange rate to use for a currency: the one from my own latest transfer
// between pounds and that currency (see Currencies for why there's no rate feed).
public class ExchangeRateService(AppDbContext db)
{
    // How much of `currency` a pound buys, e.g. 1,800 for NGN.
    // Uses the latest transfer on or before `date`, so back-dating an expense uses the rate from
    // that time. If there's none that early, it uses the latest one at all.
    // Null if I've never transferred between pounds and that currency.
    public async Task<decimal?> RatePerPoundAsync(string currency, DateOnly? date = null)
    {
        if (currency == Currencies.Home) return 1m;

        var transfers = db.Transactions
            .Where(t => t.Type == TransactionType.Transfer && t.ToAmount != null &&
                ((t.Account.Currency == Currencies.Home && t.ToAccount!.Currency == currency) ||
                 (t.Account.Currency == currency && t.ToAccount!.Currency == Currencies.Home)))
            .OrderByDescending(t => t.Date)
            .ThenByDescending(t => t.Id)
            .Select(t => new { t.Date, t.Amount, ToAmount = t.ToAmount!.Value, From = t.Account.Currency, To = t.ToAccount!.Currency });

        var latest = (date is { } d ? await transfers.FirstOrDefaultAsync(t => t.Date <= d) : null)
                     ?? await transfers.FirstOrDefaultAsync();

        return latest is null ? null : Currencies.RatePerPound(currency, latest.From, latest.Amount, latest.To, latest.ToAmount);
    }
}
