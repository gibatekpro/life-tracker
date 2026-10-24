using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Features.Summary;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace LifeTracker.Api.Tests;

// My own exchange rates against real Postgres: which rate the ledger uses, the Settings option,
// and that stored £ values never move when a rate changes.
[Trait("Category", "Integration")]
public class ExchangeRateServiceTests(PostgresFixture pg) : IClassFixture<PostgresFixture>
{
    private static readonly DateOnly Oct1 = new(2026, 10, 1);

    private sealed record Setup(AppDbContext Db, ExchangeRateService Rates, LedgerService Ledger, SettingsService Settings,
        Account Lloyds, Account PalmPay, int Food);

    private async Task<Setup> SetupAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(pg.NewDatabase()).Options);
        await db.Database.MigrateAsync();
        var settings = new SettingsService(db, Options.Create(new BudgetOptions()), NullLogger<SettingsService>.Instance);
        await settings.GetAsync();

        var lloyds = await db.Accounts.SingleAsync(a => a.Name == "Lloyds Current");
        lloyds.Balance = 1000m;
        var palmPay = new Account { Name = "PalmPay", Type = AccountType.Current, Currency = "NGN" };
        db.Accounts.Add(palmPay);
        await db.SaveChangesAsync();

        var rates = new ExchangeRateService(db);
        return new Setup(db, rates, new LedgerService(db, rates, NullLogger<LedgerService>.Instance), settings,
            lloyds, palmPay, await TestCategories.IdAsync(db, "Food"));
    }

    private static LedgerEntry Market(Setup s, decimal naira) =>
        new(naira, "Market", s.Food, Oct1, TransactionType.Expense, s.PalmPay.Id);

    // £10 -> ₦18,000: a transfer rate of 1,800 per pound.
    private static LedgerEntry SendHome(Setup s) =>
        new(10m, "Send home", null, Oct1, TransactionType.Transfer, s.Lloyds.Id, s.PalmPay.Id, ToAmount: 18000m);

    [Fact]
    public async Task MyNairaToPoundRate_ValuesNairaSpending()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Ledger.RecordAsync(SendHome(s));
        await s.Rates.SetAsync("NGN", "GBP", 0.0005m);

        var market = await s.Ledger.RecordAsync(Market(s, 5000m));

        Assert.Equal(2.50m, market.Transaction!.GbpAmount);   // my rate, not the transfer's 2.78
    }

    [Fact]
    public async Task WithOnlyThePoundToNairaRate_ItsInverseIsUsed()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Rates.SetAsync("GBP", "NGN", 2000m);

        var market = await s.Ledger.RecordAsync(Market(s, 5000m));

        Assert.Equal(2.50m, market.Transaction!.GbpAmount);   // 5,000 / 2,000
    }

    [Fact]
    public async Task WithNoRateOfMine_TheLatestTransferIsUsed_AsBefore()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Ledger.RecordAsync(SendHome(s));

        var market = await s.Ledger.RecordAsync(Market(s, 5000m));

        Assert.Equal(2.78m, market.Transaction!.GbpAmount);   // 5,000 / 1,800
    }

    [Fact]
    public async Task UseTransferRates_PutsTheTransferBeforeMyRate()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Ledger.RecordAsync(SendHome(s));
        await s.Rates.SetAsync("NGN", "GBP", 0.0005m);
        await s.Settings.UpdateAsync(0m, null, useTransferRates: true);

        var market = await s.Ledger.RecordAsync(Market(s, 5000m));
        var quote = await s.Rates.GetAsync("NGN", "GBP");

        Assert.Equal(2.78m, market.Transaction!.GbpAmount);
        Assert.Equal(RateSource.Transfer, quote.Source);
    }

    [Fact]
    public async Task ChangingARate_NeverChangesTheStoredPoundValue()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Rates.SetAsync("NGN", "GBP", 0.0005m);
        var before = (await s.Ledger.RecordAsync(Market(s, 5000m))).Transaction!;

        await s.Rates.SetAsync("NGN", "GBP", 0.0004m);
        var after = (await s.Ledger.RecordAsync(Market(s, 5000m))).Transaction!;

        await using var fresh = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(s.Db.Database.GetConnectionString()!).Options);
        Assert.Equal(2.50m, (await fresh.Transactions.SingleAsync(t => t.Id == before.Id)).GbpAmount);   // unchanged
        Assert.Equal(2.00m, after.GbpAmount);                                                            // new rate
    }

    [Fact]
    public async Task ClearingMyRate_FallsBackToTheTransfer()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Ledger.RecordAsync(SendHome(s));
        await s.Rates.SetAsync("NGN", "GBP", 0.0005m);

        await s.Rates.ClearAsync("NGN", "GBP");

        Assert.Equal(RateSource.Transfer, (await s.Rates.GetAsync("NGN", "GBP")).Source);
    }

    [Fact]
    public async Task SettingAgain_ReplacesMyRate()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        await s.Rates.SetAsync("GBP", "NGN", 1850m);
        await s.Rates.SetAsync("GBP", "NGN", 1900m);

        Assert.Equal(1900m, (await s.Rates.GetAsync("GBP", "NGN")).Rate);
        Assert.Equal(1, await s.Db.ExchangeRates.CountAsync());
    }

    [Theory]
    [InlineData("GBP", "NGN", 0, "above zero")]
    [InlineData("GBP", "NGN", -5, "above zero")]
    [InlineData("GBP", "JPY", 150, "Rates are for")]
    [InlineData("NGN", "NGN", 1, "two different currencies")]
    public async Task InvalidRates_AreRefused(string from, string to, double rate, string message)
    {
        var s = await SetupAsync();
        await using var _ = s.Db;

        Assert.Contains(message, await s.Rates.SetAsync(from, to, (decimal)rate));
    }

    [Fact]
    public async Task All_ListsBothDirectionsForEachCurrencyInUse()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Rates.SetAsync("GBP", "NGN", 1850m);

        var all = await s.Rates.AllAsync();

        Assert.Equal([("GBP", "NGN", RateSource.Manual), ("NGN", "GBP", RateSource.InverseOfManual)],
            all.Select(q => (q.From, q.To, q.Source)));
    }
}
