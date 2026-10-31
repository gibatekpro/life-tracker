using LifeTracker.Api.Features.Budgets;
using LifeTracker.Api.Features.Summary;

namespace LifeTracker.Api.Tests;

public class BudgetCalculatorTests
{
    // A calendar October: 31 days.
    private static readonly BudgetPeriod October = BudgetPeriod.For(2026, 10, 1);

    private static BudgetCategory Cat(int id, string name, int? parent = null, decimal? def = null,
        decimal? month = null, bool archived = false) =>
        new(id, parent, name, 0, archived, def, month);

    private static BudgetMonth Calc(
        IEnumerable<BudgetCategory> categories, Dictionary<int, decimal>? spent = null,
        DateOnly? today = null, BudgetPeriod? period = null, decimal income = 2000m,
        IEnumerable<DebtInput>? debts = null, decimal? fallbackDebtBudget = null) =>
        BudgetCalculator.Calculate(new BudgetInput(
            period ?? October, today ?? new DateOnly(2026, 10, 10), income, categories.ToList(),
            spent ?? [], (debts ?? []).ToList(), fallbackDebtBudget));

    private static BudgetLine Line(BudgetMonth m, int id) => BudgetCalculator.Flatten(m.Lines).Single(l => l.CategoryId == id);

    // Amounts: default vs this month

    [Fact]
    public void Default_IsUsedWhenTheMonthHasNoAmount()
    {
        var m = Calc([Cat(1, "Council tax", def: 120m)]);

        Assert.Equal(120m, Line(m, 1).Planned);
    }

    [Fact]
    public void MonthAmount_WinsOverTheDefault()
    {
        var m = Calc([Cat(1, "Council tax", def: 120m, month: 125m)]);

        Assert.Equal(125m, Line(m, 1).Planned);
        Assert.Equal(120m, Line(m, 1).DefaultAmount);
    }

    [Fact]
    public void ZeroForTheMonth_TakesTheLineOffThisMonthsBudget()
    {
        var m = Calc([Cat(1, "Gym", def: 30m, month: 0m)]);

        Assert.Equal(0m, Line(m, 1).Planned);
        Assert.Equal(0m, m.PlannedSpending);
    }

    [Fact]
    public void CategoryWithNoBudgetAndNoSpending_IsLeftOut()
    {
        var m = Calc([Cat(1, "Food", def: 200m), Cat(2, "Gifts")]);

        Assert.Single(m.Lines);
    }

    [Fact]
    public void UnbudgetedSpending_StillShows()
    {
        var m = Calc([Cat(2, "Gifts")], new() { [2] = 15m });

        Assert.Equal(15m, Line(m, 2).Spent);
        Assert.Equal(-15m, Line(m, 2).Remaining);
        Assert.Null(Line(m, 2).PercentUsed);
    }

    [Fact]
    public void ArchivedCategory_LosesItsDefault_ButKeepsItsSpending()
    {
        var m = Calc([Cat(1, "Old gym", def: 30m, archived: true), Cat(2, "Old club", def: 10m, archived: true)],
            new() { [2] = 5m });

        Assert.DoesNotContain(m.Lines, l => l.CategoryId == 1);
        Assert.Equal(0m, Line(m, 2).Planned);
        Assert.Equal(5m, Line(m, 2).Spent);
    }

    // Roll-up

    [Fact]
    public void ParentWithoutItsOwnAmount_AddsUpItsChildren()
    {
        var m = Calc(
            [Cat(1, "Subscriptions"), Cat(2, "AI", parent: 1), Cat(3, "OpenAI", parent: 2, def: 20m), Cat(4, "Claude", parent: 2, def: 18m)],
            new() { [3] = 20m, [4] = 9m });

        Assert.Equal(38m, Line(m, 2).Planned);
        Assert.Equal(29m, Line(m, 2).Spent);
        Assert.Equal(38m, Line(m, 1).Planned);
        Assert.Equal(0m, Line(m, 1).OwnPlanned);
        Assert.Equal(38m, m.PlannedSpending);   // counted once, at the top
    }

    [Fact]
    public void ParentWithItsOwnAmount_AddsItToItsChildren_AndCountsDirectSpendingAgainstIt()
    {
        var m = Calc(
            [Cat(1, "Subscriptions", def: 10m), Cat(2, "Claude", parent: 1, def: 18m)],
            new() { [1] = 4m, [2] = 18m });

        var parent = Line(m, 1);
        Assert.Equal(10m, parent.OwnPlanned);
        Assert.Equal(4m, parent.OwnSpent);
        Assert.Equal(28m, parent.Planned);
        Assert.Equal(22m, parent.Spent);
        Assert.Equal(6m, parent.Remaining);
    }

