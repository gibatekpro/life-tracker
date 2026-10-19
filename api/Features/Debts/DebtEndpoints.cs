using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Common;
namespace LifeTracker.Api.Features.Debts;

public record DebtWithProjection(
    Account Debt,
    PayoffProjection
    Projection);
public record WhatIfComparison(
    PayoffProjection Current,
    PayoffProjection WhatIf,
    int MonthsSaved,
    decimal InterestSaved);
public record DebtsOverview(
    decimal TotalBalance,
    decimal TotalMonthlyPayment,
    decimal TotalInterest,
    DateOnly? DebtFreeDate,
    IReadOnlyList<DebtWithProjection> Debts);

// A read-only view over the accounts I owe money on (credit cards and loans).
// Creating, editing and paying them happens through /accounts and /transactions.
public static class DebtEndpoints
{
    private static IQueryable<Account> Debts(this AppDbContext db) =>
        db.Accounts.Where(a => a.Type == AccountType.CreditCard || a.Type == AccountType.Loan);

    public static RouteGroupBuilder MapDebtEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/debts").WithTags("Debts");

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

            var allPayable = items.All(i => i.Projection.CanBePaidOff);

            return new DebtsOverview(
            items.Sum(i => i.Debt.Balance),
            items.Sum(i => i.Debt.MonthlyPayment),
            items.Sum(i => i.Projection.TotalInterest),
            allPayable ? items.Max(i => i.Projection.PayoffDate) : null,
            items);
        });

        group.MapGet("/{id:int}/what-if", async (int id, decimal monthlyPayment, AppDbContext db) =>
        {
            var debt = await db.Debts().FirstOrDefaultAsync(d => d.Id == id);
            if (debt is null) return Results.NotFound();

            var today = UkDate.Today();
            var current = DebtPayoffCalculator.Calculate(debt.Balance, debt.Apr, debt.MonthlyPayment, today);
            var whatIf = DebtPayoffCalculator.Calculate(debt.Balance, debt.Apr, monthlyPayment, today);

            return Results.Ok(new WhatIfComparison(
                current, whatIf,
                current.Months - whatIf.Months,
                current.TotalInterest - whatIf.TotalInterest));
        });

        group.MapGet("/avalanche", async (decimal? extra, AppDbContext db, SettingsService settings) =>
        {
            var today = UkDate.Today();
            var debts = await db.Debts()
                .Where(d => d.Balance > 0)
                .Select(d => new PlannerDebt(d.Id, d.Name, d.Balance, d.Apr, d.MonthlyPayment))
                .ToListAsync();
            var s = await settings.GetAsync();

            return AvalanchePlanner.Plan(debts, today, extra ?? 0, s.MonthlyDebtBudget);
        });

        return group;
    }
}
