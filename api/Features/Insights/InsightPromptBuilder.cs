using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace LifeTracker.Api.Features.Insights;

// What the builder knows about a month: names and amounts only (all in pounds). There are no
// IDs, aliases or account numbers here at all, so they can't be sent by mistake.
public record InsightExpense(DateOnly Date, string Merchant, string Category, decimal Pounds);

// Earlier: the same line's spending in the 2 months before this one, so "unused" can be told
// apart from "not spent yet this month".
public record InsightBudgetLine(string Name, decimal Planned, decimal Spent, IReadOnlyList<InsightBudgetLine> Children,
    bool IsEssential = false, decimal Earlier = 0);

public record InsightDebt(string Name, string Kind, decimal BalancePounds, decimal Apr,
    decimal PlannedThisMonth, decimal PaidThisMonth, decimal? AvalancheSuggests);

public record InsightPlan(bool CanBePaidOff, int Months, DateOnly? DebtFreeDate, decimal TotalInterest,
    decimal MonthlyBudget, IReadOnlyList<string> PayoffOrder);

public record InsightInput(
    DateOnly PeriodStart, DateOnly PeriodEnd, int DaysElapsed, int DaysInPeriod,
    decimal Income, bool IncomeIsRecorded,
    IReadOnlyList<InsightExpense> MonthExpenses,
    IReadOnlyList<InsightExpense> RecentExpenses,      // the last 3 months, for spotting recurring payments
    IReadOnlyList<InsightBudgetLine> BudgetLines,
    decimal PlannedSpending, decimal PlannedDebts, decimal Unallocated, decimal SafeToSpendPerDay,
    IReadOnlyList<InsightDebt> Debts,
    InsightPlan? Plan,
    decimal InterestAndFees);

public record RecurringPayment(string Merchant, decimal TypicalAmount, int Count, DateOnly LastDate);

// Payments that look like subscriptions or bills: the same merchant (ignoring case and punctuation)
// at least twice, on different days, at about the same amount (within 10% of its typical amount).
// Pure, so the rule is easy to test.
public static class RecurringPayments
{
    public const decimal Tolerance = 0.10m;

    public static List<RecurringPayment> Find(IEnumerable<InsightExpense> expenses) =>
        expenses
            .GroupBy(e => InsightPromptBuilder.Key(e.Merchant))
            .Where(g => g.Key.Length > 0)
            .Select(g =>
            {
                var amounts = g.Select(e => e.Pounds).Order().ToList();
                var typical = amounts[amounts.Count / 2];
                var similar = g.Where(e => Math.Abs(e.Pounds - typical) <= typical * Tolerance).ToList();
                var latest = g.MaxBy(e => e.Date)!;
                return new
                {
                    Payment = new RecurringPayment(InsightPromptBuilder.Mask(latest.Merchant), InsightPromptBuilder.Round(typical),
                        similar.Count, latest.Date),
                    Days = similar.Select(e => e.Date).Distinct().Count(),
                };
            })
            .Where(x => x.Payment.Count >= 2 && x.Days >= 2 && x.Payment.TypicalAmount > 0)
            .Select(x => x.Payment)
            .OrderByDescending(p => p.TypicalAmount)
            .ToList();
}

// Turns a budget month into the compact summary sent to OpenAI: income, spending by category,
// top merchants, recurring-looking payments, budget status, debts and the avalanche plan.
// It's also stored with each insight, so I can always see exactly what was shared.
//
// Pure: InsightService gathers the month; this only formats it. Card or account numbers typed into
// a description are masked, and amounts are rounded to 2 decimal places.
public static class InsightPromptBuilder
{
    public const string SystemPrompt =
        """
        You help someone in the UK understand their monthly spending and pay off debt faster.
        All amounts are in pounds sterling (GBP).
        Be practical and specific: refer to their actual categories, merchants and amounts.
        Be kind but honest, and never judgemental.
        Budget lines are plans the user has chosen, not savings or targets to beat.
        Never suggest spending less than planned on an [essential] line, and never suggest cutting any
        budgeted line to 0 unless its earlier spending shows it is unused.
        Before any cuts, check the essential lines listed as having no budget (food or groceries,
        utilities, transport); if there are any, flag them first, at the start of the summary.
        Prioritise paying down high-interest debt: say how savings could speed up the avalanche plan
        (highest APR first) and reduce the interest they pay.
        Estimated savings must be realistic monthly amounts in GBP, based on the figures given.
        Only use the data provided; if something isn't clear from it, say so rather than guess.
        This is general information, not financial advice; say so briefly in the debt advice.
        """;

