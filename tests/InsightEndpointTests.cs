using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Insights;
using LifeTracker.Api.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace LifeTracker.Api.Tests;

// Stands in for OpenAI: records what it was sent and answers with whatever the test sets.
public class FakeInsightModel : IInsightModel
{
    public const string GoodAnswer = """
        {
          "summary": "Most of your spending went on food.",
          "wasteItems": [{ "name": "Takeaways", "monthlyAmount": 40, "reason": "Several a week." }],
          "savingTips": [{ "tip": "Cook at home twice a week.", "estimatedMonthlySaving": 30 }],
          "debtAdvice": "Put savings towards the highest-APR card. General information, not financial advice."
        }
        """;

    public string Answer { get; set; } = GoodAnswer;
    public InsightModelException? Failure { get; set; }
    public List<string> Prompts { get; } = [];

    public Task<InsightModelReply> AskAsync(string systemPrompt, string prompt, CancellationToken cancellationToken)
    {
        if (Failure is not null) throw Failure;
        Prompts.Add(prompt);
        return Task.FromResult(new InsightModelReply(Answer, "fake-model", 1200, 300));
    }
}

// The insights API through real HTTP, in memory (WebApplicationFactory), against a throwaway
// database, with the fake model in place of OpenAI. The "Testing" environment means the API's
// user secrets (the real key and database) are never loaded.
[Trait("Category", "Integration")]
public class InsightEndpointTests(PostgresFixture pg) : IClassFixture<PostgresFixture>
{
    private const string NetworkKey = "test-network-key";
    private const string FakeOpenAIKey = "sk-test-NOT-A-REAL-KEY-12345";
    private const string Alias = "SECRET-ALIAS-XYZ";

    // Distinctive ids, short enough not to be masked as long numbers, so the test can show they're not sent.
    private const int CardId = 98765;
    private const int FoodId = 87654;

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

    private sealed record Setup(Api Api, HttpClient Client, FakeInsightModel Model) : IDisposable
    {
        public void Dispose()
        {
            Client.Dispose();
            Api.Dispose();
        }
    }

    // A migrated database with a card (with an alias), Lloyds, and October spending,
    // one of them with a card number typed into its description.
    private async Task<Setup> SetupAsync(string? openAIKey = FakeOpenAIKey)
    {
        var cs = pg.NewDatabase();
        await using (var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(cs).Options))
        {
            await db.Database.MigrateAsync();
            await db.Database.ExecuteSqlRawAsync($"""
                INSERT INTO "Categories" ("Id", "Name", "Kind", "SortOrder", "IsArchived", "CreatedAt", "DefaultMonthlyAmount")
                VALUES ({FoodId}, 'Groceries', 'Expense', 500, false, now(), 150);
                INSERT INTO "Accounts" ("Id", "Name", "Type", "Currency", "Balance", "Apr", "MinimumPayment", "MonthlyPayment", "CreatedAt")
                VALUES ({CardId}, 'Test Card', 'CreditCard', 'GBP', 900, 29.9, 25, 60, now());
                INSERT INTO "AccountAliases" ("AccountId", "Alias") VALUES ({CardId}, '{Alias}');
                INSERT INTO "Transactions" ("Amount", "GbpAmount", "Description", "Type", "Date", "CreatedAt", "AccountId", "CategoryId")
                VALUES (42.50, 42.50, 'Big Shop', 'Expense', DATE '2026-10-05', now(), {CardId}, {FoodId}),
                       (12.00, 12.00, 'Card 4929 1234 5678 9012 refund', 'Expense', DATE '2026-10-07', now(), {CardId}, {FoodId});
                """);
        }

