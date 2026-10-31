using System.Globalization;
using LifeTracker.Api.Common;
using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Features.Summary;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Features.PlannedPurchases;

// A new planned purchase. Exactly one of MonthlyAmount, Months and TargetMonth ("2027-01", the last
// month I save in); the calculator works out the other two from what's already saved. AccountId: an
// existing GBP savings account; left out, a new one is made in the same save, named AccountName (or Name).
public record CreatePlannedPurchaseRequest(
    string Name, decimal TargetAmount, decimal? MonthlyAmount = null, int? Months = null, string? TargetMonth = null,
    bool IsEssential = false, string? Notes = null, int? AccountId = null, string? AccountName = null);

// Changing one: the same, without the account. Once what's saved covers the target, the plan can be
// left out, and the one it has is kept.
public record UpdatePlannedPurchaseRequest(
    string Name, decimal TargetAmount, decimal? MonthlyAmount = null, int? Months = null, string? TargetMonth = null,
    bool IsEssential = false, string? Notes = null);

// Buying it: an expense from its savings account. Description defaults to the purchase's name.
public record BoughtRequest(decimal Amount, int CategoryId, DateOnly Date, string? Description = null);

// A planned purchase with how it's going: Saved is its account's balance; months are "2027-01";
// ExpectedFinish is null when the pace so far won't get there within 120 months.
public record PlannedPurchaseDto(
    int Id, string Name, decimal TargetAmount, decimal MonthlyAmount, string StartMonth, string TargetMonth,
    bool IsEssential, PlannedPurchaseStatus Status, string? Notes, DateTime CreatedAt,
    int AccountId, string AccountName,
    decimal Saved, decimal Remaining, decimal Percent, decimal NeededByNow, bool OnTrack, int MonthsLeft,
    string? ExpectedFinish);

public enum PlannedPurchaseProblem { NotFound, Invalid, Conflict }

// Either the planned purchase, or what went wrong and how (the endpoint turns Problem into 404/400/409).
public record PlannedPurchaseResult(PlannedPurchaseDto? Purchase, PlannedPurchaseProblem? Problem = null, string? Error = null);

