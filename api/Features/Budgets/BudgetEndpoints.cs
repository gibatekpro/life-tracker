namespace LifeTracker.Api.Features.Budgets;

// A figure for one line of one budget month. Exactly one of CategoryId and AccountId.
public record SetBudgetAmountRequest(int Year, int Month, int? CategoryId, int? AccountId, decimal Amount);
public record CopyPreviousRequest(int Year, int Month);

// My monthly budget: what I plan to spend in each category and pay on each debt, against what's
// actually gone, and what's safe to spend. The figures come from BudgetService and BudgetCalculator.
public static class BudgetEndpoints
{
    public static RouteGroupBuilder MapBudgetEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/budgets").WithTags("Budgets");

        var logger = app.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger("LifeTracker.Api.Features.Budgets");

        // With no year or month, the budget month I'm in now (following payday).
        group.MapGet("/month", async (int? year, int? month, BudgetService budgets) =>
            BadMonth(year, month) is { } problem
                ? Results.BadRequest(new { error = problem })
                : Results.Ok(await budgets.GetMonthAsync(year, month)));

        // Set a month's own figure (e.g. council tax £125 in November instead of the usual £120).
        group.MapPut("/month/amount", async (SetBudgetAmountRequest req, BudgetService budgets) =>
        {
            var problem = BadMonth(req.Year, req.Month)
                          ?? await budgets.SetAmountAsync(req.Year, req.Month, new BudgetLineKey(req.CategoryId, req.AccountId), req.Amount);
            if (problem is null) return Results.NoContent();

            logger.LogWarning("Rejected budget figure for {Year}-{Month}: {Reason}", req.Year, req.Month, problem);
            return Results.BadRequest(new { error = problem });
        });

        // Back to the default for that line and month.
        group.MapDelete("/month/amount", async (int year, int month, int? categoryId, int? accountId, BudgetService budgets) =>
        {
            if (BadMonth(year, month) is { } problem) return Results.BadRequest(new { error = problem });
            await budgets.ResetAsync(year, month, new BudgetLineKey(categoryId, accountId));
            return Results.NoContent();
        });

        // Start a month from last month's figures.
        group.MapPost("/month/copy-previous", async (CopyPreviousRequest req, BudgetService budgets) =>
            BadMonth(req.Year, req.Month) is { } problem
                ? Results.BadRequest(new { error = problem })
                : Results.Ok(new { copied = await budgets.CopyPreviousAsync(req.Year, req.Month) }));

        return group;
    }

    private static string? BadMonth(int? year, int? month) =>
        month is < 1 or > 12 || (year is null) != (month is null) || year is < 2000 or > 2100
            ? "Give both year and month (1-12), or neither for the current month."
            : null;
}
