using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Features.Budgets;
using LifeTracker.Api.Features.Categories;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace LifeTracker.Api.Features.Insights;

public enum InsightProblem { NotConfigured, RateLimited, Timeout, Failed, Invalid }

// An insight (and whether it was just made), or what stopped it, with a message that's safe to show.
public record InsightOutcome(Insight? Insight, bool Created, InsightProblem? Problem = null, string? Error = null);

// Makes an AI insight for a budget month: gathers the month from the budget, transactions, debts and
// the avalanche plan, turns it into a summary (InsightPromptBuilder), asks the model, checks the answer
// (InsightResponseValidator) and saves both what was sent and what came back.
// The model is only asked when I press Generate; an existing insight is reused unless I regenerate
// or ask a question (a question always gets a fresh answer, and is saved with it).
public class InsightService(
    AppDbContext db, BudgetService budgets, ExchangeRateService rates, IInsightModel model,
    IOptions<OpenAIOptions> options, ILogger<InsightService> logger)
{
    // question: already checked and masked (InsightPromptBuilder.CleanQuestion), or null.
    public async Task<InsightOutcome> GenerateAsync(int year, int month, bool regenerate, string? question, CancellationToken cancellationToken)
    {
        if (!regenerate && question is null && await LatestForMonthAsync(year, month) is { } existing)
            return new InsightOutcome(existing, Created: false);

        if (!options.Value.IsConfigured)
            return new InsightOutcome(null, false, InsightProblem.NotConfigured, "OpenAI key not configured");

        var (periodStart, summary) = await SummariseAsync(year, month);
        var input = summary with { Question = question };
        var prompt = InsightPromptBuilder.Build(input);

        InsightModelReply reply;
        try
        {
            reply = await model.AskAsync(InsightPromptBuilder.SystemPrompt, prompt, cancellationToken);
        }
        catch (InsightModelException e)
        {
            var problem = e.Kind switch
            {
                InsightModelFailure.RateLimited => InsightProblem.RateLimited,
                InsightModelFailure.Timeout => InsightProblem.Timeout,
                InsightModelFailure.Invalid => InsightProblem.Invalid,
                _ => InsightProblem.Failed,
            };
            return new InsightOutcome(null, false, problem, e.Message);
        }

        var (result, error, dropped) = InsightResponseValidator.Validate(reply.Json, InsightResponseValidator.EssentialLines(input.BudgetLines),
            hasQuestion: question is not null);
        if (result is null)
        {
            logger.LogWarning("Insight for {Year}-{Month:00} discarded: {Reason}", year, month, error);
            return new InsightOutcome(null, false, InsightProblem.Invalid, $"OpenAI's answer couldn't be used: {error} Try again.");
        }
        // Only the rule and how often it was hit: never what the item said.
        foreach (var rule in dropped.GroupBy(r => r))
            logger.LogWarning("Insight for {Year}-{Month:00}: dropped {Count} item(s), {Rule}", year, month, rule.Count(), rule.Key);

        var insight = new Insight
        {
            PeriodStart = periodStart,
            Model = reply.Model,
            InputTokens = reply.InputTokens,
            OutputTokens = reply.OutputTokens,
            PromptSent = prompt,
            Question = question,
            ResponseJson = InsightResponseValidator.Serialize(result),
        };
        db.Insights.Add(insight);
        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Saved insight {InsightId} for {Year}-{Month:00}: {Model}, {InputTokens} + {OutputTokens} tokens, question {HasQuestion}",
            insight.Id, year, month, insight.Model, insight.InputTokens, insight.OutputTokens, question is not null);
        return new InsightOutcome(insight, Created: true);
    }

    // The month's newest insight without a question (one with a question answers that, so it isn't
    // the month's general read). Found by the month it's for, like budget figures, so changing payday
    // doesn't lose it.
    public Task<Insight?> LatestForMonthAsync(int year, int month)
    {
        var first = new DateOnly(year, month, 1);
        var next = first.AddMonths(1);
        return db.Insights.Where(i => i.PeriodStart >= first && i.PeriodStart < next && i.Question == null)
            .OrderByDescending(i => i.CreatedAt).ThenByDescending(i => i.Id)
            .FirstOrDefaultAsync();
    }

    // The month as InsightPromptBuilder takes it: names and amounts only, no IDs or aliases.
    private async Task<(DateOnly PeriodStart, InsightInput Input)> SummariseAsync(int year, int month)
    {
        var view = await budgets.GetMonthAsync(year, month);
        var b = view.Budget;
        var end = b.PeriodEnd.AddDays(1);
        var paths = await db.CategoryPathsAsync();

        var categories = await db.Categories.Select(c => new { c.Id, c.ParentId, c.Name, c.IsEssential }).ToListAsync();
        var parents = categories.ToDictionary(c => c.Id, c => c.ParentId);
        var names = categories.ToDictionary(c => c.Id, c => c.Name);
        var essential = CategoryTree.Essential(parents, categories.Where(c => c.IsEssential).Select(c => c.Id).ToHashSet());

        // Spending from three months before the month's end, for recurring payments; this month's within it.
        var from = new[] { end.AddMonths(-3), b.PeriodStart.AddMonths(-2) }.Min();
        var recentRows = await db.Transactions
            .Where(t => t.Type == TransactionType.Expense && t.Date >= from && t.Date < end)
            .Select(t => new { t.Date, t.Description, t.CategoryId, t.GbpAmount })
            .ToListAsync();
        var recent = recentRows
            .Select(t => new InsightExpense(t.Date, t.Description, t.CategoryId is { } c ? paths.GetValueOrDefault(c, "") : "", t.GbpAmount))
            .ToList();
        var thisMonth = recent.Where(e => e.Date >= b.PeriodStart && e.Date < end).ToList();

        // Each category's spending in the 2 months before this one (inside the 3 months above).
        var earlier = recentRows
            .Where(t => t.Date >= b.PeriodStart.AddMonths(-2) && t.Date < b.PeriodStart && t.CategoryId is not null)
            .GroupBy(t => t.CategoryId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(t => t.GbpAmount));
        InsightBudgetLine ToLine(BudgetLine l)
        {
            var children = l.Children.Select(ToLine).ToList();
            return new InsightBudgetLine(l.Name, l.Planned, l.Spent, children, essential.Contains(l.CategoryId),
                earlier.GetValueOrDefault(l.CategoryId) + children.Sum(c => c.Earlier));
        }

        // Interest and fees: spending under the "Interest & fees" category (and anything inside it).
        var interestAndFees = recentRows
            .Where(t => t.Date >= b.PeriodStart && t.Date < end && t.CategoryId is { } c
                        && names[CategoryTree.TopLevel(c, parents)].Equals("Interest & fees", StringComparison.OrdinalIgnoreCase))
            .Sum(t => t.GbpAmount);

        // Debts with their balance in pounds, and this month's line from the budget.
        var lines = b.Debts.ToDictionary(d => d.AccountId);
        var debts = new List<InsightDebt>();
        foreach (var a in await db.Accounts.Where(a => a.Type != AccountType.Current && a.Balance > 0).OrderByDescending(a => a.Apr).ToListAsync())
        {
            var pounds = await rates.ToPoundsAsync(a.Balance, a.Currency);
            var kind = (a.Type == AccountType.CreditCard ? "credit card" : "loan") + (pounds is null ? ", no £ rate yet" : "");
            var line = lines.GetValueOrDefault(a.Id);
            debts.Add(new InsightDebt(a.Name, kind, pounds ?? 0, a.Apr, line?.Planned ?? 0, line?.Paid ?? 0, line?.Suggested,
                FixedTotal: a.Type == AccountType.Loan && a.Apr == 0));
        }

        var plan = await budgets.AvalancheAsync(0);
        var historySince = await db.Transactions.MinAsync(t => (DateOnly?)t.Date);
        var input = new InsightInput(
            b.PeriodStart, b.PeriodEnd, b.DaysElapsed, b.DaysInPeriod, b.DaysLeft,
            b.Income, view.IncomeMode == IncomeMode.Recorded,
            thisMonth, recent, b.Lines.Select(ToLine).ToList(),
            b.PlannedSpending, b.PlannedDebts, b.Unallocated, b.SafeToSpendPerDay,
            debts,
            new InsightPlan(plan.CanBePaidOff, plan.Months, plan.DebtFreeDate, plan.TotalInterest, plan.MonthlyBudget,
                plan.Payoffs.Select(p => p.Name).ToList()),
            interestAndFees,
            historySince);

        return (b.PeriodStart, input);
    }
}