// The rules for planned purchases: one per GBP savings account, a plan worked out by the calculator,
// and the status. Achieved follows the money (LedgerService and account edits keep it right); cancelling
// leaves the money where it is; buying records the expense from its account in the same save.
public class PlannedPurchaseService(
    AppDbContext db, SettingsService settings, LedgerService ledger, ILogger<PlannedPurchaseService> logger)
{
    // Active and achieved ones first, by target month; then bought and cancelled ones.
    public async Task<List<PlannedPurchaseDto>> ListAsync()
    {
        var purchases = await db.PlannedPurchases.Include(p => p.Account).ToListAsync();
        var ordered = purchases
            .OrderBy(p => p.Status is PlannedPurchaseStatus.Active or PlannedPurchaseStatus.Achieved ? 0 : 1)
            .ThenBy(p => p.TargetMonth).ThenBy(p => p.Name)
            .ToList();
        return await ToDtosAsync(ordered);
    }

    public async Task<PlannedPurchaseDto?> GetAsync(int id) =>
        await db.PlannedPurchases.Include(p => p.Account).FirstOrDefaultAsync(p => p.Id == id) is { } p
            ? (await ToDtosAsync([p])).Single()
            : null;

    public async Task<PlannedPurchaseResult> CreateAsync(CreatePlannedPurchaseRequest req)
    {
        if (CheckDetails(req.Name, req.Notes) is { } invalid) return Fail(PlannedPurchaseProblem.Invalid, invalid);
        var (by, choiceError) = Choice(req.MonthlyAmount, req.Months, req.TargetMonth);
        if (choiceError is not null) return Fail(PlannedPurchaseProblem.Invalid, choiceError);
        if (by is null) return Fail(PlannedPurchaseProblem.Invalid, ChooseOne);

        // Everything is checked before a new account is added: any SaveChanges on the way (settings makes
        // its row on first use) would save a tracked account along with it.
        Account? existing = null;
        if (req.AccountId is { } accountId)
        {
            existing = await db.Accounts.FindAsync(accountId);
            if (existing is null) return Fail(PlannedPurchaseProblem.Invalid, $"Account {accountId} doesn't exist.");
            if (existing.Type != AccountType.Savings) return Fail(PlannedPurchaseProblem.Invalid, $"{existing.Name} isn't a savings account.");
            if (existing.Currency != Currencies.Home)
                return Fail(PlannedPurchaseProblem.Invalid, $"A planned purchase saves in pounds, so {existing.Name} needs to be a GBP account.");
            if (await db.PlannedPurchases.FirstOrDefaultAsync(p => p.AccountId == accountId) is { } other)
                return Fail(PlannedPurchaseProblem.Conflict, $"{existing.Name} is already saving for {other.Name}.");
        }
        var accountName = (string.IsNullOrWhiteSpace(req.AccountName) ? req.Name : req.AccountName).Trim();
        if (existing is null && accountName.Length > 100)
            return Fail(PlannedPurchaseProblem.Invalid, "The account's name can be at most 100 characters.");

        var month = await CurrentMonthAsync();
        var (plan, planError) = PlannedPurchaseCalculator.Plan(req.TargetAmount, existing?.Balance ?? 0, month, by);
        if (plan is null) return Fail(PlannedPurchaseProblem.Invalid, planError!);

        var account = existing ?? new Account { Name = accountName, Type = AccountType.Savings, Currency = Currencies.Home };

        var purchase = new PlannedPurchase
        {
            Name = req.Name.Trim(),
            TargetAmount = req.TargetAmount,
            MonthlyAmount = plan.MonthlyAmount,
            StartMonth = month,
            TargetMonth = plan.TargetMonth,
            IsEssential = req.IsEssential,
            Notes = Clean(req.Notes),
            Account = account,
        };
        db.PlannedPurchases.Add(purchase);
        await db.SaveChangesAsync();   // a new account and the purchase together, or neither

        logger.LogInformation("Created planned purchase {PlannedPurchaseId} ({Name}): £{Target}, £{Monthly}/month for {Months} months to {TargetMonth:yyyy-MM}, account {AccountId}{New}",
            purchase.Id, purchase.Name, purchase.TargetAmount, plan.MonthlyAmount, plan.Months, plan.TargetMonth, account.Id,
            req.AccountId is null ? " (new)" : "");
        return new PlannedPurchaseResult(await GetAsync(purchase.Id));
    }

    // Re-plans from what's saved now; the start month stays (that's when saving began).
    public async Task<PlannedPurchaseResult> UpdateAsync(int id, UpdatePlannedPurchaseRequest req)
    {
        var purchase = await db.PlannedPurchases.Include(p => p.Account).FirstOrDefaultAsync(p => p.Id == id);
        if (purchase is null) return Fail(PlannedPurchaseProblem.NotFound, $"Planned purchase {id} doesn't exist.");
        if (Closed(purchase) is { } closed) return Fail(PlannedPurchaseProblem.Conflict, $"{closed} It can't be changed.");
        if (CheckDetails(req.Name, req.Notes) is { } invalid) return Fail(PlannedPurchaseProblem.Invalid, invalid);
        var (by, choiceError) = Choice(req.MonthlyAmount, req.Months, req.TargetMonth);
        if (choiceError is not null) return Fail(PlannedPurchaseProblem.Invalid, choiceError);
        if (req.TargetAmount <= 0) return Fail(PlannedPurchaseProblem.Invalid, "Enter a target above zero.");

        var saved = purchase.Account.Balance;
        if (by is not null)
        {
            var (plan, planError) = PlannedPurchaseCalculator.Plan(req.TargetAmount, saved, await CurrentMonthAsync(), by);
            if (plan is null) return Fail(PlannedPurchaseProblem.Invalid, planError!);
            purchase.MonthlyAmount = plan.MonthlyAmount;
            purchase.TargetMonth = plan.TargetMonth;
        }
        else if (saved < req.TargetAmount)
            return Fail(PlannedPurchaseProblem.Invalid, ChooseOne);

        purchase.Name = req.Name.Trim();
        purchase.TargetAmount = req.TargetAmount;
        purchase.IsEssential = req.IsEssential;
        purchase.Notes = Clean(req.Notes);
        purchase.Status = PlannedPurchaseCalculator.StatusFor(purchase.Status, saved, purchase.TargetAmount);
        await db.SaveChangesAsync();

        logger.LogInformation("Updated planned purchase {PlannedPurchaseId} ({Name}): £{Target}, £{Monthly}/month to {TargetMonth:yyyy-MM}, {Status}",
            id, purchase.Name, purchase.TargetAmount, purchase.MonthlyAmount, purchase.TargetMonth, purchase.Status);
        return new PlannedPurchaseResult(await GetAsync(id));
    }

    // Only the status changes: the money stays in its account until I move it.
    public async Task<PlannedPurchaseResult> CancelAsync(int id)
    {
        var purchase = await db.PlannedPurchases.FindAsync(id);
        if (purchase is null) return Fail(PlannedPurchaseProblem.NotFound, $"Planned purchase {id} doesn't exist.");
        if (purchase.Status == PlannedPurchaseStatus.Bought) return Fail(PlannedPurchaseProblem.Conflict, $"{purchase.Name} is already bought.");

        purchase.Status = PlannedPurchaseStatus.Cancelled;
        await db.SaveChangesAsync();

        logger.LogInformation("Cancelled planned purchase {PlannedPurchaseId} ({Name})", id, purchase.Name);
        return new PlannedPurchaseResult(await GetAsync(id));
    }

    // Records the expense from its savings account and marks it bought, in the ledger's one save: the
    // status is changed on the tracked entity first, so LedgerService's SaveChangesAsync saves both (and
    // if the ledger refuses, nothing is saved). Anything left over stays in the account.
    public async Task<PlannedPurchaseResult> BoughtAsync(int id, BoughtRequest req)
    {
        var purchase = await db.PlannedPurchases.FindAsync(id);
        if (purchase is null) return Fail(PlannedPurchaseProblem.NotFound, $"Planned purchase {id} doesn't exist.");
        if (Closed(purchase) is { } closed) return Fail(PlannedPurchaseProblem.Conflict, closed);

        var previous = purchase.Status;
        purchase.Status = PlannedPurchaseStatus.Bought;
        var description = string.IsNullOrWhiteSpace(req.Description) ? purchase.Name : req.Description.Trim();
        var result = await ledger.RecordAsync(new LedgerEntry(
            req.Amount, description.Length > 200 ? description[..200] : description, req.CategoryId, req.Date,
            TransactionType.Expense, purchase.AccountId));
        if (result.Error is { } error)
        {
            purchase.Status = previous;
            return Fail(PlannedPurchaseProblem.Invalid, error);
        }

        logger.LogInformation("Planned purchase {PlannedPurchaseId} ({Name}) bought: transaction {TransactionId}, £{Amount}",
            id, purchase.Name, result.Transaction!.Id, req.Amount);
        return new PlannedPurchaseResult(await GetAsync(id));
    }

    private const string ChooseOne = "Choose a monthly amount, a number of months or a target month.";

    // Which way the plan was chosen: exactly one, or none (null); more than one is a mistake.
    private static (PlanBy? By, string? Error) Choice(decimal? monthly, int? months, string? targetMonth)
    {
        var given = (monthly is null ? 0 : 1) + (months is null ? 0 : 1) + (string.IsNullOrWhiteSpace(targetMonth) ? 0 : 1);
        if (given > 1) return (null, "Choose just one of a monthly amount, a number of months and a target month.");
        if (monthly is { } m) return (new ByMonthlyAmount(m), null);
        if (months is { } n) return (new ByMonths(n), null);
        if (string.IsNullOrWhiteSpace(targetMonth)) return (null, null);
        return DateOnly.TryParseExact(targetMonth.Trim(), "yyyy-MM", CultureInfo.InvariantCulture, DateTimeStyles.None, out var month)
            ? (new ByTargetMonth(month), null)
            : (null, "The target month should look like 2027-01.");
    }

    private static string? CheckDetails(string name, string? notes) =>
        string.IsNullOrWhiteSpace(name) || name.Trim().Length > 100 ? "A name is required, at most 100 characters."
        : notes?.Trim().Length > 1000 ? "Notes can be at most 1000 characters."
        : null;

    private static string? Closed(PlannedPurchase p) => p.Status switch
    {
        PlannedPurchaseStatus.Bought => $"{p.Name} is already bought.",
        PlannedPurchaseStatus.Cancelled => $"{p.Name} is cancelled.",
        _ => null
    };

    private static string? Clean(string? notes) => string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();

    // The budget month I'm in now (following payday), as the 1st of the month it's named after.
    private async Task<DateOnly> CurrentMonthAsync()
    {
        var p = BudgetPeriod.Containing(UkDate.Today(), (await settings.GetAsync()).MonthStartDay);
        return new DateOnly(p.Year, p.Month, 1);
    }

    // Each one with its progress: what's saved (its balance) and what came in since its start month,
    // before this budget month and during it (the calculator's pace).
    private async Task<List<PlannedPurchaseDto>> ToDtosAsync(IReadOnlyList<PlannedPurchase> purchases)
    {
        if (purchases.Count == 0) return [];
        var startDay = (await settings.GetAsync()).MonthStartDay;
        var now = BudgetPeriod.Containing(UkDate.Today(), startDay);
        var month = new DateOnly(now.Year, now.Month, 1);
        DateOnly PeriodStart(DateOnly m) => BudgetPeriod.For(m.Year, m.Month, startDay).Start;

        var ids = purchases.Select(p => p.AccountId).ToList();
        var from = PeriodStart(purchases.Min(p => p.StartMonth));
        var arrivals = await db.Transactions
            .Where(t => t.Type == TransactionType.Transfer && t.ToAccountId != null && ids.Contains(t.ToAccountId.Value) && t.Date >= from)
            .Select(t => new { AccountId = t.ToAccountId!.Value, t.Date, Arrived = t.ToAmount ?? t.Amount })
            .ToListAsync();

        return purchases.Select(p =>
        {
            var mine = arrivals.Where(t => t.AccountId == p.AccountId && t.Date >= PeriodStart(p.StartMonth)).ToList();
            var progress = PlannedPurchaseCalculator.Progress(new ProgressInput(
                p.TargetAmount, p.Account.Balance, p.MonthlyAmount, p.StartMonth, p.TargetMonth, month,
                mine.Where(t => t.Date < now.Start).Sum(t => t.Arrived),
                mine.Where(t => t.Date >= now.Start && t.Date < now.End).Sum(t => t.Arrived)));

            return new PlannedPurchaseDto(
                p.Id, p.Name, p.TargetAmount, p.MonthlyAmount, Ym(p.StartMonth), Ym(p.TargetMonth),
                p.IsEssential, p.Status, p.Notes, p.CreatedAt, p.AccountId, p.Account.Name,
                progress.Saved, progress.Remaining, progress.Percent, progress.NeededByNow, progress.OnTrack, progress.MonthsLeft,
                progress.ExpectedFinish is { } f ? Ym(f) : null);
        }).ToList();
    }

    private static string Ym(DateOnly month) => month.ToString("yyyy-MM", CultureInfo.InvariantCulture);

    private PlannedPurchaseResult Fail(PlannedPurchaseProblem problem, string error)
    {
        logger.LogWarning("Planned purchase rejected ({Problem}): {Reason}", problem, error);
        return new PlannedPurchaseResult(null, problem, error);
    }
}
