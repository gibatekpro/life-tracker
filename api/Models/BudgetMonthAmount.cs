namespace LifeTracker.Api.Models;

// A budget figure for one month, overriding the default: for a spending category (e.g. council
// tax £125 in November instead of the usual £120) or for a debt (paying £150 to a card this month).
// Exactly one of CategoryId and AccountId is set. PeriodStart is the first day of that budget
// month; amounts are in pounds.
public class BudgetMonthAmount
{
    public int Id { get; set; }

    public int? CategoryId { get; set; }
    public Category? Category { get; set; }

    public int? AccountId { get; set; }
    public Account? Account { get; set; }

    public DateOnly PeriodStart { get; set; }
    public decimal Amount { get; set; }
}
