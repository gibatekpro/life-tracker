using LifeTracker.Api.Features.Debts;

namespace LifeTracker.Api.Tests;

public class AvalanchePlannerTests
{
    private static readonly DateOnly Start = new(2026, 10, 1);

    [Fact]
    public void NoDebts_IsAlreadyDebtFree()
    {
        var plan = AvalanchePlanner.Plan([], Start);

        Assert.True(plan.CanBePaidOff);
        Assert.Equal(0, plan.Months);
        Assert.Empty(plan.Payoffs);
    }

    [Fact]
    public void SingleDebt_MatchesTheSingleDebtCalculator()
    {
        var plan = AvalanchePlanner.Plan([new PlannerDebt(1, "Card", 5000m, 24.9m, 250m)], Start);
        var single = DebtPayoffCalculator.Calculate(5000m, 24.9m, 250m, Start);

        Assert.Equal(single.Months, plan.Months);
        Assert.Equal(single.TotalInterest, plan.TotalInterest);
    }

    [Fact]
    public void ClearedDebtsPayment_RollsOverToTheNext()
    {
        // B on its own would take 6 months at £100. With A's £100 rolling over, it's 5.
        var plan = AvalanchePlanner.Plan(
        [
            new PlannerDebt(1, "A", 300m, 0m, 100m),
            new PlannerDebt(2, "B", 600m, 0m, 100m)
        ], Start);

        Assert.Equal(3, plan.Payoffs.Single(p => p.Id == 1).Month);
        Assert.Equal(5, plan.Payoffs.Single(p => p.Id == 2).Month);
        Assert.Equal(5, plan.Months);
    }

    [Fact]
    public void ExtraMoney_GoesToTheHighestAprFirst()
    {
        var plan = AvalanchePlanner.Plan(
        [
            new PlannerDebt(1, "High", 1000m, 30m, 50m),
            new PlannerDebt(2, "Low", 1000m, 10m, 50m)
        ], Start, extraPerMonth: 100m);

        Assert.Equal(1, plan.Payoffs[0].Id);
        Assert.Equal(8, plan.Payoffs[0].Month);
        Assert.Equal(11, plan.Months);
        Assert.Equal(174.00m, plan.TotalInterest);
    }

    [Fact]
    public void FixedBudget_KeepsAClearedDebtsPaymentWorking()
    {
        PlannerDebt[] debts =
        [
            new(1, "Already cleared", 0m, 0m, 100m),
        new(2, "B", 600m, 0m, 100m)
        ];

        var withoutBudget = AvalanchePlanner.Plan(debts, Start);
        var withBudget = AvalanchePlanner.Plan(debts, Start, monthlyBudget: 200m);

        Assert.Equal(6, withoutBudget.Months); // the cleared debt's £100 is lost
        Assert.Equal(3, withBudget.Months);    // the £100 keeps working on B
    }

    [Fact]
    public void BudgetBelowPlannedPayments_UsesThePlannedPayments()
    {
        var plan = AvalanchePlanner.Plan(
            [new PlannerDebt(1, "A", 600m, 0m, 100m)], Start, monthlyBudget: 50m);

        Assert.Equal(100m, plan.MonthlyBudget);
        Assert.Equal(6, plan.Months);
    }
}