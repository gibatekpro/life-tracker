using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Budgets;
using LifeTracker.Api.Features.Insights;
using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace LifeTracker.Api.Features.PlannedPurchases;

// A purchase I haven't saved yet, to ask about first. MonthlyAmount and Months are its plan so far
// (either or both may be left out).
public record AdviceDraft(
    string Name, decimal TargetAmount, decimal? MonthlyAmount = null, int? Months = null, bool IsEssential = false, string? Notes = null);

// Exactly one: a saved planned purchase, or a draft.
public record AskAdviceRequest(int? PlannedPurchaseId = null, AdviceDraft? Draft = null);

// Advice as the pages show it: what it's about, the checked answer, what it cost, and exactly what was sent.
public record PurchaseAdviceDto(
    int Id, int? PlannedPurchaseId, string Name, DateTime CreatedAt, string Model, int InputTokens, int OutputTokens,
    string PromptSent, PurchaseAdviceResult Result)
{
    public static PurchaseAdviceDto From(PurchaseAdvice a) => new(
        a.Id, a.PlannedPurchaseId, a.Name, a.CreatedAt, a.Model, a.InputTokens, a.OutputTokens, a.PromptSent,
        PurchaseAdviceValidator.Deserialize(a.ResponseJson));
}

// The advice, or what stopped it: something wrong with the request (404/400/409, like the other
// planned purchase endpoints), or with the model (503/429/504/502, like insights). Error is safe to show.
public record AdviceOutcome(
    PurchaseAdvice? Advice, PlannedPurchaseProblem? RequestProblem = null, InsightProblem? ModelProblem = null, string? Error = null);