    // Days and pace

    [Fact]
    public void FirstDayOfTheMonth_CountsTodayAsGoneAndLeft()
    {
        var m = Calc([Cat(1, "Food", def: 310m)], new() { [1] = 10m }, today: new DateOnly(2026, 10, 1));

        Assert.Equal((31, 1, 31), (m.DaysInPeriod, m.DaysElapsed, m.DaysLeft));
        Assert.Equal(310m, Line(m, 1).Projected);       // 10 a day for 31 days
        Assert.Equal(9.68m, Line(m, 1).DailyAllowance); // 300 left over 31 days
    }

    [Fact]
    public void LastDayOfTheMonth_HasOneDayLeft()
    {
        var m = Calc([Cat(1, "Food", def: 200m)], new() { [1] = 150m }, today: new DateOnly(2026, 10, 31));

        Assert.Equal((31, 1), (m.DaysElapsed, m.DaysLeft));
        Assert.Equal(150m, Line(m, 1).Projected);
        Assert.Equal(50m, Line(m, 1).DailyAllowance);
    }

    [Fact]
    public void MidMonth_ProjectsFromThePaceSoFar()
    {
        // 100 in the first 10 of 31 days heads for 310.
        var m = Calc([Cat(1, "Food", def: 200m)], new() { [1] = 100m }, today: new DateOnly(2026, 10, 10));

        Assert.Equal(310m, Line(m, 1).Projected);
        Assert.Equal(50m, Line(m, 1).PercentUsed);
    }

    [Fact]
    public void PaydayMonth_AcrossTheMonthEnd_CountsDaysFromPayday()
    {
        var period = BudgetPeriod.For(2026, 10, 25);   // 25 Oct to 24 Nov

        var m = Calc([Cat(1, "Food", def: 310m)], new() { [1] = 90m }, today: new DateOnly(2026, 11, 2), period: period);

        Assert.Equal((31, 9, 23), (m.DaysInPeriod, m.DaysElapsed, m.DaysLeft));
        Assert.Equal(new DateOnly(2026, 11, 24), m.PeriodEnd);
        Assert.Equal(310m, Line(m, 1).Projected);
    }

    [Theory]
    [InlineData(2027, 28)]   // February
    [InlineData(2028, 29)]   // February in a leap year
    public void February_HasItsOwnNumberOfDays(int year, int expectedDays)
    {
        var m = Calc([], period: BudgetPeriod.For(year, 2, 1), today: new DateOnly(year, 2, 14));

        Assert.Equal(expectedDays, m.DaysInPeriod);
        Assert.Equal(expectedDays - 13, m.DaysLeft);
    }

    [Fact]
    public void PastMonth_HasNoDaysLeft_AndProjectsWhatWasSpent()
    {
        var m = Calc([Cat(1, "Food", def: 200m)], new() { [1] = 120m }, today: new DateOnly(2026, 11, 15));

        Assert.Equal((31, 0), (m.DaysElapsed, m.DaysLeft));
        Assert.Equal(120m, Line(m, 1).Projected);
        Assert.Equal(0m, Line(m, 1).DailyAllowance);
        Assert.Equal(0m, m.SafeToSpendPerDay);
    }

    [Fact]
    public void FutureMonth_HasNoDaysGone()
    {
        var m = Calc([Cat(1, "Food", def: 200m)], today: new DateOnly(2026, 9, 20));

        Assert.Equal((0, 31), (m.DaysElapsed, m.DaysLeft));
        Assert.Equal(0m, Line(m, 1).Projected);
    }

    // Overspending

    [Fact]
    public void OverspentLine_HasNegativeRemaining_AndNothingPerDay()
    {
        var m = Calc([Cat(1, "Takeaways", def: 50m)], new() { [1] = 80m });

        var line = Line(m, 1);
        Assert.Equal(-30m, line.Remaining);
        Assert.Equal(160m, line.PercentUsed);
        Assert.Equal(0m, line.DailyAllowance);
    }

    // Month totals

