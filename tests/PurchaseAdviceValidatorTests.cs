using LifeTracker.Api.Features.PlannedPurchases;

namespace LifeTracker.Api.Tests;

public class PurchaseAdviceValidatorTests
{
    private const string Good = """
        {
          "verdict": "GoodIdea",
          "suggestedMonthlyAmount": 1330,
          "suggestedMonths": 3,
          "reasoning": "  It fits: 1330 a month leaves room. General information, not financial advice.  ",
          "risks": ["A bill could come in high.", "  "],
          "alternatives": ["Start a month earlier."]
        }
        """;

    private static (PurchaseAdviceResult? Result, string? Error) V(string json, decimal remaining = 3990m) =>
        PurchaseAdviceValidator.Validate(json, remaining);

    [Fact]
    public void AGoodAnswer_IsTrimmed_AndBlankItemsDropped()
    {
        var (result, error) = V(Good);

        Assert.Null(error);
        Assert.Equal(AdviceVerdict.GoodIdea, result!.Verdict);
        Assert.Equal((1330m, 3), (result.SuggestedMonthlyAmount, result.SuggestedMonths));
        Assert.StartsWith("It fits", result.Reasoning);
        Assert.Equal(["A bill could come in high."], result.Risks);
        Assert.Equal(["Start a month earlier."], result.Alternatives);
    }

    [Fact]
    public void TheMonths_FollowTheAmount_SoTheyAlwaysAgree()
    {
        // 1000 a month covers 3990 in 4 months, whatever the model said.
        var (result, _) = V(Good.Replace("\"suggestedMonthlyAmount\": 1330", "\"suggestedMonthlyAmount\": 1000"));

        Assert.Equal((1000m, 4), (result!.SuggestedMonthlyAmount, result.SuggestedMonths));
    }

    [Fact]
    public void WithNothingStillNeeded_TheModelsMonthsAreKept()
    {
        Assert.Equal(3, V(Good, remaining: 0).Result!.SuggestedMonths);
    }

    [Theory]
    [InlineData("", "The answer was empty.")]
    [InlineData("not json", "The answer wasn't in the expected format.")]
    [InlineData("""{"verdict":"Maybe","suggestedMonthlyAmount":1,"suggestedMonths":1,"reasoning":"x","risks":[],"alternatives":[]}""", "The answer had no verdict.")]
    [InlineData("""{"verdict":"1","suggestedMonthlyAmount":1,"suggestedMonths":1,"reasoning":"x","risks":[],"alternatives":[]}""", "The answer had no verdict.")]
    [InlineData("""{"verdict":"GoodIdea","suggestedMonthlyAmount":100,"suggestedMonths":1,"reasoning":" ","risks":[],"alternatives":[]}""", "The answer had no reasoning.")]
    [InlineData("""{"verdict":"GoodIdea","suggestedMonthlyAmount":100,"suggestedMonths":1,"reasoning":"x","alternatives":[]}""", "The answer was missing a list.")]
    [InlineData("""{"verdict":"GoodIdea","suggestedMonthlyAmount":0,"suggestedMonths":1,"reasoning":"x","risks":[],"alternatives":[]}""", "The suggested monthly amount wasn't possible.")]
    [InlineData("""{"verdict":"GoodIdea","suggestedMonthlyAmount":10,"suggestedMonths":1,"reasoning":"x","risks":[],"alternatives":[]}""", "The suggested plan would take more than 120 months.")]
    public void UnusableAnswers_SayWhy(string json, string error)
    {
        Assert.Equal(error, V(json).Error);
    }

    [Fact]
    public void LongTextAndLongLists_AreCapped()
    {
        var longText = new string('a', 2000);
        var many = string.Join(",", Enumerable.Range(1, 8).Select(i => $"\"Risk {i}\""));
        var json = $$"""{"verdict":"Reconsider","suggestedMonthlyAmount":500,"suggestedMonths":8,"reasoning":"{{longText}}","risks":[{{many}}],"alternatives":[]}""";

        var result = V(json).Result!;

        Assert.Equal(PurchaseAdviceValidator.MaxReasoning + 1, result.Reasoning.Length);   // with the ellipsis
        Assert.Equal(5, result.Risks.Count);
    }

    [Fact]
    public void ItRoundTrips_WithTheVerdictAsText()
    {
        var result = V(Good).Result!;
        var json = PurchaseAdviceValidator.Serialize(result);

        Assert.Contains("\"verdict\":\"GoodIdea\"", json);
        Assert.Equal(result.Verdict, PurchaseAdviceValidator.Deserialize(json).Verdict);
    }
}
