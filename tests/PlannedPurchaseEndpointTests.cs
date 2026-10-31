using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LifeTracker.Api.Common;
using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Summary;
using LifeTracker.Api.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Tests;

// Planned purchases through real HTTP, in memory, against a throwaway database (like the insight
// tests). Months are worked out from today's budget month, since the API plans from "now".
[Trait("Category", "Integration")]
public class PlannedPurchaseEndpointTests(PostgresFixture pg) : IClassFixture<PostgresFixture>
{
    private const string NetworkKey = "test-network-key";

    private sealed class Api(string connectionString) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:LifeTracker", connectionString);
            builder.UseSetting("Security:ApiKey", NetworkKey);
        }
    }

    private sealed record Setup(Api Api, HttpClient Client, string Cs, int Lloyds, int Other) : IDisposable
    {
        public AppDbContext Db() => new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(Cs).Options);

        public void Dispose()
        {
            Client.Dispose();
            Api.Dispose();
        }
    }

    private async Task<Setup> SetupAsync()
    {
        var cs = pg.NewDatabase();
        int lloyds, other;
        await using (var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(cs).Options))
        {
            await db.Database.MigrateAsync();
            var account = await db.Accounts.SingleAsync(a => a.Name == "Lloyds Current");
            account.Balance = 10000m;
            await db.SaveChangesAsync();
            lloyds = account.Id;
            other = await TestCategories.IdAsync(db, "Other");
        }

        var api = new Api(cs);
        var client = api.CreateClient();
        client.DefaultRequestHeaders.Add("X-Api-Key", NetworkKey);
        return new Setup(api, client, cs, lloyds, other);
    }

    // The budget month I'm in now (a fresh database has payday on the 1st), and others from it.
    private static readonly DateOnly ThisMonth = Now();
    private static DateOnly Now() { var p = BudgetPeriod.Containing(UkDate.Today(), 1); return new DateOnly(p.Year, p.Month, 1); }
    private static string Ym(int monthsFromNow) => ThisMonth.AddMonths(monthsFromNow).ToString("yyyy-MM", CultureInfo.InvariantCulture);
    private static readonly DateOnly Today = UkDate.Today();

    private static async Task<JsonElement> Body(HttpResponseMessage r) => await r.Content.ReadFromJsonAsync<JsonElement>();
    private static async Task<string> Error(HttpResponseMessage r) => (await Body(r)).GetProperty("error").GetString()!;

    private static async Task<JsonElement> CreateVisaFees(Setup s)
    {
        var r = await s.Client.PostAsJsonAsync("/planned-purchases",
            new { name = "Visa fees", targetAmount = 3990m, targetMonth = Ym(2), isEssential = true, notes = "Due in January" });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        return await Body(r);
    }

    private static Task<HttpResponseMessage> Transfer(Setup s, decimal amount, int from, int to) =>
        s.Client.PostAsJsonAsync("/transactions",
            new { amount, description = "Saving", date = Today, accountId = from, type = "Transfer", toAccountId = to, categoryId = (int?)null });

    private static async Task<JsonElement> Get(Setup s, int id) => await Body(await s.Client.GetAsync($"/planned-purchases/{id}"));

    [Fact]
    public async Task Create_MakesItsSavingsAccount_AndWorksOutThePlan()
    {
        using var s = await SetupAsync();

        var p = await CreateVisaFees(s);

        Assert.Equal((1330m, 3990m, 0m, 0m), (p.GetProperty("monthlyAmount").GetDecimal(), p.GetProperty("remaining").GetDecimal(),
            p.GetProperty("saved").GetDecimal(), p.GetProperty("percent").GetDecimal()));
        Assert.Equal((Ym(0), Ym(2), Ym(2)), (p.GetProperty("startMonth").GetString(), p.GetProperty("targetMonth").GetString(),
            p.GetProperty("expectedFinish").GetString()));
        Assert.Equal(("Active", true, true, 3), (p.GetProperty("status").GetString(), p.GetProperty("isEssential").GetBoolean(),
            p.GetProperty("onTrack").GetBoolean(), p.GetProperty("monthsLeft").GetInt32()));

        await using var db = s.Db();
        var account = await db.Accounts.SingleAsync(a => a.Id == p.GetProperty("accountId").GetInt32());
        Assert.Equal(("Visa fees", AccountType.Savings, "GBP", 0m), (account.Name, account.Type, account.Currency, account.Balance));
    }

    [Theory]
    [InlineData(null, null, null, "Choose a monthly amount, a number of months or a target month.")]
    [InlineData(500, 8, null, "Choose just one of a monthly amount, a number of months and a target month.")]
    [InlineData(null, 121, null, "Choose 1 to 120 months.")]
    [InlineData(null, null, -1, "The target month can't be in the past.")]
    [InlineData(10, null, null, "At £10.00 a month that takes 399 months; the most is 120.")]
    public async Task Create_RejectsABadPlan_AndMakesNoAccount(int? monthly, int? months, int? targetMonthsFromNow, string error)
    {
        using var s = await SetupAsync();

        var r = await s.Client.PostAsJsonAsync("/planned-purchases", new
        {
            name = "Visa fees", targetAmount = 3990m, monthlyAmount = (decimal?)monthly, months,
            targetMonth = targetMonthsFromNow is { } n ? Ym(n) : null,
        });

        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal(error, await Error(r));
        await using var db = s.Db();
        Assert.False(await db.Accounts.AnyAsync(a => a.Type == AccountType.Savings));
    }

    [Fact]
    public async Task Create_InAnExistingAccount_PlansFromWhatsSaved_AndOnlyInAnUnusedPoundSavingsAccount()
    {
        using var s = await SetupAsync();
        int savings, naira;
        await using (var db = s.Db())
        {
            var a = new Account { Name = "Laptop pot", Type = AccountType.Savings, Balance = 1000m };
            var n = new Account { Name = "Naira pot", Type = AccountType.Savings, Currency = "NGN" };
            db.Accounts.AddRange(a, n);
            await db.SaveChangesAsync();
            (savings, naira) = (a.Id, n.Id);
        }
        object Laptop(int accountId) => new { name = "Laptop", targetAmount = 1500m, months = 2, accountId };

        var current = await s.Client.PostAsJsonAsync("/planned-purchases", Laptop(s.Lloyds));
        var inNaira = await s.Client.PostAsJsonAsync("/planned-purchases", Laptop(naira));
        var created = await s.Client.PostAsJsonAsync("/planned-purchases", Laptop(savings));
        var again = await s.Client.PostAsJsonAsync("/planned-purchases", Laptop(savings));

        Assert.Equal("Lloyds Current isn't a savings account.", await Error(current));
        Assert.Equal("A planned purchase saves in pounds, so Naira pot needs to be a GBP account.", await Error(inNaira));
        var laptop = await Body(created);
        Assert.Equal((250m, 1000m, 66.6m), (laptop.GetProperty("monthlyAmount").GetDecimal(), laptop.GetProperty("saved").GetDecimal(),
            laptop.GetProperty("percent").GetDecimal()));
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal("Laptop pot is already saving for Laptop.", await Error(again));
    }

    [Fact]
    public async Task ReachingTheTarget_MarksItAchieved_AndTakingMoneyOutMakesItActiveAgain()
    {
        using var s = await SetupAsync();
        var p = await CreateVisaFees(s);
        var (id, account) = (p.GetProperty("id").GetInt32(), p.GetProperty("accountId").GetInt32());

        await Transfer(s, 1330m, s.Lloyds, account);
        var third = await Get(s, id);
        await Transfer(s, 2660m, s.Lloyds, account);
        var reached = await Get(s, id);
        await Transfer(s, 100m, account, s.Lloyds);
        var dipped = await Get(s, id);
        var list = await Body(await s.Client.GetAsync("/planned-purchases"));

        Assert.Equal((1330m, 33.3m, "Active"), (third.GetProperty("saved").GetDecimal(), third.GetProperty("percent").GetDecimal(), third.GetProperty("status").GetString()));
        Assert.Equal((100m, "Achieved", Ym(0)), (reached.GetProperty("percent").GetDecimal(), reached.GetProperty("status").GetString(), reached.GetProperty("expectedFinish").GetString()));
        Assert.Equal(("Active", 3890m), (dipped.GetProperty("status").GetString(), dipped.GetProperty("saved").GetDecimal()));
        Assert.Equal(id, list.EnumerateArray().Single().GetProperty("id").GetInt32());
    }

    [Fact]
    public async Task Budget_HasTheSavingsLine_WithWhatWasPaidIn()
    {
        using var s = await SetupAsync();
        var p = await CreateVisaFees(s);
        await Transfer(s, 500m, s.Lloyds, p.GetProperty("accountId").GetInt32());

        var budget = (await Body(await s.Client.GetAsync("/budgets/month"))).GetProperty("budget");
        var line = budget.GetProperty("savings").EnumerateArray().Single();

        Assert.Equal(("Visa fees", 1330m, 500m), (line.GetProperty("name").GetString(), line.GetProperty("planned").GetDecimal(), line.GetProperty("paid").GetDecimal()));
        Assert.Equal(1330m, budget.GetProperty("plannedSavings").GetDecimal());
    }

    [Fact]
    public async Task Update_ReplansFromWhatsSavedNow_AndKeepsTheStartMonth()
    {
        using var s = await SetupAsync();
        var p = await CreateVisaFees(s);
        var id = p.GetProperty("id").GetInt32();
        await Transfer(s, 990m, s.Lloyds, p.GetProperty("accountId").GetInt32());

        var r = await s.Client.PutAsJsonAsync($"/planned-purchases/{id}",
            new { name = "UK visa", targetAmount = 3990m, monthlyAmount = 1500m, isEssential = true });
        var updated = await Body(r);
        var noPlan = await s.Client.PutAsJsonAsync($"/planned-purchases/{id}", new { name = "UK visa", targetAmount = 3990m });

        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal(("UK visa", 1500m, Ym(1), Ym(0)), (updated.GetProperty("name").GetString(), updated.GetProperty("monthlyAmount").GetDecimal(),
            updated.GetProperty("targetMonth").GetString(), updated.GetProperty("startMonth").GetString()));
        Assert.Equal(JsonValueKind.Null, updated.GetProperty("notes").ValueKind);
        Assert.Equal("Choose a monthly amount, a number of months or a target month.", await Error(noPlan));
    }

    [Fact]
    public async Task Cancel_ChangesOnlyTheStatus_AndTheMoneyStays()
    {
        using var s = await SetupAsync();
        var p = await CreateVisaFees(s);
        var (id, account) = (p.GetProperty("id").GetInt32(), p.GetProperty("accountId").GetInt32());
        await Transfer(s, 700m, s.Lloyds, account);

        var cancelled = await Body(await s.Client.PostAsync($"/planned-purchases/{id}/cancel", null));
        var edit = await s.Client.PutAsJsonAsync($"/planned-purchases/{id}", new { name = "Visa", targetAmount = 3990m, months = 2 });

        Assert.Equal(("Cancelled", 700m), (cancelled.GetProperty("status").GetString(), cancelled.GetProperty("saved").GetDecimal()));
        Assert.Equal(HttpStatusCode.Conflict, edit.StatusCode);
        Assert.Equal("Visa fees is cancelled. It can't be changed.", await Error(edit));
    }

    [Fact]
    public async Task Bought_RecordsTheExpenseFromItsAccount_AndLeavesTheRest()
    {
        using var s = await SetupAsync();
        var p = await CreateVisaFees(s);
        var (id, account) = (p.GetProperty("id").GetInt32(), p.GetProperty("accountId").GetInt32());
        await Transfer(s, 4000m, s.Lloyds, account);

        var tooMuch = await s.Client.PostAsJsonAsync($"/planned-purchases/{id}/bought", new { amount = 4100m, categoryId = s.Other, date = Today });
        var stillAchieved = await Get(s, id);
        var bought = await s.Client.PostAsJsonAsync($"/planned-purchases/{id}/bought", new { amount = 3990m, categoryId = s.Other, date = Today });
        var again = await s.Client.PostAsJsonAsync($"/planned-purchases/{id}/bought", new { amount = 5m, categoryId = s.Other, date = Today });
        var cancel = await s.Client.PostAsync($"/planned-purchases/{id}/cancel", null);

        Assert.Equal("That's more than the 4000.00 GBP in Visa fees.", await Error(tooMuch));
        Assert.Equal("Achieved", stillAchieved.GetProperty("status").GetString());
        var body = await Body(bought);
        Assert.Equal(("Bought", 10m), (body.GetProperty("status").GetString(), body.GetProperty("saved").GetDecimal()));
        Assert.Equal((HttpStatusCode.Conflict, HttpStatusCode.Conflict), (again.StatusCode, cancel.StatusCode));

        await using var db = s.Db();
        var expense = await db.Transactions.SingleAsync(t => t.Type == TransactionType.Expense);
        Assert.Equal((account, 3990m, "Visa fees", s.Other), (expense.AccountId, expense.Amount, expense.Description, expense.CategoryId!.Value));
    }

    [Fact]
    public async Task ItsAccount_CantBeDeleted_OrStopBeingAPoundSavingsAccount()
    {
        using var s = await SetupAsync();
        var account = (await CreateVisaFees(s)).GetProperty("accountId").GetInt32();

        var delete = await s.Client.DeleteAsync($"/accounts/{account}");
        var toCurrent = await s.Client.PutAsJsonAsync($"/accounts/{account}", new { name = "Visa fees", type = "Current", balance = 0m });

        Assert.Equal((HttpStatusCode.Conflict, "This account is saving for Visa fees."), (delete.StatusCode, await Error(delete)));
        Assert.Equal(HttpStatusCode.Conflict, toCurrent.StatusCode);
    }

    [Fact]
    public async Task LiningUpItsBalance_CanMarkItAchieved()
    {
        using var s = await SetupAsync();
        var p = await CreateVisaFees(s);

        await s.Client.PutAsJsonAsync($"/accounts/{p.GetProperty("accountId").GetInt32()}", new { name = "Visa fees", type = "Savings", balance = 3990m });

        Assert.Equal("Achieved", (await Get(s, p.GetProperty("id").GetInt32())).GetProperty("status").GetString());
    }

    [Fact]
    public async Task ASavingsAccount_CantBeTheApplePayDefault()
    {
        using var s = await SetupAsync();
        var account = (await CreateVisaFees(s)).GetProperty("accountId").GetInt32();

        var r = await s.Client.PutAsJsonAsync("/settings/default-account", new { accountId = account });

        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("Visa fees is a savings account, so Apple Pay can't spend from it.", await Error(r));
    }
}
