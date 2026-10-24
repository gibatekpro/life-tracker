using System.Globalization;
using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using LifeTracker.Api.Common;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Features.Budgets;
using LifeTracker.Api.Features.Categories;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Features.Transactions;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Capture;

// What the iOS Shortcut sends after an Apple Pay payment. Everything arrives as text,
// exactly as Wallet shows it, e.g. Amount "£4.50", Merchant "Tesco Express", Card "Lloyd's".
public record ApplePayCapture(string Amount, string Merchant, string? Card);

// Where the purchase leaves its budget line, for the Shortcut's notification.
public record CaptureBudget(string Name, decimal Planned, decimal Spent, decimal Remaining, decimal DailyAllowance, decimal? PercentUsed);

// What the Shortcut gets back: the saved transaction, its budget line (if it has one), and the
// notification text ready to show, e.g. "Food: £150.00 of £200.00 · £3.20/day left".
public record CaptureResponse(TransactionDto Transaction, CaptureBudget? Budget, string Notification);

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
            ApplePayCapture req, AppDbContext db, LedgerService ledger, SettingsService settings, BudgetService budgets) =>
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
            // from the merchant name, matched to my categories (falling back to "Other"),
            // which I can change later.
            var guessed = CategoryGuesser.Guess(merchant);
            var expenseCategories = await db.Categories
                .Where(c => c.Kind == CategoryKind.Expense && !c.IsArchived)
                .Select(c => new { c.Id, c.ParentId, c.Name })
                .ToListAsync();
            var categoryId = CategoryGuesser.Resolve(guessed, expenseCategories.Select(c => (c.Id, c.ParentId, c.Name)).ToList());
            if (categoryId is null)
            {
                logger.LogWarning("No category matches {Guessed} and there's no Other category; capture not recorded", guessed);
                return Results.BadRequest(new { error = $"No category matches '{guessed}', and there's no 'Other' category to fall back on." });
            }

            var result = await ledger.RecordAsync(new LedgerEntry(
                amount,
                merchant.Length > 200 ? merchant[..200] : merchant,
                categoryId,
                UkDate.Today(),
                TransactionType.Expense,
                resolution.AccountId));

            if (result.Transaction is not { } t) return Results.BadRequest(new { error = result.Error });

            // How the category's budget stands now: its own line, or the nearest parent with a budget.
            var month = (await budgets.GetMonthAsync()).Budget;
            var categories = await db.Categories
                .Select(c => new BudgetCategory(c.Id, c.ParentId, c.Name, c.SortOrder, c.IsArchived, c.DefaultMonthlyAmount, null))
                .ToListAsync();
            var line = BudgetCalculator.LineFor(month, t.CategoryId!.Value, categories);
            var paths = await db.CategoryPathsAsync();
            var notification = line is null
                ? string.Create(CultureInfo.InvariantCulture, $"{t.Description}: £{t.GbpAmount:0.00} · {paths[t.CategoryId!.Value]} has no budget")
                : BudgetCalculator.Notification(line);

            logger.LogInformation("Captured {TransactionId}: {Notification}", t.Id, notification);
            return Results.Created($"/transactions/{t.Id}", new CaptureResponse(
                TransactionDto.From(t, paths),
                line is null ? null : new CaptureBudget(line.Name, line.Planned, line.Spent, line.Remaining, line.DailyAllowance, line.PercentUsed),
                notification));
        });

        return group;
    }
}
