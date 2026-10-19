using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using LifeTracker.Api.Common;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Features.Transactions;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Capture;

public record ApplePayCapture(string Amount, string Merchant, string? Card);

public static class CaptureEndpoints
{
    public static RouteGroupBuilder MapCaptureEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/capture").WithTags("Capture");

        group.MapPost("/apple-pay", async (
            ApplePayCapture req, AppDbContext db, LedgerService ledger, SettingsService settings,
            ILogger<Program> logger) =>
        {
            logger.LogInformation("Apple Pay capture received: {Merchant} {Amount} ({Card})",
                req.Merchant, req.Amount, req.Card);

            if (!AmountParser.TryParse(req.Amount, out var amount))
                return Results.BadRequest(new { error = $"Couldn't read an amount from '{req.Amount}'." });

            var merchant = string.IsNullOrWhiteSpace(req.Merchant) ? "Apple Pay" : req.Merchant.Trim();

            var accounts = await db.Accounts
                .Select(a => new ResolvableAccount(a.Id, a.Name, a.Aliases.Select(x => x.Alias).ToList()))
                .ToListAsync();
            var resolution = AccountResolver.Resolve(req.Card, accounts, (await settings.GetAsync()).DefaultAccountId);

            if (resolution is null)
                return Results.BadRequest(new { error = $"No account matches card '{req.Card}' and no default account is set." });

            if (resolution.MatchedBy == MatchedBy.Default)
                logger.LogWarning("No account matches card {Card}, so the default account was used. Add an alias for it.",
                    req.Card);

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