    private const int TopMerchants = 10;
    private const int MaxRecurring = 10;

    // Any run of 6 or more digits, allowing single spaces or dashes between them
    // ("4929 1234 5678 9012", "12-34-56"): card numbers, sort codes, account and phone numbers.
    private static readonly Regex LongNumber = new(@"\d(?:[ \-]?\d){5,}", RegexOptions.Compiled);

    public static string Mask(string text)
    {
        var masked = LongNumber.Replace(text.Trim(), "•••");
        return masked.Length > 60 ? masked[..60] : masked;
    }

    // Merchants compared ignoring case, punctuation and masked numbers: "TESCO STORES 1234567" and
    // "Tesco Stores" are the same place.
    internal static string Key(string merchant) =>
        new(Mask(merchant).ToLowerInvariant().Where(char.IsLetter).ToArray());

    public static decimal Round(decimal amount) => Math.Round(amount, 2, MidpointRounding.AwayFromZero);

    private static string M(decimal amount) => Round(amount).ToString("0.00", CultureInfo.InvariantCulture);

    private static string D(DateOnly date) => date.ToString("d MMM yyyy", CultureInfo.InvariantCulture);

    // The essentials every budget needs, recognised by the start of a word in a line's name
    // ("Groceries", "Council Tax"), or a whole word for short ones ending in $ ("Bus", not "Business").
    // Any line or subcategory with a budget counts.
    private static readonly (string Name, string[] Words)[] Essentials =
    [
        ("food or groceries", ["food", "grocer", "supermarket"]),
        ("utilities", ["utilit", "bills", "electric", "energy", "gas$", "water", "council"]),
        ("transport", ["transport", "travel", "bus$", "buses$", "train", "rail", "tube", "oyster", "fuel", "petrol", "commut"]),
    ];

    private static readonly Regex Word = new(@"\p{L}+", RegexOptions.Compiled);

    // Which of those essentials no budgeted line covers, in that order.
    public static List<string> MissingEssentials(IReadOnlyList<InsightBudgetLine> lines)
    {
        var budgeted = new List<string>();
        void Collect(IEnumerable<InsightBudgetLine> ls)
        {
            foreach (var l in ls)
            {
                if (l.Planned > 0) budgeted.Add(l.Name);
                Collect(l.Children);
            }
        }
        Collect(lines);

        var words = budgeted.SelectMany(n => Word.Matches(n.ToLowerInvariant()).Select(m => m.Value)).ToList();
        static bool Matches(string word, string key) => key.EndsWith('$') ? word == key[..^1] : word.StartsWith(key);
        return Essentials.Where(e => !words.Any(w => e.Words.Any(k => Matches(w, k)))).Select(e => e.Name).ToList();
    }