    [Fact]
    public void Totals_UnallocatedAndSafeToSpend()
    {
        // 22 days left from 10 October.
        var m = Calc(
            [Cat(1, "Rent", def: 800m), Cat(2, "Food", def: 200m)],
            new() { [2] = 50m },
            debts: [new DebtInput(10, "Card", 300m, null, Paid: 100m, Suggested: 300m)]);

        Assert.Equal(1000m, m.PlannedSpending);
        Assert.Equal(300m, m.PlannedDebts);
        Assert.Equal(700m, m.Unallocated);            // 2000 - 1300
        // 2000 - 50 spent - 100 paid - (800 rent + 150 food + 200 card still set aside)
        Assert.Equal(700m, m.SafeToSpend);
        Assert.Equal(31.82m, m.SafeToSpendPerDay);    // 700 / 22
    }

    [Fact]
    public void Overspending_AndUnbudgetedSpending_ComeOutOfSafeToSpend()
    {
        var m = Calc([Cat(1, "Food", def: 200m), Cat(2, "Gifts")], new() { [1] = 260m, [2] = 40m });

        Assert.Equal(1800m, m.Unallocated);           // 2000 - 200
        Assert.Equal(1700m, m.SafeToSpend);           // 2000 - 300 spent, nothing left set aside
    }

    [Fact]
    public void SafeToSpend_CanGoNegative_ButNotPerDay()
    {
        var m = Calc([Cat(1, "Rent", def: 2500m)]);

        Assert.Equal(-500m, m.SafeToSpend);
        Assert.Equal(0m, m.SafeToSpendPerDay);
    }

    // Planned purchases (the Savings section)

    private static SavingsInput Saving(decimal monthly, decimal? month = null, decimal paid = 0, decimal stillNeeded = 3990m,
        bool active = true) =>
        new(1, 20, "Visa fees", true, active, monthly, month, paid, stillNeeded);

    private static BudgetMonth WithSavings(SavingsInput saving, IEnumerable<DebtInput>? debts = null, decimal? avalanche = null) =>
        BudgetCalculator.Calculate(new BudgetInput(
            October, new DateOnly(2026, 10, 10), 2000m, [Cat(1, "Rent", def: 800m)], new Dictionary<int, decimal>(),
            (debts ?? []).ToList(), 300m, avalanche, [saving]));

    [Fact]
    public void SavingsLine_IsTheMonthlyAmount_OrTheMonthsOwnFigure()
    {
        Assert.Equal(400m, WithSavings(Saving(400m)).Savings.Single().Planned);
        Assert.Equal(250m, WithSavings(Saving(400m, month: 250m)).Savings.Single().Planned);
    }

    [Fact]
    public void SavingsLine_IsCappedAtWhatsStillNeeded_AndZeroOnceReached()
    {
        Assert.Equal(90m, WithSavings(Saving(400m, stillNeeded: 90m)).Savings.Single().Planned);
        Assert.Equal(90m, WithSavings(Saving(400m, month: 500m, stillNeeded: 90m)).Savings.Single().Planned);
        Assert.Equal(0m, WithSavings(Saving(400m, stillNeeded: 0m)).Savings.Single().Planned);
    }

    [Fact]
    public void BoughtOrCancelled_LosesItsDefault_ButKeepsAMonthFigureAndWhatWasPaid()
    {
        var line = WithSavings(Saving(400m, paid: 50m, active: false)).Savings.Single();
        var withFigure = WithSavings(Saving(400m, month: 100m, active: false)).Savings.Single();

        Assert.Equal((0m, 50m, -50m), (line.Planned, line.Paid, line.Remaining));
        Assert.Equal(100m, withFigure.Planned);
    }

    [Fact]
    public void Savings_CountInThePlannedTotal_UnallocatedAndSafeToSpend()
    {
        var m = WithSavings(Saving(400m, paid: 150m));

        Assert.Equal((400m, 150m, 37.5m), (m.PlannedSavings, m.SavingsPaid, m.Savings.Single().PercentUsed));
        Assert.Equal(1200m, m.TotalPlanned);           // 800 rent + 400 savings
        Assert.Equal(800m, m.Unallocated);             // 2000 - 1200
        // 2000 - 150 saved - (800 rent + 250 savings still set aside)
        Assert.Equal(800m, m.SafeToSpend);
    }

    [Fact]
    public void Savings_NeverCountTowardsTheDebtBudgetOrTheAvalanche()
    {
        var card = new DebtInput(10, "Card", 100m, null, Paid: 0m, Suggested: 100m);
        var without = BudgetCalculator.Calculate(new BudgetInput(
            October, new DateOnly(2026, 10, 10), 2000m, [], new Dictionary<int, decimal>(), [card], 300m, 300m));

        // A month figure on the savings line, and money paid into it, change nothing on the debt side.
        var with = WithSavings(Saving(400m, month: 450m, paid: 600m), [card], avalanche: 300m);

        Assert.Equal((without.PlannedDebts, without.DebtBudget, without.HasMonthDebtAmounts), (with.PlannedDebts, with.DebtBudget, with.HasMonthDebtAmounts));
        Assert.Equal((200m, 0m, 0m), (with.AvalancheExtra, with.AvalancheExtraPaid, with.DebtPaid));
        Assert.Equal(300m, with.DebtBudget);           // still the Settings fallback
    }

