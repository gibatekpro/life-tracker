using System.Text.Json;
using LifeTracker.Api.Features.Insights;

namespace LifeTracker.Api.Tests;

public class InsightResponseValidatorTests
{
    private const string Good = """
        {
          "summary": "You spent most on food.",
          "wasteItems": [{ "name": "Takeaways", "monthlyAmount": 45.555, "reason": "Several a week." }],
          "savingTips": [{ "tip": "Cook twice a week.", "estimatedMonthlySaving": 30 }],
          "debtAdvice": "Put it towards Aqua. This is general information, not financial advice."
        }
        """;

    [Fact]
    public void AGoodAnswer_IsAccepted_AndAmountsRounded()
    {
        var (result, error, _) = InsightResponseValidator.Validate(Good);

        Assert.Null(error);
        Assert.Equal("You spent most on food.", result!.Summary);
        Assert.Equal(45.56m, result.WasteItems.Single().MonthlyAmount);
        Assert.Equal(30m, result.SavingTips.Single().EstimatedMonthlySaving);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("""{ "summary": "x" """)]
    public void NotJson_IsRejected(string json)
    {
        Assert.NotNull(InsightResponseValidator.Validate(json).Error);
    }

    [Theory]
    [InlineData("""{ "summary": " ", "wasteItems": [], "savingTips": [], "debtAdvice": "a" }""", "no summary")]
    [InlineData("""{ "summary": "a", "wasteItems": [], "savingTips": [], "debtAdvice": "" }""", "no debt advice")]
    [InlineData("""{ "summary": "a", "savingTips": [], "debtAdvice": "a" }""", "missing a list")]
    [InlineData("""{ "summary": "a", "wasteItems": [{ "name": "", "monthlyAmount": 1, "reason": "" }], "savingTips": [], "debtAdvice": "a" }""", "no name")]
    [InlineData("""{ "summary": "a", "wasteItems": [{ "name": "Gym", "monthlyAmount": -5, "reason": "" }], "savingTips": [], "debtAdvice": "a" }""", "impossible amount")]
    [InlineData("""{ "summary": "a", "wasteItems": [], "savingTips": [{ "tip": "x", "estimatedMonthlySaving": 500000 }], "debtAdvice": "a" }""", "impossible amount")]
    [InlineData("""{ "summary": "a", "wasteItems": [], "savingTips": [{ "tip": "x" }], "debtAdvice": "a" }""", "impossible amount")]
    public void MissingOrImpossibleParts_AreRejected(string json, string expected)
    {
        Assert.Contains(expected, InsightResponseValidator.Validate(json).Error);
    }

    [Fact]
    public void LongListsAndText_AreCapped()
    {
        var tips = string.Join(",", Enumerable.Range(1, 15).Select(i => $$"""{ "tip": "Tip {{i}}", "estimatedMonthlySaving": {{i}} }"""));
        var json = $$"""{ "summary": "{{new string('a', 3000)}}", "wasteItems": [], "savingTips": [{{tips}}], "debtAdvice": "a" }""";

        var (result, _, _) = InsightResponseValidator.Validate(json);

        Assert.Equal(InsightResponseValidator.MaxItems, result!.SavingTips.Count);
        Assert.True(result.Summary.Length <= InsightResponseValidator.MaxText + 1);
    }

    // Advice the prompt rules out is dropped, and only the rule is reported

    private static readonly HashSet<string> Essentials = InsightResponseValidator.EssentialLines(
    [
        new("Housing", 530m, 530m, [new("Rent", 530m, 530m, [], IsEssential: true)], IsEssential: true),
        new("Transport", 48m, 0m, [new("Bus", 48m, 0m, [], IsEssential: true)], IsEssential: true),
        new("Entertainment", 30m, 0m, [new("Cinema", 15m, 0m, [])]),
    ]);

    private static string Answer(string waste, string tips) =>
        $$"""{ "summary": "a", "wasteItems": [{{waste}}], "savingTips": [{{tips}}], "debtAdvice": "a" }""";

    // Today's case: day 1, rent paid, the bus not used yet, and the model suggests keeping transport at £0.
    [Theory]
    [InlineData("Transport")]
    [InlineData("transport")]
    [InlineData("Transport › Bus")]
    [InlineData("Bus")]
    public void ASavingThatCutsAnEssentialLine_IsDropped(string line)
    {
        var json = Answer("", $$"""
            { "tip": "Keep transport at £0 this month.", "estimatedMonthlySaving": 48, "line": "{{line}}" },
            { "tip": "Skip one cinema trip.", "estimatedMonthlySaving": 15, "line": "Cinema" }
            """);

        var (result, error, dropped) = InsightResponseValidator.Validate(json, Essentials);

        Assert.Null(error);
        var tip = Assert.Single(result!.SavingTips);
        Assert.Equal(("Skip one cinema trip.", "Cinema"), (tip.Tip, tip.Line));
        Assert.Equal([InsightResponseValidator.CutsEssentialLine], dropped);
        Assert.DoesNotContain(dropped, d => d.Contains("transport", StringComparison.OrdinalIgnoreCase));   // the rule, not the content
    }

