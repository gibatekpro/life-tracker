namespace LifeTracker.Api.Features.Debts;

public record PlannerDebt(int Id, string Name, decimal Balance, decimal Apr, decimal MonthlyPayment);

public record PlannedPayoff(int Id, string Name, int Month, DateOnly PayoffDate, decimal InterestPaid);

public record AvalanchePlan(
    bool CanBePaidOff,
    int Months,
    DateOnly? DebtFreeDate,
    decimal TotalInterest,
    decimal MonthlyBudget,
    IReadOnlyList<PlannedPayoff> Payoffs);

public static class AvalanchePlanner
{
    private const int MaxMonths = 600;

    public static AvalanchePlan Plan(
        IEnumerable<PlannerDebt> debts,
        DateOnly start,
        decimal extraPerMonth = 0,
        decimal? monthlyBudget = null)
    {
        var open = debts.Where(d => d.Balance > 0).Select(d => new Working(d)).ToList();

        // Use the fixed budget if one is set, but never less than the planned payments.
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

            // 2. Every debt gets its own planned payment.
            foreach (var d in active)
            {
                var pay = Math.Min(Math.Min(d.Source.MonthlyPayment, d.Balance), remaining);
                d.Balance -= pay;
                remaining -= pay;
            }

            // 3. Whatever is left goes to the highest APR first (smallest balance breaks ties).
            foreach (var d in active.OrderByDescending(d => d.Source.Apr).ThenBy(d => d.Balance))
            {
                if (remaining <= 0) break;
                var pay = Math.Min(remaining, d.Balance);
                d.Balance -= pay;
                remaining -= pay;
            }

            foreach (var d in active.Where(d => d.Balance == 0))
                payoffs.Add(new PlannedPayoff(d.Source.Id, d.Source.Name, month, start.AddMonths(month), d.Interest));
        }

        var done = open.All(d => d.Balance == 0);
        return new AvalanchePlan(done, month, done ? start.AddMonths(month) : null, totalInterest, budget, payoffs);
    }

    private class Working(PlannerDebt source)
    {
        public PlannerDebt Source { get; } = source;
        public decimal Balance { get; set; } = source.Balance;
        public decimal Interest { get; set; }
    }
}