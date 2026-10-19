using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Summary;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using LifeTracker.Api.Features.Settings;
using Microsoft.Extensions.Options;
using LifeTracker.Api.Common;
namespace LifeTracker.Api.Features.Debts;

public record CreateDebtRequest(
    string Name, decimal Balance, decimal Apr, decimal MinimumPayment, decimal MonthlyPayment,
    bool PaymentsCountAsSpending = true);
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
public record RecordPaymentRequest(decimal Amount, DateOnly Date);
public record RecordPaymentResponse(int PaymentId, int DebtId, decimal NewBalance);
public record DebtPaymentDto(int Id, decimal Amount, DateOnly Date);

public record DebtSpendingFlagRequest(bool PaymentsCountAsSpending);

public static class DebtEndpoints
{
    public static RouteGroupBuilder MapDebtEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/debts").WithTags("Debts");

        group.MapGet("/", async (AppDbContext db) =>
        {
            var today = UkDate.Today();
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
            var debts = await db.Debts
                .Select(d => new PlannerDebt(d.Id, d.Name, d.Balance, d.Apr, d.MonthlyPayment))
                .ToListAsync();
            var s = await settings.GetAsync();

            return AvalanchePlanner.Plan(debts, today, extra ?? 0, s.MonthlyDebtBudget);
        });

        group.MapPost("/{id:int}/payments", async (int id, RecordPaymentRequest req, AppDbContext db) =>
        {
            if (req.Amount <= 0)
                return Results.BadRequest(new { error = "Payment must be above zero." });

            var debt = await db.Debts.FindAsync(id);
            if (debt is null) return Results.NotFound();

            if (req.Amount > debt.Balance)
                return Results.BadRequest(new { error = $"That's more than the £{debt.Balance:0.00} owed." });

            var transaction = new Transaction
            {
                Amount = req.Amount,
                Description = $"Payment to {debt.Name}",
                Category = "Debt",
                Date = req.Date,
                CountsAsSpending = debt.PaymentsCountAsSpending   // ← add this
            };

            var payment = new DebtPayment
            {
                Debt = debt,
                Transaction = transaction,
                Amount = req.Amount,
                Date = req.Date
            };

            debt.Balance -= req.Amount;
            db.DebtPayments.Add(payment);

            // One SaveChangesAsync = one database transaction: all three changes save, or none do.
            await db.SaveChangesAsync();

            return Results.Created($"/debts/{id}/payments/{payment.Id}",
                new RecordPaymentResponse(payment.Id, debt.Id, debt.Balance));
        });

        group.MapGet("/{id:int}/payments", async (int id, AppDbContext db) =>
            await db.DebtPayments
                .Where(p => p.DebtId == id)
                .OrderByDescending(p => p.Date)
                .Select(p => new DebtPaymentDto(p.Id, p.Amount, p.Date))
                .ToListAsync());


        group.MapPatch("/{id:int}/spending", async (int id, DebtSpendingFlagRequest req, AppDbContext db) =>
        {
            var debt = await db.Debts.FindAsync(id);
            if (debt is null) return Results.NotFound();

            debt.PaymentsCountAsSpending = req.PaymentsCountAsSpending;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
        return group;
    }
}