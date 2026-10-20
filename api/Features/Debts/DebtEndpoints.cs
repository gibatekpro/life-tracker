using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Common;
namespace LifeTracker.Api.Features.Debts;

// A debt (a card or loan account) and when it'll be paid off at its current monthly payment.
public record DebtWithProjection(
    Account Debt,
    PayoffProjection
    Projection);

// "What if I paid X a month instead?" Both projections side by side, and what I'd save.
public record WhatIfComparison(
    PayoffProjection Current,
    PayoffProjection WhatIf,
    int MonthsSaved,
    decimal InterestSaved);

// The big picture for the dashboard: how much I owe in total, what I'm paying, and when I'm debt-free.
public record DebtsOverview(
    decimal TotalBalance,
    decimal TotalMonthlyPayment,
    decimal TotalInterest,
    DateOnly? DebtFreeDate,
    IReadOnlyList<DebtWithProjection> Debts);

// The "getting out of debt" side of the app. Nothing here changes data: it reads the card and
// loan accounts and answers questions about them (when will it be paid off, what if I paid
// more, which order should I pay them in). Creating, editing and paying debts happens in
// /accounts and /transactions.
public static class DebtEndpoints
{
    // A debt is any account where the balance is money I owe.
    private static IQueryable<Account> Debts(this AppDbContext db) =>
        db.Accounts.Where(a => a.Type == AccountType.CreditCard || a.Type == AccountType.Loan);

    public static RouteGroupBuilder MapDebtEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/debts").WithTags("Debts");

        var logger = app.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger("LifeTracker.Api.Features.Debts");

        // Every debt with its own payoff date, highest interest first, since those cost the most.
        group.MapGet("/", async (AppDbContext db) =>
        {
            var today = UkDate.Today();
            var debts = await db.Debts()
                .OrderByDescending(d => d.Apr)
                .ThenByDescending(d => d.Balance)
                .ToListAsync();

            var items = debts
                .Select(d => new DebtWithProjection(d,
            DebtPayoffCalculator.Calculate(d.Balance, d.Apr, d.MonthlyPayment, today)))
                .ToList();

            // If the payment doesn't even cover the interest, that debt grows forever. Worth shouting about.
            foreach (var stuck in items.Where(i => !i.Projection.CanBePaidOff))
                logger.LogWarning("{Name} can't be paid off: £{Payment}/month doesn't cover the interest on £{Balance} at {Apr}%",
                    stuck.Debt.Name, stuck.Debt.MonthlyPayment, stuck.Debt.Balance, stuck.Debt.Apr);

            // There's only a debt-free date if every single debt can be cleared.
            var allPayable = items.All(i => i.Projection.CanBePaidOff);

            return new DebtsOverview(
            items.Sum(i => i.Debt.Balance),
            items.Sum(i => i.Debt.MonthlyPayment),
            items.Sum(i => i.Projection.TotalInterest),
            allPayable ? items.Max(i => i.Projection.PayoffDate) : null,
            items);
        });

        // For one debt: how much sooner (and cheaper) it'd be paid off at a different monthly payment.
        group.MapGet("/{id:int}/what-if", async (int id, decimal monthlyPayment, AppDbContext db) =>
        {
            var debt = await db.Debts().FirstOrDefaultAsync(d => d.Id == id);
            if (debt is null) return Results.NotFound();

            var today = UkDate.Today();
            var current = DebtPayoffCalculator.Calculate(debt.Balance, debt.Apr, debt.MonthlyPayment, today);
            var whatIf = DebtPayoffCalculator.Calculate(debt.Balance, debt.Apr, monthlyPayment, today);

            logger.LogDebug("What-if for {Name}: £{Current}/month takes {CurrentMonths} months, £{WhatIf}/month takes {WhatIfMonths}",
                debt.Name, debt.MonthlyPayment, current.Months, monthlyPayment, whatIf.Months);

            return Results.Ok(new WhatIfComparison(
                current, whatIf,
                current.Months - whatIf.Months,
                current.TotalInterest - whatIf.TotalInterest));
        });

        // The plan for all debts together, using the avalanche method (see AvalanchePlanner).
        // "extra" is the simulator on the dashboard: "what if I threw another £50 a month at this?"
        group.MapGet("/avalanche", async (decimal? extra, AppDbContext db, SettingsService settings) =>
        {
            var today = UkDate.Today();
            var debts = await db.Debts()
                .Where(d => d.Balance > 0)   // a cleared card has nothing left to plan
                .Select(d => new PlannerDebt(d.Id, d.Name, d.Balance, d.Apr, d.MonthlyPayment))
                .ToListAsync();
            var s = await settings.GetAsync();

            var plan = AvalanchePlanner.Plan(debts, today, extra ?? 0, s.MonthlyDebtBudget);

            if (!plan.CanBePaidOff)
                logger.LogWarning("Avalanche plan can't clear the debts within 50 years at £{Budget}/month", plan.MonthlyBudget);
            else
                logger.LogDebug("Avalanche plan: £{Budget}/month clears {Count} debts in {Months} months ({DebtFreeDate:yyyy-MM-dd})",
                    plan.MonthlyBudget, debts.Count, plan.Months, plan.DebtFreeDate);

            return plan;
        });

        return group;
    }
}
