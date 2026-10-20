using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using LifeTracker.Api.Common;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Features.Transactions;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Capture;

// What the iOS Shortcut sends after an Apple Pay payment. Everything arrives as text,
// exactly as Wallet shows it, e.g. Amount "£4.50", Merchant "Tesco Express", Card "Lloyd's".
public record ApplePayCapture(string Amount, string Merchant, string? Card);

// Automatic spending capture. When I pay with Apple Pay, an iOS Shortcuts automation posts
// the payment here, so it's logged without me typing anything. The phone isn't on this Mac,
// so these requests need the API key (see NetworkApiKeyMiddleware).
public static class CaptureEndpoints
{
    public static RouteGroupBuilder MapCaptureEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/capture").WithTags("Capture");

        var logger = app.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger("LifeTracker.Api.Features.Capture");

        group.MapPost("/apple-pay", async (
            ApplePayCapture req, AppDbContext db, LedgerService ledger, SettingsService settings) =>
        {
            logger.LogInformation("Apple Pay capture received: {Merchant} {Amount} ({Card})",
                req.Merchant, req.Amount, req.Card);

            // "£1,234.50" has to become 1234.50 before it's any use.
            if (!AmountParser.TryParse(req.Amount, out var amount))
            {
                logger.LogWarning("Couldn't read an amount from {Amount}; capture from {Merchant} not recorded",
                    req.Amount, req.Merchant);
                return Results.BadRequest(new { error = $"Couldn't read an amount from '{req.Amount}'." });
            }

            var merchant = string.IsNullOrWhiteSpace(req.Merchant) ? "Apple Pay" : req.Merchant.Trim();

            // Work out which account paid. This is cheap: there are only a handful of accounts,
            // so they're all loaded with their aliases and matched in memory.
            var accounts = await db.Accounts
                .Select(a => new ResolvableAccount(a.Id, a.Name, a.Aliases.Select(x => x.Alias).ToList()))
                .ToListAsync();
            var resolution = AccountResolver.Resolve(req.Card, accounts, (await settings.GetAsync()).DefaultAccountId);

            if (resolution is null)
            {
                logger.LogWarning("No account matches card {Card} and no default account is set; capture not recorded", req.Card);
                return Results.BadRequest(new { error = $"No account matches card '{req.Card}' and no default account is set." });
            }

            // Falling back works, but the payment may be on the wrong account. This warning
            // tells me which card name to add as an alias.
            if (resolution.MatchedBy == MatchedBy.Default)
                logger.LogWarning("No account matches card {Card}, so the default account {AccountId} was used. Add an alias for it.",
                    req.Card, resolution.AccountId);
            else
                logger.LogInformation("Card {Card} matched account {AccountId} by {MatchedBy}",
                    req.Card, resolution.AccountId, resolution.MatchedBy);

            // Always an Expense: Apple Pay is me buying something. The category is a best guess
            // from the merchant name, which I can change later.
            var result = await ledger.RecordAsync(new LedgerEntry(
                amount,
                merchant.Length > 200 ? merchant[..200] : merchant,
                CategoryGuesser.Guess(merchant),
                UkDate.Today(),
                TransactionType.Expense,
                resolution.AccountId));

            return result.Transaction is { } t
                ? Results.Created($"/transactions/{t.Id}", TransactionDto.From(t))
                : Results.BadRequest(new { error = result.Error });
        });

        return group;
    }
}
