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
        var (result, error) = InsightResponseValidator.Validate(Good);

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

        var (result, _) = InsightResponseValidator.Validate(json);

        Assert.Equal(InsightResponseValidator.MaxItems, result!.SavingTips.Count);
        Assert.True(result.Summary.Length <= InsightResponseValidator.MaxText + 1);
    }

    [Fact]
    public void ValidatedResult_SurvivesStorage()
    {
        var (result, _) = InsightResponseValidator.Validate(Good);

        var back = InsightResponseValidator.Deserialize(InsightResponseValidator.Serialize(result!));

        Assert.Equal(result!.Summary, back.Summary);
        Assert.Equal(result.WasteItems.Single(), back.WasteItems.Single());
    }

    [Fact]
    public void Schema_IsValidJson_AndAsksForTheSameFields()
    {
        using var schema = JsonDocument.Parse(InsightResponseValidator.JsonSchema);
        var required = schema.RootElement.GetProperty("required").EnumerateArray().Select(e => e.GetString()).ToList();

        Assert.Equal(["summary", "wasteItems", "savingTips", "debtAdvice"], required);
        Assert.False(schema.RootElement.GetProperty("additionalProperties").GetBoolean());
    }
}
