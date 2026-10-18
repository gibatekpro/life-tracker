namespace LifeTracker.Api.Models;

public class DebtPayment
{
    public int Id { get; set; }

    public int DebtId { get; set; }
    public Debt Debt { get; set; } = null!;

    public int? TransactionId { get; set; }
    public Transaction? Transaction { get; set; }

    public decimal Amount { get; set; }
    public DateOnly Date { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}