    [Fact]
    public void ASavingOnNoLine_OrAFlexibleOne_IsKept()
    {
        var json = Answer("", """
            { "tip": "Switch to a cheaper SIM.", "estimatedMonthlySaving": 6, "line": "" },
            { "tip": "Pause the cinema.", "estimatedMonthlySaving": 15, "line": "Entertainment › Cinema" }
            """);

        var (result, _, dropped) = InsightResponseValidator.Validate(json, Essentials);

        Assert.Equal(2, result!.SavingTips.Count);
        Assert.Null(result.SavingTips[0].Line);
        Assert.Empty(dropped);
    }

    // A £1.80 vending purchase isn't "waste".
    [Fact]
    public void AnythingUnderFivePoundsAMonth_IsDropped()
    {
        var json = Answer(
            """{ "name": "Vending machine", "monthlyAmount": 1.80, "reason": "A snack." }, { "name": "Takeaways", "monthlyAmount": 45, "reason": "Often." }""",
            """{ "tip": "Bring a snack.", "estimatedMonthlySaving": 4.99, "line": "" }""");

        var (result, error, dropped) = InsightResponseValidator.Validate(json, Essentials);

        Assert.Null(error);
        Assert.Equal("Takeaways", Assert.Single(result!.WasteItems).Name);
        Assert.Empty(result.SavingTips);
        Assert.Equal([InsightResponseValidator.UnderMinimum, InsightResponseValidator.UnderMinimum], dropped);
    }

    [Fact]
    public void EmptyLists_AreAGoodAnswer()
    {
        var (result, error, dropped) = InsightResponseValidator.Validate(Answer("", ""), Essentials);

        Assert.Null(error);
        Assert.Empty(result!.WasteItems);
        Assert.Empty(result.SavingTips);
        Assert.Empty(dropped);
    }

    [Fact]
    public void EssentialLines_IncludeInheritedOnes_ButNotFlexible()
    {
        Assert.Equal(["housing", "rent", "transport", "bus"], Essentials);
    }

    // The answer to my question

    private static string WithAnswer(string answer) =>
        $$"""{ "summary": "a", "wasteItems": [], "savingTips": [], "debtAdvice": "a", "answer": {{answer}} }""";

    [Fact]
    public void AQuestion_NeedsAnAnswer()
    {
        var (result, error, _) = InsightResponseValidator.Validate(WithAnswer("\"  Yes, with £120 to spare.  \""), hasQuestion: true);

        Assert.Null(error);
        Assert.Equal("Yes, with £120 to spare.", result!.Answer);
    }

    [Theory]
    [InlineData("null")]
    [InlineData("\" \"")]
    public void AQuestion_WithNoAnswer_IsRejected(string answer)
    {
        Assert.Equal("It didn't answer your question.", InsightResponseValidator.Validate(WithAnswer(answer), hasQuestion: true).Error);
    }

    [Fact]
    public void NoQuestion_MeansNoAnswer()
    {
        Assert.Null(InsightResponseValidator.Validate(WithAnswer("null")).Result!.Answer);
        Assert.Null(InsightResponseValidator.Validate(Good).Result!.Answer);   // saved before answers existed
        Assert.Equal("It answered a question that wasn't asked.", InsightResponseValidator.Validate(WithAnswer("\"Yes.\"")).Error);
    }

    [Fact]
    public void ALongAnswer_IsCapped()
    {
        var (result, _, _) = InsightResponseValidator.Validate(WithAnswer($"\"{new string('a', 3000)}\""), hasQuestion: true);

        Assert.True(result!.Answer!.Length <= InsightResponseValidator.MaxAnswer + 1);
    }

    [Fact]
    public void ValidatedResult_SurvivesStorage()
    {
        var (result, _, _) = InsightResponseValidator.Validate(Good);

        var back = InsightResponseValidator.Deserialize(InsightResponseValidator.Serialize(result!));

        Assert.Equal(result!.Summary, back.Summary);
        Assert.Equal(result.WasteItems.Single(), back.WasteItems.Single());
    }

    [Fact]
    public void Schema_IsValidJson_AndAsksForTheSameFields()
    {
        using var schema = JsonDocument.Parse(InsightResponseValidator.JsonSchema);
        var required = schema.RootElement.GetProperty("required").EnumerateArray().Select(e => e.GetString()).ToList();

        Assert.Equal(["summary", "wasteItems", "savingTips", "debtAdvice", "answer"], required);
        Assert.False(schema.RootElement.GetProperty("additionalProperties").GetBoolean());

        var tip = schema.RootElement.GetProperty("properties").GetProperty("savingTips").GetProperty("items");
        Assert.Equal(["tip", "estimatedMonthlySaving", "line"], tip.GetProperty("required").EnumerateArray().Select(e => e.GetString()));
    }
}
