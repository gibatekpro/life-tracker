namespace LifeTracker.Api.Features.Accounts;

// One direction's rate for the Settings page: what's used, where it comes from (Manual,
// InverseOfManual, Transfer or None) and when, plus my own figure for that direction if I've set one.
public record ExchangeRateDto(
    string From, string To, decimal? Rate, RateSource Source, DateTime? UpdatedAt, DateOnly? TransferDate, decimal? ManualRate);

public record SetRateRequest(decimal Rate);

// Exchange rates I set myself, one per direction. Clearing one falls back to the inverse of the
// other direction, then to my latest transfer's rate (see RateResolver).
public static class ExchangeRateEndpoints
{
    public static RouteGroupBuilder MapExchangeRateEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/exchange-rates").WithTags("Exchange rates");

        var logger = app.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger("LifeTracker.Api.Features.ExchangeRates");

        // Both directions between pounds and each other currency in use.
        group.MapGet("/", async (ExchangeRateService rates) =>
            (await rates.AllAsync()).Select(q => new ExchangeRateDto(
                q.From, q.To, q.Rate, q.Source, q.UpdatedAt, q.TransferDate,
                q.Source == RateSource.Manual ? q.Rate : null)));

        group.MapPut("/{from}/{to}", async (string from, string to, SetRateRequest req, ExchangeRateService rates) =>
        {
            var (f, t) = (from.ToUpperInvariant(), to.ToUpperInvariant());
            if (await rates.SetAsync(f, t, req.Rate) is { } problem)
            {
                logger.LogWarning("Rejected rate {From}->{To} {Rate}: {Reason}", f, t, req.Rate, problem);
                return Results.BadRequest(new { error = problem });
            }

            logger.LogInformation("Set rate {From}->{To} to {Rate}", f, t, req.Rate);
            return Results.NoContent();
        });

        group.MapDelete("/{from}/{to}", async (string from, string to, ExchangeRateService rates) =>
        {
            var (f, t) = (from.ToUpperInvariant(), to.ToUpperInvariant());
            if (await rates.ClearAsync(f, t) is { } problem) return Results.BadRequest(new { error = problem });

            logger.LogInformation("Cleared my rate {From}->{To}", f, t);
            return Results.NoContent();
        });

        return group;
    }
}
