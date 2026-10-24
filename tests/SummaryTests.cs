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
        _food = await TestCategories.IdAsync(db, "Food");
        _salary = await TestCategories.IdAsync(db, "Salary", CategoryKind.Income);
        return new Setup(db, new LedgerService(db, new ExchangeRateService(db), NullLogger<LedgerService>.Instance),
            settings, new SummaryService(db, settings, NullLogger<SummaryService>.Instance), lloyds);
    }

    private int _food, _salary;

    private LedgerEntry Expense(decimal amount, DateOnly date, int account) =>
        new(amount, "Shop", _food, date, TransactionType.Expense, account);

    private LedgerEntry Salary(decimal amount, DateOnly date, int account) =>
        new(amount, "Salary", _salary, date, TransactionType.Income, account);

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

    [Theory]
    // 28 Nov 2026 is a Saturday: the salary comes on Friday the 27th.
    [InlineData(2026, 11, 27, 2026, 11, 2026, 10)]
    // 28 Feb 2027 is a Sunday: the salary comes on Friday the 26th.
    [InlineData(2027, 2, 26, 2027, 2, 2027, 1)]
    public async Task SalaryPaidEarlyForAWeekendPayday_CountsTowardsTheMonthItsFor(
        int y, int m, int d, int forYear, int forMonth, int prevYear, int prevMonth)
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        Assert.Equal(DayOfWeek.Friday, new DateOnly(y, m, d).DayOfWeek);
        await s.Settings.UpdateAsync(2000m, null, IncomeMode.Recorded, monthStartDay: 28, earlyIncomeDays: 3);
        await s.Ledger.RecordAsync(Salary(2300m, new DateOnly(y, m, d), s.Lloyds));

        var month = await s.Summary.GetMonthlyAsync(forYear, forMonth);
        var previous = await s.Summary.GetMonthlyAsync(prevYear, prevMonth);

        Assert.Equal(2300m, month.MonthlyIncome);
        Assert.Equal(0m, previous.MonthlyIncome);
    }

    [Fact]
    public void FebruaryAndNovemberPaydays_AreReallyWeekends()
    {
        Assert.Equal(DayOfWeek.Saturday, new DateOnly(2026, 11, 28).DayOfWeek);
        Assert.Equal(DayOfWeek.Sunday, new DateOnly(2027, 2, 28).DayOfWeek);
    }

    [Fact]
    public async Task WithNoEarlyDays_AnEarlySalaryStaysInTheMonthItWasPaid()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Settings.UpdateAsync(2000m, null, IncomeMode.Recorded, monthStartDay: 28, earlyIncomeDays: 0);
        await s.Ledger.RecordAsync(Salary(2300m, new DateOnly(2026, 11, 27), s.Lloyds));

        Assert.Equal(2300m, (await s.Summary.GetMonthlyAsync(2026, 10)).MonthlyIncome);
        Assert.Equal(0m, (await s.Summary.GetMonthlyAsync(2026, 11)).MonthlyIncome);
    }

    [Fact]
    public async Task EarlyDays_DontMoveSpending()
    {
        var s = await SetupAsync();
        await using var _ = s.Db;
        await s.Settings.UpdateAsync(2000m, null, IncomeMode.Recorded, monthStartDay: 28, earlyIncomeDays: 3);
        await s.Ledger.RecordAsync(Expense(40m, new DateOnly(2026, 11, 27), s.Lloyds));

        Assert.Equal(40m, (await s.Summary.GetMonthlyAsync(2026, 10)).TotalSpent);
        Assert.Equal(0m, (await s.Summary.GetMonthlyAsync(2026, 11)).TotalSpent);
    }
}