// Asks for advice on a planned purchase (or a draft): gathers the month as the insight does, describes
// the purchase (PurchaseAdvicePromptBuilder), asks the model with the advice schema, checks the answer
// (PurchaseAdviceValidator) and saves what was sent and what came back. Only called when I ask, and
// with the same key handling, timeouts and friendly errors as insights.
public class PurchaseAdviceService(
    AppDbContext db, InsightService insights, PlannedPurchaseService purchases, BudgetService budgets, IInsightModel model,
    IOptions<OpenAIOptions> options, ILogger<PurchaseAdviceService> logger)
{
    public async Task<AdviceOutcome> AskAsync(AskAdviceRequest req, CancellationToken cancellationToken)
    {
        if ((req.PlannedPurchaseId is null) == (req.Draft is null))
            return Reject(PlannedPurchaseProblem.Invalid, "Ask about a saved planned purchase or a draft, not both or neither.");

        var (purchase, problem, error) = req.PlannedPurchaseId is { } id ? await SavedAsync(id) : Draft(req.Draft!);
        if (purchase is null) return Reject(problem!.Value, error!);

        if (!options.Value.IsConfigured)
            return new AdviceOutcome(null, ModelProblem: InsightProblem.NotConfigured, Error: "OpenAI key not configured");

        var (_, month) = await insights.SummariseAsync(null, null);
        var input = new AdviceInput(purchase, month with { Purchases = await insights.PurchasesAsync(except: req.PlannedPurchaseId) });
        var prompt = PurchaseAdvicePromptBuilder.Build(input);

        InsightModelReply reply;
        try
        {
            reply = await model.AskAsync(PurchaseAdvicePromptBuilder.SystemPrompt, prompt, PurchaseAdvicePromptBuilder.Schema, cancellationToken);
        }
        catch (InsightModelException e)
        {
            return new AdviceOutcome(null, ModelProblem: InsightService.ProblemFor(e.Kind), Error: e.Message);
        }

        var (result, invalid) = PurchaseAdviceValidator.Validate(reply.Json, Math.Max(0, purchase.Target - purchase.Saved));
        if (result is null)
        {
            logger.LogWarning("Advice for planned purchase {PlannedPurchaseId} discarded: {Reason}", req.PlannedPurchaseId, invalid);
            return new AdviceOutcome(null, ModelProblem: InsightProblem.Invalid, Error: $"OpenAI's answer couldn't be used: {invalid} Try again.");
        }

        var advice = new PurchaseAdvice
        {
            PlannedPurchaseId = req.PlannedPurchaseId,
            Name = purchase.Name,
            Model = reply.Model,
            InputTokens = reply.InputTokens,
            OutputTokens = reply.OutputTokens,
            PromptSent = prompt,
            ResponseJson = PurchaseAdviceValidator.Serialize(result),
        };
        db.PurchaseAdvice.Add(advice);
        await db.SaveChangesAsync(cancellationToken);

        // Tokens and the verdict only: never what was asked or said.
        logger.LogInformation("Saved advice {AdviceId} for planned purchase {PlannedPurchaseId}: {Verdict}, {Model}, {InputTokens} + {OutputTokens} tokens",
            advice.Id, req.PlannedPurchaseId, result.Verdict, advice.Model, advice.InputTokens, advice.OutputTokens);
        return new AdviceOutcome(advice);
    }

    // A planned purchase's advice, newest first; null if there's no such planned purchase.
    public async Task<List<PurchaseAdviceDto>?> ForPurchaseAsync(int id)
    {
        if (!await db.PlannedPurchases.AnyAsync(p => p.Id == id)) return null;
        return (await db.PurchaseAdvice.Where(a => a.PlannedPurchaseId == id)
                .OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id).ToListAsync())
            .Select(PurchaseAdviceDto.From).ToList();
    }

    // A saved one, as it stands now: its plan from this month, and its line in this month's budget.
    private async Task<(AdvicePurchase?, PlannedPurchaseProblem?, string?)> SavedAsync(int id)
    {
        var p = await purchases.GetAsync(id);
        if (p is null) return (null, PlannedPurchaseProblem.NotFound, $"Planned purchase {id} doesn't exist.");
        if (p.Status is PlannedPurchaseStatus.Bought or PlannedPurchaseStatus.Cancelled)
            return (null, PlannedPurchaseProblem.Conflict, $"{p.Name} is {p.Status.ToString().ToLowerInvariant()}, so there's nothing to advise on.");

        var line = (await budgets.GetMonthAsync()).Budget.Savings.FirstOrDefault(s => s.PlannedPurchaseId == id)?.Planned ?? 0;
        var last = DateOnly.ParseExact(p.TargetMonth + "-01", "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
        return (new AdvicePurchase(p.Name, p.TargetAmount, p.Saved, p.MonthlyAmount, Math.Max(1, p.MonthsLeft), last,
            p.IsEssential, p.Notes, IsSaved: true, line), null, null);
    }

    // A draft, checked like a planned purchase would be (but nothing has to be planned yet).
    private static (AdvicePurchase?, PlannedPurchaseProblem?, string?) Draft(AdviceDraft d)
    {
        string? error =
            string.IsNullOrWhiteSpace(d.Name) || d.Name.Trim().Length > 100 ? "A name is required, at most 100 characters."
            : d.TargetAmount <= 0 ? "Enter a target above zero."
            : d.MonthlyAmount is <= 0 ? "A monthly amount has to be above zero."
            : d.Months is < 1 or > PlannedPurchaseCalculator.MaxMonths ? $"Choose 1 to {PlannedPurchaseCalculator.MaxMonths} months."
            : d.Notes?.Trim().Length > PurchaseAdvicePromptBuilder.MaxNotes ? $"Notes can be at most {PurchaseAdvicePromptBuilder.MaxNotes} characters."
            : null;
        if (error is not null) return (null, PlannedPurchaseProblem.Invalid, error);

        return (new AdvicePurchase(d.Name.Trim(), d.TargetAmount, 0, d.MonthlyAmount, d.Months, null, d.IsEssential,
            string.IsNullOrWhiteSpace(d.Notes) ? null : d.Notes.Trim(), IsSaved: false, 0), null, null);
    }

    private AdviceOutcome Reject(PlannedPurchaseProblem problem, string error)
    {
        logger.LogWarning("Advice request rejected ({Problem}): {Reason}", problem, error);
        return new AdviceOutcome(null, RequestProblem: problem, Error: error);
    }
}
