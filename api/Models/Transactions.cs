namespace LifeTracker.Api.Models;

public class Transaction
{

    public int Id { get; set; }
    public decimal Amount { get; set; }
    public decimal GbpAmount { get; set; }        // Amount in pounds, for the summary. Same as Amount on a GBP account
    public decimal? ToAmount { get; set; }        // Transfer between currencies only: what arrived, in ToAccount's currency
    public string Description { get; set; } = string.Empty;
    public TransactionType Type { get; set; } = TransactionType.Expense;
    public DateOnly Date { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int AccountId { get; set; }            // where the money leaves (Expense, Transfer) or arrives (Income)
    public Account Account { get; set; } = null!;

    public int? ToAccountId { get; set; }         // Transfer only: where the money arrives
    public Account? ToAccount { get; set; }

    public int? CategoryId { get; set; }          // Expense and Income only; a transfer has none
    public Category? Category { get; set; }

}