    public static string Build(InsightInput input)
    {
        var s = new StringBuilder();
        s.AppendLine($"Budget month: {D(input.PeriodStart)} to {D(input.PeriodEnd)} (day {input.DaysElapsed} of {input.DaysInPeriod}).");
        s.AppendLine("All amounts are in GBP.");
        s.AppendLine();

        var spent = input.MonthExpenses.Sum(e => e.Pounds);
        s.AppendLine($"Income: {M(input.Income)} ({(input.IncomeIsRecorded ? "income recorded this month" : "monthly take-home pay")}).");
        s.AppendLine($"Spending so far: {M(spent)} across {input.MonthExpenses.Count} payments.");
        s.AppendLine();

        s.AppendLine("Spending by category ([essential] is a need, [flexible] a want; budget in brackets; " +
                     "earlier is the line's spending in the 2 months before this one):");
        if (input.BudgetLines.Count == 0) s.AppendLine("- none");
        void Lines(IEnumerable<InsightBudgetLine> lines, int depth)
        {
            foreach (var l in lines)
            {
                var budget = l.Planned > 0
                    ? $" (budget {M(l.Planned)}, {(l.Spent > l.Planned ? $"{M(l.Spent - l.Planned)} over" : $"{M(l.Planned - l.Spent)} left")})"
                    : " (no budget)";
                var kind = l.IsEssential ? "essential" : "flexible";
                s.AppendLine($"{new string(' ', depth * 2)}- {Mask(l.Name)} [{kind}]: {M(l.Spent)}{budget}, earlier {M(l.Earlier)}");
                Lines(l.Children, depth + 1);
            }
        }
        Lines(input.BudgetLines, 0);
        var missing = MissingEssentials(input.BudgetLines);
        s.AppendLine(missing.Count == 0
            ? "Essential lines with no budget: none (food or groceries, utilities and transport all have one)."
            : $"Essential lines with no budget (flag these first): {string.Join(", ", missing)}.");
        s.AppendLine();

        s.AppendLine("Top merchants this month:");
        var merchants = input.MonthExpenses
            .GroupBy(e => Key(e.Merchant))
            .Select(g => (Name: Mask(g.MaxBy(e => e.Date)!.Merchant), Total: g.Sum(e => e.Pounds), Count: g.Count()))
            .OrderByDescending(m => m.Total)
            .Take(TopMerchants)
            .ToList();
        if (merchants.Count == 0) s.AppendLine("- none");
        foreach (var m in merchants)
            s.AppendLine($"- {m.Name}: {M(m.Total)} ({m.Count} payment{(m.Count == 1 ? "" : "s")})");
        s.AppendLine();

        s.AppendLine("Recurring-looking payments (last 3 months):");
        var recurring = RecurringPayments.Find(input.RecentExpenses).Take(MaxRecurring).ToList();
        if (recurring.Count == 0) s.AppendLine("- none found");
        foreach (var r in recurring)
            s.AppendLine($"- {r.Merchant}: about {M(r.TypicalAmount)}, {r.Count} times, last on {D(r.LastDate)}");
        s.AppendLine();

        s.AppendLine($"Budget: planned spending {M(input.PlannedSpending)}, planned debt payments {M(input.PlannedDebts)}, " +
                     $"unallocated income {M(input.Unallocated)}, safe to spend {M(input.SafeToSpendPerDay)} per day.");
        s.AppendLine($"Interest and fees paid this month: {M(input.InterestAndFees)}.");
        s.AppendLine();

        s.AppendLine("Debts (balances converted to GBP):");
        if (input.Debts.Count == 0) s.AppendLine("- none");
        foreach (var d in input.Debts)
        {
            var suggestion = d.AvalancheSuggests is { } x ? $", avalanche plan suggests {M(x)} this month" : "";
            s.AppendLine($"- {Mask(d.Name)} ({d.Kind}): balance {M(d.BalancePounds)}, APR {d.Apr.ToString("0.##", CultureInfo.InvariantCulture)}%, " +
                         $"planned {M(d.PlannedThisMonth)} this month, paid {M(d.PaidThisMonth)}{suggestion}");
        }
        s.AppendLine();

        if (input.Plan is { } p)
        {
            s.AppendLine(p.CanBePaidOff
                ? $"Avalanche plan: paying {M(p.MonthlyBudget)} a month clears all debts by {(p.DebtFreeDate is { } date ? date.ToString("MMM yyyy", CultureInfo.InvariantCulture) : "unknown")} " +
                  $"({p.Months} months), with {M(p.TotalInterest)} interest in total."
                : $"Avalanche plan: at {M(p.MonthlyBudget)} a month the debts can't be cleared within 50 years.");
            if (p.PayoffOrder.Count > 0)
                s.AppendLine($"Payoff order (highest APR first): {string.Join(", ", p.PayoffOrder.Select(Mask))}.");
        }

        return s.ToString().TrimEnd() + "\n";
    }
}
