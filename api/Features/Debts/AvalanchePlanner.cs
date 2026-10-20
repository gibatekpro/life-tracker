namespace LifeTracker.Api.Features.Debts;

// Just what the planner needs to know about a debt. Keeping it separate from the Account entity
// means the planner doesn't care where the numbers come from, and the tests can make them up.
public record PlannerDebt(int Id, string Name, decimal Balance, decimal Apr, decimal MonthlyPayment);

// When one debt gets cleared, and how much interest it cost on the way.
public record PlannedPayoff(int Id, string Name, int Month, DateOnly PayoffDate, decimal InterestPaid);

public record AvalanchePlan(
    bool CanBePaidOff,
    int Months,
    DateOnly? DebtFreeDate,
    decimal TotalInterest,
    decimal MonthlyBudget,
    IReadOnlyList<PlannedPayoff> Payoffs);

// Plans paying off all my debts together, using the "avalanche" method.
//
// The idea: pay every debt its normal payment, then put any money left over on the debt with
// the highest interest rate. When a debt is cleared, its payment doesn't disappear; it rolls
// over and joins the attack on the next one. That's the order that costs the least interest overall.
//
// Like DebtPayoffCalculator, it simulates month by month and is pure (no database, no logging).
public static class AvalanchePlanner
{
    // Same safety cap as the single-debt calculator: 50 years.
    private const int MaxMonths = 600;

    public static AvalanchePlan Plan(
        IEnumerable<PlannerDebt> debts,
        DateOnly start,
        decimal extraPerMonth = 0,
        decimal? monthlyBudget = null)
    {
        var open = debts.Where(d => d.Balance > 0).Select(d => new Working(d)).ToList();

        // How much goes to debts each month. A fixed budget from Settings keeps a cleared debt's
        // payment working on the rest, but it can never be less than the payments I've committed to.
        var planned = open.Sum(d => d.Source.MonthlyPayment);
        var budget = Math.Max(monthlyBudget ?? 0, planned) + extraPerMonth;

        var payoffs = new List<PlannedPayoff>();
        decimal totalInterest = 0;
        var month = 0;

        while (open.Any(d => d.Balance > 0) && month < MaxMonths)
        {
            month++;
            var active = open.Where(d => d.Balance > 0).ToList();

            // 1. Interest is added to every open debt.
            foreach (var d in active)
            {
                var interest = Math.Round(d.Balance * d.Source.Apr / 100m / 12m, 2);
                d.Balance += interest;
                d.Interest += interest;
                totalInterest += interest;
            }

            var remaining = budget;

            // 2. Every debt gets its own planned payment, so none of them falls behind.
            foreach (var d in active)
            {
                var pay = Math.Min(Math.Min(d.Source.MonthlyPayment, d.Balance), remaining);
                d.Balance -= pay;
                remaining -= pay;
            }

            // 3. Whatever is left goes to the highest APR first (smallest balance breaks ties).
            //    This is where the extra money and the rolled-over payments do their work.
            foreach (var d in active.OrderByDescending(d => d.Source.Apr).ThenBy(d => d.Balance))
            {
                if (remaining <= 0) break;
                var pay = Math.Min(remaining, d.Balance);
                d.Balance -= pay;
                remaining -= pay;
            }

            // Note which debts hit zero this month: that's their payoff date.
            foreach (var d in active.Where(d => d.Balance == 0))
                payoffs.Add(new PlannedPayoff(d.Source.Id, d.Source.Name, month, start.AddMonths(month), d.Interest));
        }

        var done = open.All(d => d.Balance == 0);
        return new AvalanchePlan(done, month, done ? start.AddMonths(month) : null, totalInterest, budget, payoffs);
    }

    // A debt's running state during the simulation. The input records stay untouched.
    private class Working(PlannerDebt source)
    {
        public PlannerDebt Source { get; } = source;
        public decimal Balance { get; set; } = source.Balance;
        public decimal Interest { get; set; }
    }
}
