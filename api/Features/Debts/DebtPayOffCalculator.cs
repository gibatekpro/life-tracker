namespace LifeTracker.Api.Features.Debts;

// How one debt plays out: whether it gets paid off at all, when, and what it costs along the way.
public record PayoffProjection(
    bool CanBePaidOff,
    int Months,
    DateOnly? PayoffDate,
    decimal TotalInterest,
    decimal TotalPaid);

// Simulates paying off a single debt, month by month, to answer "when will this card be clear?"
//
// It's a simulation, not a formula, because that's how card interest actually works: each month
// interest is added to what's left, then the payment comes off. Seeing it step by step also
// makes the totals easy to check against a statement.
//
// Pure (no database, no logging) so it can be tested with known numbers. DebtEndpoints logs the results.
public static class DebtPayoffCalculator
{
    // A cap so a bad input can't loop forever. 50 years is long past any real plan.
    private const int MaxMonths = 600;

    public static PayoffProjection Calculate(
        decimal balance, decimal apr, decimal monthlyPayment, DateOnly startDate)
    {
        if (balance <= 0)
            return new(true, 0, startDate, 0, 0);

        // APR is yearly and given as a percentage (24.9), so turn it into a monthly fraction.
        var monthlyRate = apr / 100m / 12m;

        // If the payment doesn't even cover the interest, the debt never shrinks.
        if (monthlyPayment <= Math.Round(balance * monthlyRate, 2))
            return new(false, 0, null, 0, 0);

        decimal totalInterest = 0, totalPaid = 0;
        var months = 0;

        while (balance > 0 && months < MaxMonths)
        {
            // Interest first, rounded to the penny like a real statement...
            var interest = Math.Round(balance * monthlyRate, 2);
            balance += interest;

            // ...then the payment. The last one is only whatever's left, not the full amount.
            var payment = Math.Min(monthlyPayment, balance);
            balance -= payment;

            totalInterest += interest;
            totalPaid += payment;
            months++;
        }

        return new(balance <= 0, months, startDate.AddMonths(months), totalInterest, totalPaid);
    }
}
