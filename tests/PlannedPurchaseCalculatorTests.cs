using LifeTracker.Api.Features.PlannedPurchases;
using LifeTracker.Api.Models;

namespace LifeTracker.Api.Tests;

// The same cases as core's plannedPurchases.test.ts: the forms preview with that copy, and the API
// saves with this one, so they must agree.
public class PlannedPurchaseCalculatorTests
{
    private static readonly DateOnly Nov = new(2026, 11, 1);
    private static DateOnly M(int year, int month) => new(year, month, 1);

    private static PurchasePlan Plan(decimal target, decimal saved, PlanBy by)
    {
        var result = PlannedPurchaseCalculator.Plan(target, saved, Nov, by);
        Assert.Null(result.Error);
        return result.Plan!;
    }

    private static string? Error(decimal target, decimal saved, PlanBy by) =>
        PlannedPurchaseCalculator.Plan(target, saved, Nov, by).Error;

    [Fact]
    public void ByTargetMonth_VisaFeesByJanuary_IsThreeEqualMonths()
    {
        Assert.Equal(new PurchasePlan(1330m, 3, M(2027, 1), 1330m), Plan(3990m, 0, new ByTargetMonth(M(2027, 1))));
    }

    [Fact]
    public void ByMonthlyAmount_RoundsTheMonthsUp_AndTheLastMonthIsSmaller()
    {
        Assert.Equal(new PurchasePlan(1500m, 3, M(2027, 1), 990m), Plan(3990m, 0, new ByMonthlyAmount(1500m)));
        Assert.Equal(new PurchasePlan(1330m, 3, M(2027, 1), 1330m), Plan(3990m, 0, new ByMonthlyAmount(1330m)));
    }

    [Fact]
    public void ByMonths_RoundsTheMonthlyAmountUpToThePenny()
    {
        Assert.Equal(new PurchasePlan(333.34m, 3, M(2027, 1), 333.32m), Plan(1000m, 0, new ByMonths(3)));
    }

    [Fact]
    public void WhatsAlreadySaved_IsTakenOffFirst()
    {
        Assert.Equal(new PurchasePlan(1495m, 2, M(2026, 12), 1495m), Plan(3990m, 1000m, new ByMonths(2)));
    }

    [Fact]
    public void PenniesThatTripUpFloatingPoint_StillCountExactly()
    {
        Assert.Equal(new PurchasePlan(0.10m, 11, M(2027, 9), 0.10m), Plan(1.10m, 0, new ByMonthlyAmount(0.10m)));
    }

    [Fact]
    public void ThisMonthAsTheTarget_IsOneMonthOfEverything()
    {
        Assert.Equal(new PurchasePlan(250m, 1, Nov, 250m), Plan(250m, 0, new ByTargetMonth(new DateOnly(2026, 11, 20))));
    }

    [Fact]
    public void ATargetMonth120MonthsAway_IsTheFurthestAllowed()
    {
        Assert.Equal(120, Plan(1200m, 0, new ByTargetMonth(M(2036, 10))).Months);
    }

    public static TheoryData<decimal, decimal, PlanBy, string> Invalid => new()
    {
        { 0m, 0m, new ByMonths(3), "Enter a target above zero." },
        { 3990m, 4000m, new ByMonths(3), "That's already saved: £4,000.00 of £3,990.00." },
        { 3990m, 0m, new ByMonthlyAmount(0m), "Enter a monthly amount above zero." },
        { 3990m, 0m, new ByMonthlyAmount(10m), "At £10.00 a month that takes 399 months; the most is 120." },
        { 3990m, 0m, new ByMonths(0), "Choose 1 to 120 months." },
        { 3990m, 0m, new ByMonths(121), "Choose 1 to 120 months." },
        { 3990m, 0m, new ByTargetMonth(new DateOnly(2026, 10, 1)), "The target month can't be in the past." },
        { 3990m, 0m, new ByTargetMonth(new DateOnly(2036, 11, 1)), "Choose a target month within 120 months." },
    };

