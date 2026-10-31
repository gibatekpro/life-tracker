using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Insights;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace LifeTracker.Api.Tests;

// Purchase advice through real HTTP, in memory, against a throwaway database, with the fake model in
// place of OpenAI (as the insight tests do). The Testing environment means no user secrets load.
[Trait("Category", "Integration")]
public class PurchaseAdviceEndpointTests(PostgresFixture pg) : IClassFixture<PostgresFixture>
{
    private const string NetworkKey = "test-network-key";
    private const string Alias = "SECRET-ALIAS-XYZ";
    private const int CardId = 98765;

    private const string Advice = """
        {
          "verdict": "GoodIdea",
          "suggestedMonthlyAmount": 1000,
          "suggestedMonths": 3,
          "reasoning": "An essential with a deadline: save before overpaying the card. General information, not financial advice.",
          "risks": ["January bills could come in high."],
          "alternatives": []
        }
        """;

    private sealed class Api(string connectionString, string? openAIKey, FakeInsightModel model) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:LifeTracker", connectionString);
            builder.UseSetting("Security:ApiKey", NetworkKey);
            builder.UseSetting("OpenAI:ApiKey", openAIKey ?? "");
            builder.ConfigureTestServices(services => services.AddSingleton<IInsightModel>(model));
        }
    }

    private sealed record Setup(Api Api, HttpClient Client, FakeInsightModel Model, string Cs) : IDisposable
    {
        public void Dispose()
        {
            Client.Dispose();
            Api.Dispose();
        }
    }

    // A card with an alias, and a planned "Visa fees" (£3,990 over 3 months).
    private async Task<(Setup Setup, int VisaId)> SetupAsync(string? openAIKey = "sk-test-NOT-A-REAL-KEY")
    {
        var cs = pg.NewDatabase();
        await using (var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(cs).Options))
        {
            await db.Database.MigrateAsync();
            await db.Database.ExecuteSqlRawAsync($"""
                INSERT INTO "Accounts" ("Id", "Name", "Type", "Currency", "Balance", "Apr", "MinimumPayment", "MonthlyPayment", "CreatedAt")
                VALUES ({CardId}, 'Aqua', 'CreditCard', 'GBP', 900, 29.9, 25, 60, now());
                INSERT INTO "AccountAliases" ("AccountId", "Alias") VALUES ({CardId}, '{Alias}');
                """);
        }

        var model = new FakeInsightModel { Answer = Advice };
        var api = new Api(cs, openAIKey, model);
        var client = api.CreateClient();
        client.DefaultRequestHeaders.Add("X-Api-Key", NetworkKey);
        var visa = await client.PostAsJsonAsync("/planned-purchases",
            new { name = "Visa fees", targetAmount = 3990m, months = 3, isEssential = true, notes = "Due early January, ref 12345678" });
        return (new Setup(api, client, model, cs), (await Body(visa)).GetProperty("id").GetInt32());
    }

    private static async Task<JsonElement> Body(HttpResponseMessage r) => await r.Content.ReadFromJsonAsync<JsonElement>();
    private static async Task<string> Error(HttpResponseMessage r) => (await Body(r)).GetProperty("error").GetString()!;

    private static Task<HttpResponseMessage> Ask(Setup s, object body) => s.Client.PostAsJsonAsync("/planned-purchases/advice", body);

    [Fact]
    public async Task WithoutAKey_Returns503_AndNothingIsAsked()
    {
        var (s, visa) = await SetupAsync(openAIKey: null);
        using var _ = s;

        var r = await Ask(s, new { plannedPurchaseId = visa });

        Assert.Equal(HttpStatusCode.ServiceUnavailable, r.StatusCode);
        Assert.Equal("OpenAI key not configured", await Error(r));
        Assert.Empty(s.Model.Prompts);
    }

    [Fact]
    public async Task ASavedPurchase_IsAdvisedOn_AndTheAdviceIsSavedAndListed()
    {
        var (s, visa) = await SetupAsync();
        using var _ = s;

        var r = await Ask(s, new { plannedPurchaseId = visa });
        var advice = await Body(r);
        var list = await Body(await s.Client.GetAsync($"/planned-purchases/{visa}/advice"));

        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        Assert.Equal("purchase_advice", s.Model.Schemas.Single());
        var result = advice.GetProperty("result");
        Assert.Equal(("GoodIdea", 1000m, 4), (result.GetProperty("verdict").GetString(), result.GetProperty("suggestedMonthlyAmount").GetDecimal(),
            result.GetProperty("suggestedMonths").GetInt32()));   // 3990 at 1000 a month is 4 months, whatever the model said
        Assert.Equal((visa, "Visa fees"), (advice.GetProperty("plannedPurchaseId").GetInt32(), advice.GetProperty("name").GetString()));
        Assert.Equal(s.Model.Prompts.Single(), advice.GetProperty("promptSent").GetString());
        Assert.Equal(advice.GetProperty("id").GetInt32(), list.EnumerateArray().Single().GetProperty("id").GetInt32());
    }

    [Fact]
    public async Task WhatIsSent_DescribesThePurchaseAndMonth_WithNoIdsAliasesOrLongNumbers()
    {
        var (s, visa) = await SetupAsync();
        using var _ = s;

        await Ask(s, new { plannedPurchaseId = visa });
        var prompt = s.Model.Prompts.Single();

        Assert.Contains("- Name: Visa fees", prompt);
        Assert.Contains("- Their plan: 1330.00 a month for 3 months", prompt);
        Assert.Contains("- Saved as a planned purchase, with 1330.00 in this month's budget", prompt);
        Assert.Contains("- Aqua (credit card): balance 900.00, APR 29.9%", prompt);
        Assert.Contains("Other planned purchases ([essential] is a need, [want] otherwise):\n- none", prompt.ReplaceLineEndings("\n"));
        Assert.Contains("  > Due early January, ref •••", prompt);
        Assert.DoesNotContain("12345678", prompt);
        Assert.DoesNotContain(CardId.ToString(), prompt);
        Assert.DoesNotContain(Alias, prompt);
        Assert.DoesNotContain("Visa fees (", prompt);   // its savings account isn't a debt
    }

    [Fact]
    public async Task ADraft_CanBeAskedAboutBeforeSaving()
    {
        var (s, _) = await SetupAsync();
        using var __ = s;

        var r = await Ask(s, new { draft = new { name = "Laptop", targetAmount = 1200m, monthlyAmount = 100m, isEssential = false } });
        var advice = await Body(r);
        var prompt = s.Model.Prompts.Single();

        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        Assert.Equal(JsonValueKind.Null, advice.GetProperty("plannedPurchaseId").ValueKind);
        Assert.Contains("- Their plan: 100.00 a month", prompt);
        Assert.Contains("- A draft, not saved yet: it isn't in the budget", prompt);
        Assert.Contains("- Visa fees [essential]: target 3990.00", prompt);   // the saved one is another planned purchase here
    }

    [Fact]
    public async Task BadRequests_Are400_404_Or409_AndNothingIsAsked()
    {
        var (s, visa) = await SetupAsync();
        using var _ = s;

        var both = await Ask(s, new { plannedPurchaseId = visa, draft = new { name = "x", targetAmount = 1m } });
        var neither = await Ask(s, new { });
        var missing = await Ask(s, new { plannedPurchaseId = 999 });
        var noTarget = await Ask(s, new { draft = new { name = "Laptop", targetAmount = 0m } });
        var longNotes = await Ask(s, new { draft = new { name = "Laptop", targetAmount = 10m, notes = new string('n', 1001) } });
        await s.Client.PostAsync($"/planned-purchases/{visa}/cancel", null);
        var cancelled = await Ask(s, new { plannedPurchaseId = visa });

        Assert.Equal("Ask about a saved planned purchase or a draft, not both or neither.", await Error(both));
        Assert.Equal(HttpStatusCode.BadRequest, neither.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal("Enter a target above zero.", await Error(noTarget));
        Assert.Equal("Notes can be at most 1000 characters.", await Error(longNotes));
        Assert.Equal((HttpStatusCode.Conflict, "Visa fees is cancelled, so there's nothing to advise on."), (cancelled.StatusCode, await Error(cancelled)));
        Assert.Empty(s.Model.Prompts);
    }

    [Fact]
    public async Task AnUnusableAnswer_IsA502_AndNothingIsSaved()
    {
        var (s, visa) = await SetupAsync();
        using var _ = s;
        s.Model.Answer = """{"verdict":"Maybe","suggestedMonthlyAmount":1,"suggestedMonths":1,"reasoning":"x","risks":[],"alternatives":[]}""";

        var r = await Ask(s, new { plannedPurchaseId = visa });

        Assert.Equal(HttpStatusCode.BadGateway, r.StatusCode);
        Assert.Equal("OpenAI's answer couldn't be used: The answer had no verdict. Try again.", await Error(r));
        Assert.Empty((await Body(await s.Client.GetAsync($"/planned-purchases/{visa}/advice"))).EnumerateArray());
    }

    [Fact]
    public async Task ARateLimit_IsA429_WithTheFriendlyMessage()
    {
        var (s, visa) = await SetupAsync();
        using var _ = s;
        s.Model.Failure = new InsightModelException(InsightModelFailure.RateLimited, "OpenAI is busy or your usage limit has been reached. Try again in a minute.");

        var r = await Ask(s, new { plannedPurchaseId = visa });

        Assert.Equal(HttpStatusCode.TooManyRequests, r.StatusCode);
        Assert.Equal("OpenAI is busy or your usage limit has been reached. Try again in a minute.", await Error(r));
    }

    [Fact]
    public async Task TheKey_NeverAppearsInAnyResponse()
    {
        var (s, visa) = await SetupAsync();
        using var _ = s;

        var body = await (await Ask(s, new { plannedPurchaseId = visa })).Content.ReadAsStringAsync();
        var list = await (await s.Client.GetAsync($"/planned-purchases/{visa}/advice")).Content.ReadAsStringAsync();

        Assert.DoesNotContain("sk-test", body);
        Assert.DoesNotContain("sk-test", list);
    }
}
