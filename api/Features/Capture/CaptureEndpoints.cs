using LifeTracker.Api.Data;
using LifeTracker.Api.Models;

namespace LifeTracker.Api.Features.Capture;

public record ApplePayCapture(string Amount, string Merchant, string? Card);

public static class CaptureEndpoints
{
    public static RouteGroupBuilder MapCaptureEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/capture").WithTags("Capture");

        group.MapPost("/apple-pay", async (ApplePayCapture req, AppDbContext db, ILogger<Program> logger) =>
        {
            logger.LogInformation("Apple Pay capture received: {Merchant} {Amount} ({Card})",
                req.Merchant, req.Amount, req.Card);

            if (!AmountParser.TryParse(req.Amount, out var amount))
                return Results.BadRequest(new { error = $"Couldn't read an amount from '{req.Amount}'." });

            var merchant = string.IsNullOrWhiteSpace(req.Merchant) ? "Apple Pay" : req.Merchant.Trim();

            var transaction = new Transaction
            {
                Amount = amount,
                Description = merchant.Length > 200 ? merchant[..200] : merchant,
                Category = CategoryGuesser.Guess(merchant),
                Date = DateOnly.FromDateTime(DateTime.Now)
            };

            db.Transactions.Add(transaction);
            await db.SaveChangesAsync();
            return Results.Created($"/transactions/{transaction.Id}", transaction);
        });

        return group;
    }
}