    [Theory]
    [MemberData(nameof(Invalid))]
    public void InvalidChoices_SayWhatsWrong(decimal target, decimal saved, PlanBy by, string error)
    {
        Assert.Equal(error, Error(target, saved, by));
    }

    // Visa fees: £3,990 at £1,330 a month, November to January.
    private static PurchaseProgress Progress(DateOnly current, decimal saved, decimal before, decimal thisMonth) =>
        PlannedPurchaseCalculator.Progress(new ProgressInput(3990m, saved, 1330m, Nov, M(2027, 1), current, before, thisMonth));

    [Fact]
    public void FirstMonth_NothingYet_IsOnTrack_AndFinishesOnPlan()
    {
        Assert.Equal(new PurchaseProgress(0m, 3990m, 0m, 0m, true, 3, M(2027, 1)), Progress(Nov, 0, 0, 0));
    }

    [Fact]
    public void FirstMonth_Paid_IsAThirdOfTheWay()
    {
        Assert.Equal(new PurchaseProgress(1330m, 2660m, 33.3m, 0m, true, 3, M(2027, 1)), Progress(Nov, 1330m, 0, 1330m));
    }

    [Fact]
    public void SecondMonth_BeforePaying_IsStillOnTrack()
    {
        Assert.Equal(new PurchaseProgress(1330m, 2660m, 33.3m, 1330m, true, 2, M(2027, 1)), Progress(M(2026, 12), 1330m, 1330m, 0));
    }

    [Fact]
    public void SecondMonth_AfterSkippingTheFirst_IsBehind_WithNoFinishInSight()
    {
        var p = Progress(M(2026, 12), 0, 0, 0);

        Assert.False(p.OnTrack);
        Assert.Equal(1330m, p.NeededByNow);
        Assert.Null(p.ExpectedFinish);
    }

    [Fact]
    public void ExpectedFinish_FollowsThePaceSoFar()
    {
        // £1,330 in November and £500 so far in December: £915 a month, £2,160 to go.
        Assert.Equal(M(2027, 3), Progress(M(2026, 12), 1830m, 1330m, 500m).ExpectedFinish);
    }

    [Fact]
    public void PastTheTargetMonth_AndShort_IsBehind()
    {
        var p = Progress(M(2027, 2), 3000m, 3000m, 0);

        Assert.Equal((0, 3990m, false), (p.MonthsLeft, p.NeededByNow, p.OnTrack));
    }

    [Fact]
    public void Reached_Is100Percent_AndFinishedNow()
    {
        Assert.Equal(new PurchaseProgress(3990m, 0m, 100m, 1330m, true, 2, M(2026, 12)), Progress(M(2026, 12), 3990m, 1330m, 2660m));
    }

    [Fact]
    public void Percent_RoundsDown_SoItIsNever100UntilItIsThere()
    {
        Assert.Equal(99.9m, Progress(M(2027, 1), 3989.99m, 2659.99m, 1330m).Percent);
    }

    [Fact]
    public void APaceThatTakesMoreThan120Months_HasNoFinish()
    {
        // £10 over two whole months is £5 a month: 796 more months.
        Assert.Null(Progress(M(2027, 1), 10m, 10m, 0).ExpectedFinish);
    }

    [Theory]
    [InlineData(PlannedPurchaseStatus.Active, 3990, PlannedPurchaseStatus.Achieved)]
    [InlineData(PlannedPurchaseStatus.Active, 3989.99, PlannedPurchaseStatus.Active)]
    [InlineData(PlannedPurchaseStatus.Achieved, 3000, PlannedPurchaseStatus.Active)]
    [InlineData(PlannedPurchaseStatus.Bought, 0, PlannedPurchaseStatus.Bought)]
    [InlineData(PlannedPurchaseStatus.Cancelled, 5000, PlannedPurchaseStatus.Cancelled)]
    public void Achieved_FollowsTheMoney_ButBoughtAndCancelledStay(PlannedPurchaseStatus status, decimal saved, PlannedPurchaseStatus expected)
    {
        Assert.Equal(expected, PlannedPurchaseCalculator.StatusFor(status, saved, 3990m));
    }
}
