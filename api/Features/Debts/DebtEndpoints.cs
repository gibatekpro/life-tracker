using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Common;
using LifeTracker.Api.Features.Accounts;
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
// The totals are in pounds. Each debt (and its projection) stays in its own currency.
// CurrenciesWithoutRate: debts in these currencies aren't in the totals yet, because I haven't
// made a transfer between pounds and that currency to take a rate from.
public record DebtsOverview(
    decimal TotalBalance,
    decimal TotalMonthlyPayment,
    decimal TotalInterest,
    DateOnly? DebtFreeDate,
    IReadOnlyList<DebtWithProjection> Debts,
    IReadOnlyList<string> CurrenciesWithoutRate);

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
        group.MapGet("/", async (AppDbContext db, ExchangeRateService rates) =>
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

            // Add the debts up in pounds, converting naira loans at my latest transfer rate.
            var poundRates = await RatesAsync(debts.Select(d => d.Currency), rates);
            var missing = poundRates.Where(r => r.Value is null).Select(r => r.Key).ToList();
            foreach (var currency in missing)
                logger.LogWarning("{Currency} debts are left out of the £ totals: no transfer between GBP and {Currency} yet",
                    currency, currency);

            var counted = items.Where(i => poundRates[i.Debt.Currency] is not null).ToList();
            decimal Pounds(DebtWithProjection i, decimal amount) =>
                Currencies.ToPounds(amount, poundRates[i.Debt.Currency]!.Value);

            return new DebtsOverview(
            counted.Sum(i => Pounds(i, i.Debt.Balance)),
            counted.Sum(i => Pounds(i, i.Debt.MonthlyPayment)),
            counted.Sum(i => Pounds(i, i.Projection.TotalInterest)),
            allPayable ? items.Max(i => i.Projection.PayoffDate) : null,
            items,
            missing);
        });

        // For one debt: how much sooner (and cheaper) it'd be paid off at a different monthly payment.
        // Everything here is in the debt's own currency.
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
        // The plan works in pounds (my budget is in pounds), so naira debts are converted first.
        group.MapGet("/avalanche", async (decimal? extra, AppDbContext db, SettingsService settings, ExchangeRateService rates) =>
        {
            var today = UkDate.Today();
            var accounts = await db.Debts()
                .Where(d => d.Balance > 0)   // a cleared card has nothing left to plan
                .ToListAsync();

            var poundRates = await RatesAsync(accounts.Select(a => a.Currency), rates);
            var debts = new List<PlannerDebt>();
            foreach (var a in accounts)
            {
                if (poundRates[a.Currency] is not { } rate)
                {
                    logger.LogWarning("{Name} is left out of the avalanche plan: no transfer between GBP and {Currency} yet",
                        a.Name, a.Currency);
                    continue;
                }
                debts.Add(new PlannerDebt(a.Id, a.Name,
                    Currencies.ToPounds(a.Balance, rate), a.Apr, Currencies.ToPounds(a.MonthlyPayment, rate)));
            }
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

    // The latest rate for each currency (1 for pounds), or null where there's no transfer to take one from.
    private static async Task<Dictionary<string, decimal?>> RatesAsync(
        IEnumerable<string> currencies, ExchangeRateService rates)
    {
        var result = new Dictionary<string, decimal?>();
        foreach (var currency in currencies.Distinct())
            result[currency] = await rates.RatePerPoundAsync(currency);
        return result;
    }
}