    // Debts and the avalanche budget

    [Fact]
    public void DebtLines_UseTheMonthAmountOverTheDefault()
    {
        var m = Calc([], debts:
        [
            new DebtInput(10, "Aqua", 44.25m, 100m, 0m, 120m),
            new DebtInput(11, "Klarna", 441m, null, 441m, 441m),
        ]);

        Assert.Equal(100m, m.Debts.Single(d => d.AccountId == 10).Planned);
        Assert.Equal(0m, m.Debts.Single(d => d.AccountId == 11).Remaining);
        Assert.Equal(120m, m.Debts.Single(d => d.AccountId == 10).Suggested);
    }

    [Fact]
    public void WithoutMonthDebtAmounts_TheDebtBudgetIsTheSettingsFallback()
    {
        var m = Calc([], debts: [new DebtInput(10, "Aqua", 44.25m, null, 0m, null)], fallbackDebtBudget: 500m);

        Assert.False(m.HasMonthDebtAmounts);
        Assert.Equal(500m, m.DebtBudget);
    }

    [Fact]
    public void WithAMonthDebtAmount_TheDebtBudgetIsTheSumOfTheDebtLines()
    {
        var m = Calc([], debts:
        [
            new DebtInput(10, "Aqua", 44.25m, 150m, 0m, null),
            new DebtInput(11, "Capital One", 80.70m, null, 0m, null),
        ], fallbackDebtBudget: 500m);

        Assert.True(m.HasMonthDebtAmounts);
        Assert.Equal(230.70m, m.DebtBudget);
    }

    [Fact]
    public void NairaLoanWithNoRate_PlansNothingUntilItHasOne()
    {
        var m = Calc([], debts: [new DebtInput(12, "Loan app", null, null, 0m, null)]);

        Assert.Equal(0m, m.Debts.Single().Planned);
    }

    // The line a capture is measured against, and its notification

    [Fact]
    public void LineFor_UsesTheNearestBudgetedCategory()
    {
        BudgetCategory[] cats = [Cat(1, "Subscriptions", def: 50m), Cat(2, "AI", parent: 1), Cat(3, "Claude", parent: 2)];
        var m = Calc(cats, new() { [3] = 18m });

        var line = BudgetCalculator.LineFor(m, 3, cats);

        Assert.Equal(1, line!.CategoryId);
        Assert.Equal(18m, line.Spent);
    }

    [Fact]
    public void LineFor_IsNullWhenNothingAboveHasABudget()
    {
        BudgetCategory[] cats = [Cat(1, "Gifts")];
        var m = Calc(cats, new() { [1] = 10m });

        Assert.Null(BudgetCalculator.LineFor(m, 1, cats));
    }

    [Fact]
    public void Notification_ShowsSpentPlannedAndPerDay()
    {
        var m = Calc([Cat(1, "Food", def: 200m)], new() { [1] = 150m }, today: new DateOnly(2026, 10, 17));

        // 50 left over 15 days (17th to 31st).
        Assert.Equal("Food: £150.00 of £200.00 · £3.33/day left", BudgetCalculator.Notification(Line(m, 1)));
    }

    [Fact]
    public void Notification_SaysHowFarOver()
    {
        var m = Calc([Cat(1, "Food", def: 200m)], new() { [1] = 230m });

        Assert.Equal("Food: £230.00 of £200.00 · £30.00 over", BudgetCalculator.Notification(Line(m, 1)));
    }

    // Debts in their own currency

    [Fact]
    public void NairaDebt_CountsInPounds_AndShowsInNaira()
    {
        // ₦30,000 set for the month, at £0.0005 per ₦: £15. ₦20,000 has arrived (£10 sent).
        var m = Calc([], debts:
        [
            new DebtInput(12, "Loan app", DefaultAmount: 12.50m, MonthAmount: 15m, Paid: 10m, Suggested: 15m,
                Currency: "NGN", Rate: 0.0005m, NativeDefault: 25000m, NativeMonthAmount: 30000m, NativePaid: 20000m),
        ]);

        var d = m.Debts.Single();
        Assert.Equal((15m, 10m, 5m), (d.Planned, d.Paid, d.Remaining));
        Assert.Equal((30000m, 20000m, 10000m), (d.NativePlanned, d.NativePaid, d.NativeRemaining));
        Assert.Equal(30000m, d.NativeSuggested);    // £15 back in naira
        Assert.Equal(15m, m.PlannedDebts);          // the £ figure is what comes off unallocated
        Assert.Equal(1985m, m.Unallocated);
    }

