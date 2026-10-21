using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Features.Summary;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace LifeTracker.Api.Tests;

// The monthly summary against real Postgres: payday-based months and recorded income.
[Trait("Category", "Integration")]
public class SummaryTests(PostgresFixture pg) : IClassFixture<PostgresFixture>
{
    private sealed record Setup(AppDbContext Db, LedgerService Ledger, SettingsService Settings, SummaryService Summary, int Lloyds);

    private async Task<Setup> SetupAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(pg.NewDatabase()).Options);
        await db.Database.MigrateAsync();
        var settings = new SettingsService(db, Options.Create(new BudgetOptions { MonthlyIncome = 2000m }), NullLogger<SettingsService>.Instance);
        var lloyds = (await db.Accounts.SingleAsync(a => a.Name == "Lloyds Current")).Id;
        return new Setup(db, new LedgerService(db, new ExchangeRateService(db), NullLogger<LedgerService>.Instance),
            settings, new SummaryService(db, settings, NullLogger<SummaryService>.Instance), lloyds);
    }

    private static LedgerEntry Expense(decimal amount, DateOnly date, int account) =>
        new(amount, "Shop", "Food", date, TransactionType.Expense, account);

    private static LedgerEntry Salary(decimal amount, DateOnly date, int account) =>
        new(amount, "Salary", "Salary", date, TransactionType.Income, account);

    [Fact]
    public async Task WithPayday_SpendingFollowsThePayPeriod()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Settings.UpdateAsync(2000m, null, monthStartDay: 25);
        await s.Ledger.RecordAsync(Expense(10m, new DateOnly(2026, 10, 24), s.Lloyds));   // September's period
        await s.Ledger.RecordAsync(Expense(20m, new DateOnly(2026, 10, 25), s.Lloyds));   // October's period
        await s.Ledger.RecordAsync(Expense(30m, new DateOnly(2026, 11, 24), s.Lloyds));   // still October's period

        var october = await s.Summary.GetMonthlyAsync(2026, 10);
        var september = await s.Summary.GetMonthlyAsync(2026, 9);

        Assert.Equal(new DateOnly(2026, 10, 25), october.PeriodStart);
        Assert.Equal(new DateOnly(2026, 11, 24), october.PeriodEnd);
        Assert.Equal(50m, october.TotalSpent);
        Assert.Equal(10m, september.TotalSpent);
    }

    [Fact]
    public async Task FixedIncome_UsesTheTakeHomePaySetting()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Ledger.RecordAsync(Salary(2300m, new DateOnly(2026, 10, 1), s.Lloyds));
        await s.Ledger.RecordAsync(Expense(100m, new DateOnly(2026, 10, 2), s.Lloyds));

        var summary = await s.Summary.GetMonthlyAsync(2026, 10);

        Assert.Equal(IncomeMode.Fixed, summary.IncomeMode);
        Assert.Equal(2000m, summary.MonthlyIncome);
        Assert.Equal(1900m, summary.Remaining);
    }

    [Fact]
    public async Task RecordedIncome_AddsUpTheIncomeInThePeriod()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Settings.UpdateAsync(2000m, null, IncomeMode.Recorded, 25);
        await s.Ledger.RecordAsync(Salary(2300m, new DateOnly(2026, 10, 25), s.Lloyds));
        await s.Ledger.RecordAsync(Salary(150m, new DateOnly(2026, 11, 2), s.Lloyds));    // a side job, same period
        await s.Ledger.RecordAsync(Salary(2300m, new DateOnly(2026, 9, 25), s.Lloyds));   // last period's pay
        await s.Ledger.RecordAsync(Expense(400m, new DateOnly(2026, 10, 30), s.Lloyds));

        var summary = await s.Summary.GetMonthlyAsync(2026, 10);

        Assert.Equal(IncomeMode.Recorded, summary.IncomeMode);
        Assert.Equal(2450m, summary.MonthlyIncome);
        Assert.Equal(2050m, summary.Remaining);
    }

    [Fact]
    public async Task UpdateWithoutTheNewFields_LeavesThemAlone()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Settings.UpdateAsync(2000m, null, IncomeMode.Recorded, 25);

        var saved = await s.Settings.UpdateAsync(2100m, 300m);

        Assert.Equal(IncomeMode.Recorded, saved.IncomeMode);
        Assert.Equal(25, saved.MonthStartDay);
    }
}