        var model = new FakeInsightModel();
        var api = new Api(cs, openAIKey, model);
        var client = api.CreateClient();
        client.DefaultRequestHeaders.Add("X-Api-Key", NetworkKey);
        return new Setup(api, client, model);
    }

    private static Task<HttpResponseMessage> Generate(HttpClient c, bool regenerate = false) =>
        c.PostAsJsonAsync("/insights", new { year = 2026, month = 10, regenerate });

    private static async Task<string> Error(HttpResponseMessage r) =>
        (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("error").GetString()!;

    [Fact]
    public async Task WithoutAKey_Returns503_AndTheRestOfTheAppWorks()
    {
        using var s = await SetupAsync(openAIKey: null);

        var response = await Generate(s.Client);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("OpenAI key not configured", await Error(response));
        Assert.Empty(s.Model.Prompts);
        Assert.Equal(HttpStatusCode.OK, (await s.Client.GetAsync("/budgets/month?year=2026&month=10")).StatusCode);
    }

    [Fact]
    public async Task Generate_SavesTheInsight_AndItCanBeListedFetchedAndDeleted()
    {
        using var s = await SetupAsync();

        var created = await Generate(s.Client);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var insight = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = insight.GetProperty("id").GetInt32();

        Assert.Equal("Most of your spending went on food.", insight.GetProperty("result").GetProperty("summary").GetString());
        Assert.Equal(30, insight.GetProperty("result").GetProperty("savingTips")[0].GetProperty("estimatedMonthlySaving").GetDecimal());
        Assert.Equal((1200, 300), (insight.GetProperty("inputTokens").GetInt32(), insight.GetProperty("outputTokens").GetInt32()));
        Assert.Equal(s.Model.Prompts.Single(), insight.GetProperty("promptSent").GetString());   // exactly what was shared

        var list = await s.Client.GetFromJsonAsync<JsonElement>("/insights");
        Assert.Equal(id, list[0].GetProperty("id").GetInt32());
        Assert.Equal(HttpStatusCode.OK, (await s.Client.GetAsync($"/insights/{id}")).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await s.Client.DeleteAsync($"/insights/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await s.Client.GetAsync($"/insights/{id}")).StatusCode);
    }

    [Fact]
    public async Task AnExistingInsight_IsReturned_UnlessRegenerating()
    {
        using var s = await SetupAsync();

        var first = await (await Generate(s.Client)).Content.ReadFromJsonAsync<JsonElement>();
        var again = await Generate(s.Client);
        var regenerated = await Generate(s.Client, regenerate: true);

        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(first.GetProperty("id").GetInt32(), (await again.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32());
        Assert.Equal(HttpStatusCode.Created, regenerated.StatusCode);
        Assert.Equal(2, s.Model.Prompts.Count);   // OpenAI asked only twice
        Assert.Equal(2, (await s.Client.GetFromJsonAsync<JsonElement>("/insights")).GetArrayLength());
    }

    [Fact]
    public async Task WhatIsSent_HasNoIdsAliasesOrCardNumbers()
    {
        using var s = await SetupAsync();

        await Generate(s.Client);
        var prompt = s.Model.Prompts.Single();

        Assert.Contains("Groceries", prompt);
        Assert.Contains("Big Shop", prompt);
        Assert.Contains("Test Card (credit card): balance 900.00, APR 29.9%", prompt);
        Assert.DoesNotContain(CardId.ToString(), prompt);
        Assert.DoesNotContain(FoodId.ToString(), prompt);
        Assert.DoesNotContain(Alias, prompt);
        Assert.DoesNotContain("4929", prompt);
        Assert.Contains("Card ••• refund", prompt);
    }

    [Fact]
    public async Task AnUnusableAnswer_IsA502_AndNothingIsSaved()
    {
        using var s = await SetupAsync();
        s.Model.Answer = """{ "summary": "", "wasteItems": [], "savingTips": [], "debtAdvice": "x" }""";

        var response = await Generate(s.Client);

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.Contains("couldn't be used", await Error(response));
        Assert.Equal(0, (await s.Client.GetFromJsonAsync<JsonElement>("/insights")).GetArrayLength());
    }

    [Fact]
    public async Task ARateLimit_IsA429_WithAFriendlyMessage()
    {
        using var s = await SetupAsync();
        s.Model.Failure = new InsightModelException(InsightModelFailure.RateLimited, "OpenAI is busy. Try again in a minute.");

        var response = await Generate(s.Client);

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal("OpenAI is busy. Try again in a minute.", await Error(response));
    }

    [Fact]
    public async Task TheKey_NeverAppearsInAnyResponse()
    {
        using var s = await SetupAsync();

        var bodies = new List<string>
        {
            await (await Generate(s.Client)).Content.ReadAsStringAsync(),
            await s.Client.GetStringAsync("/insights"),
            await s.Client.GetStringAsync("/settings"),
            await (await s.Client.PostAsJsonAsync("/insights", new { year = 2026, month = 13 })).Content.ReadAsStringAsync(),
        };

        Assert.All(bodies, b => Assert.DoesNotContain(FakeOpenAIKey, b));
    }

    [Fact]
    public async Task ABadMonth_IsA400()
    {
        using var s = await SetupAsync();

        var response = await s.Client.PostAsJsonAsync("/insights", new { year = 2026, month = 13 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(s.Model.Prompts);
    }
}