    [Fact]
    public void SuggestionThatIsTheInstalment_IsTheExactNairaInstalment()
    {
        // ₦170,574 at 0.00052 is £88.70 (rounded); £88.70 back would be ₦170,576.92.
        var m = Calc([], debts:
        [
            new DebtInput(12, "Loan app", DefaultAmount: 88.70m, MonthAmount: null, Paid: 0m, Suggested: 88.70m,
                Currency: "NGN", Rate: 0.00052m, NativeDefault: 170574m, NativeMonthAmount: null, NativePaid: 0m),
        ]);

        Assert.Equal(170574m, m.Debts.Single().NativeSuggested);
    }

    [Fact]
    public void NairaDebtWithNoRate_KeepsItsNairaFigure_ButCountsNothingInPounds()
    {
        var m = Calc([], debts:
        [
            new DebtInput(12, "Loan app", null, null, 0m, null,
                Currency: "NGN", Rate: null, NativeDefault: 25000m, NativeMonthAmount: 30000m, NativePaid: 0m),
        ]);

        var d = m.Debts.Single();
        Assert.Equal(0m, d.Planned);
        Assert.Equal(30000m, d.NativePlanned);
        Assert.Null(d.Rate);
        Assert.True(m.HasMonthDebtAmounts);         // a naira figure still counts as set for the month
    }

    [Fact]
    public void PoundDebt_HasTheSameFiguresInItsOwnCurrency()
    {
        var m = Calc([], debts: [new DebtInput(10, "Aqua", 44.25m, 100m, 30m, 120m)]);

        var d = m.Debts.Single();
        Assert.Equal((100m, 30m, 70m, 120m), (d.NativePlanned, d.NativePaid, d.NativeRemaining, d.NativeSuggested));
        Assert.Equal("GBP", d.Currency);
    }

    // The debt total matches the avalanche plan

    private static BudgetMonth WithPlan(decimal? avalanche, params DebtInput[] debts) =>
        BudgetCalculator.Calculate(new BudgetInput(
            October, new DateOnly(2026, 10, 10), 2000m, [], new Dictionary<int, decimal>(), debts, 800m, avalanche));

    [Fact]
    public void PlanPayingMoreThanTheDebtLines_ShowsTheDifferenceAsExtra()
    {
        // The £800 debt budget against £100 + £50 of payments.
        var m = WithPlan(800m, new DebtInput(1, "A", 100m, null, 0m, null), new DebtInput(2, "B", 50m, null, 0m, null));

        Assert.Equal(650m, m.AvalancheExtra);
        Assert.Equal(800m, m.PlannedDebts);         // what the plan pays
        Assert.Equal(1200m, m.Unallocated);         // 2000 - 800
        Assert.Equal(1200m, m.SafeToSpend);         // nothing paid yet: all £800 set aside
    }

    [Fact]
    public void PlanMatchingTheDebtLines_HasNoExtra()
    {
        var m = WithPlan(150m, new DebtInput(1, "A", 100m, null, 0m, null), new DebtInput(2, "B", 50m, null, 0m, null));

        Assert.Equal(0m, m.AvalancheExtra);
        Assert.Equal(150m, m.PlannedDebts);
    }

    [Fact]
    public void PayingMoreThanALine_GoesTowardsTheExtra()
    {
        // £300 paid to A against its £100 line: £200 of the £650 extra is done.
        var m = WithPlan(800m, new DebtInput(1, "A", 100m, null, 300m, null), new DebtInput(2, "B", 50m, null, 0m, null));

        Assert.Equal(200m, m.AvalancheExtraPaid);
        // 2000 - 300 paid - (B's 50 + 450 of extra still set aside)
        Assert.Equal(1200m, m.SafeToSpend);
    }

    [Fact]
    public void WithoutAPlan_ThereIsNoExtra()
    {
        var m = WithPlan(null, new DebtInput(1, "A", 100m, null, 0m, null));

        Assert.Equal(0m, m.AvalancheExtra);
        Assert.Equal(100m, m.PlannedDebts);
    }
}
