using LifeTracker.Api.Data;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.Debts;

public record CreateDebtRequest(
    string Name,
    decimal Balance,
    decimal Apr,
    decimal MinimumPayment,
    decimal MonthlyPayment);
public record UpdateDebtRequest(
    decimal Balance,
    decimal MonthlyPayment);
public record DebtWithProjection(
    Debt Debt,
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

public static class DebtEndpoints
{
    public static RouteGroupBuilder MapDebtEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/debts").WithTags("Debts");

        group.MapGet("/", async (AppDbContext db) =>
        {
            var today = DateOnly.FromDateTime(DateTime.Today);
            var debts = await db.Debts
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

        group.MapPost("/", async (CreateDebtRequest req, AppDbContext db) =>
        {
            if (req.Balance < 0 || req.Apr < 0 || req.MonthlyPayment <= 0)
                return Results.BadRequest("Balance and APR can't be negative, and the payment must be above zero.");

            var debt = new Debt
            {
                Name = req.Name,
                Balance = req.Balance,
                Apr = req.Apr,
                MinimumPayment = req.MinimumPayment,
                MonthlyPayment = req.MonthlyPayment
            };
            db.Debts.Add(debt);
            await db.SaveChangesAsync();
            return Results.Created($"/debts/{debt.Id}", debt);
        });

        group.MapPut("/{id:int}", async (int id, UpdateDebtRequest req, AppDbContext db) =>
        {
            var debt = await db.Debts.FindAsync(id);
            if (debt is null) return Results.NotFound();

            debt.Balance = req.Balance;
            debt.MonthlyPayment = req.MonthlyPayment;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        group.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
        {
            var debt = await db.Debts.FindAsync(id);
            if (debt is null) return Results.NotFound();

            db.Debts.Remove(debt);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        group.MapGet("/{id:int}/what-if", async (int id, decimal monthlyPayment, AppDbContext db) =>
        {
            var debt = await db.Debts.FindAsync(id);
            if (debt is null) return Results.NotFound();

            var today = DateOnly.FromDateTime(DateTime.Today);
            var current = DebtPayoffCalculator.Calculate(debt.Balance, debt.Apr, debt.MonthlyPayment, today);
            var whatIf = DebtPayoffCalculator.Calculate(debt.Balance, debt.Apr, monthlyPayment, today);

            return Results.Ok(new WhatIfComparison(
                current, whatIf,
                current.Months - whatIf.Months,
                current.TotalInterest - whatIf.TotalInterest));
        });

        group.MapGet("/avalanche", async (decimal? extra, AppDbContext db) =>
        {
            var today = DateOnly.FromDateTime(DateTime.Today);
            var debts = await db.Debts
            .Select(d => new PlannerDebt(d.Id, d.Name, d.Balance, d.Apr, d.MonthlyPayment))
            .ToListAsync();

            return AvalanchePlanner.Plan(debts, today, extra ?? 0);
        });

        return group;
    }
}