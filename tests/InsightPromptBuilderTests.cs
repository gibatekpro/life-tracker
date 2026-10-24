using LifeTracker.Api.Features.Insights;

namespace LifeTracker.Api.Tests;

public class InsightPromptBuilderTests
{
    private static readonly DateOnly Start = new(2026, 10, 28);

    private static InsightExpense E(int day, string merchant, string category, decimal pounds) =>
        new(Start.AddDays(day), merchant, category, pounds);

    private static InsightInput Input(
        IReadOnlyList<InsightExpense>? month = null, IReadOnlyList<InsightExpense>? recent = null,
        IReadOnlyList<InsightBudgetLine>? lines = null, IReadOnlyList<InsightDebt>? debts = null, InsightPlan? plan = null) =>
        new(Start, Start.AddDays(30), 10, 31, 2586m, false,
            month ?? [], recent ?? month ?? [], lines ?? [],
            871m, 999.13m, 715.87m, 23.5m,
            debts ?? [], plan, 12.40m);

    [Fact]
    public void Summary_HasIncomeBudgetAndInterest()
    {
        var text = InsightPromptBuilder.Build(Input());

        Assert.Contains("Budget month: 28 Oct 2026 to 27 Nov 2026 (day 10 of 31).", text);
        Assert.Contains("Income: 2586.00 (monthly take-home pay).", text);
        Assert.Contains("unallocated income 715.87", text);
        Assert.Contains("Interest and fees paid this month: 12.40.", text);
        Assert.Contains("All amounts are in GBP.", text);
    }

    [Fact]
    public void Categories_ShowSubcategoriesAndBudgetStatus()
    {
        var lines = new List<InsightBudgetLine>
        {
            new("Subscriptions", 35m, 38m, [new("AI", 35m, 38m, [new("Claude", 18m, 18m, []), new("OpenAI", 17m, 20m, [])])]),
            new("Gifts", 0m, 15m, []),
        };

        var text = InsightPromptBuilder.Build(Input(lines: lines));

        Assert.Contains("- Subscriptions: 38.00 (budget 35.00, 3.00 over)", text);
        Assert.Contains("  - AI: 38.00", text);
        Assert.Contains("    - Claude: 18.00 (budget 18.00, 0.00 left)", text);
        Assert.Contains("- Gifts: 15.00 (no budget)", text);
    }

    [Fact]
    public void TopMerchants_AreTotalledAcrossSpellings()
    {
        var text = InsightPromptBuilder.Build(Input(month:
        [
            E(1, "TESCO STORES", "Food", 20m), E(3, "Tesco Stores", "Food", 15.5m), E(4, "Netflix", "Subscriptions", 10.99m),
        ]));

        Assert.Contains("- Tesco Stores: 35.50 (2 payments)", text);
        Assert.Contains("- Netflix: 10.99 (1 payment)", text);
        Assert.True(text.IndexOf("Tesco Stores: 35.50", StringComparison.Ordinal) < text.IndexOf("Netflix: 10.99", StringComparison.Ordinal));
    }

    [Fact]
    public void DebtsAndPlan_AreDescribed()
    {
        var text = InsightPromptBuilder.Build(Input(
            debts: [new InsightDebt("Aqua", "credit card", 1433.47m, 29.65m, 278.30m, 0m, 278.30m)],
            plan: new InsightPlan(true, 4, new DateOnly(2027, 2, 1), 199.77m, 999.13m, ["Aqua", "Capital One"])));

        Assert.Contains("- Aqua (credit card): balance 1433.47, APR 29.65%, planned 278.30 this month, paid 0.00, avalanche plan suggests 278.30 this month", text);
        Assert.Contains("clears all debts by Feb 2027 (4 months), with 199.77 interest in total.", text);
        Assert.Contains("Payoff order (highest APR first): Aqua, Capital One.", text);
    }

    [Fact]
    public void AmountsAreRoundedToTwoPlaces()
    {
        var text = InsightPromptBuilder.Build(Input(month: [E(1, "Cafe", "Food", 2.345m), E(2, "Cafe", "Food", 1.0049m)]));

        Assert.Contains("- Cafe: 3.35 (2 payments)", text);   // 3.3499 -> 3.35
        Assert.Contains("Spending so far: 3.35", text);
    }

    [Theory]
    [InlineData("Card 4929 1234 5678 9012 refund")]
    [InlineData("Transfer 12-34-56 87654321")]
    [InlineData("Ref 0012345678")]
    public void LongNumbers_InDescriptions_AreMasked(string description)
    {
        var text = InsightPromptBuilder.Build(Input(month: [E(1, description, "Other", 5m)]));

        Assert.DoesNotMatch(@"\d(?:[ \-]?\d){5,}", text.Replace("2586.00", "").Replace("715.87", ""));
        Assert.Contains("•••", text);
    }

    [Fact]
    public void SystemPrompt_SetsTheTone()
    {
        Assert.Contains("UK", InsightPromptBuilder.SystemPrompt);
        Assert.Contains("GBP", InsightPromptBuilder.SystemPrompt);
        Assert.Contains("never judgemental", InsightPromptBuilder.SystemPrompt);
        Assert.Contains("high-interest debt", InsightPromptBuilder.SystemPrompt);
        Assert.Contains("not financial advice", InsightPromptBuilder.SystemPrompt);
    }

    // Recurring payments

    [Fact]
    public void SameMerchant_SimilarAmount_OnDifferentDays_IsRecurring()
    {
        var found = RecurringPayments.Find(
        [
            E(-60, "NETFLIX.COM", "Subscriptions", 10.99m), E(-30, "Netflix.com", "Subscriptions", 10.99m), E(0, "Netflix.com", "Subscriptions", 11.49m),
        ]);

        var r = Assert.Single(found);
        Assert.Equal(("Netflix.com", 10.99m, 3), (r.Merchant, r.TypicalAmount, r.Count));
    }

    [Fact]
    public void VaryingAmounts_AreNotRecurring()
    {
        Assert.Empty(RecurringPayments.Find([E(-20, "Tesco", "Food", 12m), E(-10, "Tesco", "Food", 48m), E(0, "Tesco", "Food", 25m)]));
    }

    [Fact]
    public void ASinglePayment_OrTwoOnTheSameDay_IsNotRecurring()
    {
        Assert.Empty(RecurringPayments.Find([E(0, "Gym", "Health", 30m)]));
        Assert.Empty(RecurringPayments.Find([E(0, "Cafe", "Food", 3m), E(0, "Cafe", "Food", 3m)]));
    }

    [Fact]
    public void WithinTenPercent_CountsAsSimilar()
    {
        var found = RecurringPayments.Find([E(-30, "Phone", "Bills", 20m), E(0, "Phone", "Bills", 22m)]);   // 22 is 10% above 20

        Assert.Single(found);
    }

    [Fact]
    public void Recurring_ShowsInTheSummary()
    {
        var text = InsightPromptBuilder.Build(Input(recent:
        [
            E(-31, "Spotify", "Subscriptions", 11.99m), E(0, "Spotify", "Subscriptions", 11.99m),
        ]));

        Assert.Contains("- Spotify: about 11.99, 2 times, last on 28 Oct 2026", text);
    }
}
