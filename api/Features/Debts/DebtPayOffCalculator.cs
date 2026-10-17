namespace LifeTracker.Api.Features.Debts;

public record PayoffProjection(
    bool CanBePaidOff,
    int Months,
    DateOnly? PayoffDate,
    decimal TotalInterest,
    decimal TotalPaid);

public static class DebtPayoffCalculator
{
    private const int MaxMonths = 600;

    public static PayoffProjection Calculate(
        decimal balance, decimal apr, decimal monthlyPayment, DateOnly startDate)
    {
        if (balance <= 0)
            return new(true, 0, startDate, 0, 0);

        var monthlyRate = apr / 100m / 12m;

        // If the payment doesn't even cover the interest, the debt never shrinks.
        if (monthlyPayment <= Math.Round(balance * monthlyRate, 2))
            return new(false, 0, null, 0, 0);

        decimal totalInterest = 0, totalPaid = 0;
        var months = 0;

        while (balance > 0 && months < MaxMonths)
        {
            var interest = Math.Round(balance * monthlyRate, 2);
            balance += interest;

            var payment = Math.Min(monthlyPayment, balance);
            balance -= payment;

            totalInterest += interest;
            totalPaid += payment;
            months++;
        }

        return new(balance <= 0, months, startDate.AddMonths(months), totalInterest, totalPaid);
    }
}