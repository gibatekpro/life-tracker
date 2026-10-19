namespace LifeTracker.Api.Models;

public class Transaction
{

    public int Id { get; set; }
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public TransactionType Type { get; set; } = TransactionType.Expense;
    public DateOnly Date { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int AccountId { get; set; }            // where the money leaves (Expense, Transfer) or arrives (Income)
    public Account Account { get; set; } = null!;

    public int? ToAccountId { get; set; }         // Transfer only: where the money arrives
    public Account? ToAccount { get; set; }

}
