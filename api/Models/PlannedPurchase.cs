namespace LifeTracker.Api.Models;

public enum PlannedPurchaseStatus
{
    Active,     // still saving
    Achieved,   // what's saved has reached the target (set automatically)
    Bought,     // bought, from its savings account
    Cancelled   // given up; the money stays in the account until I move it
}

// Something I'm saving towards each month: a £3,990 visa fee, a laptop. The money builds up in its
// own Savings account (one planned purchase per account), filled by transfers from a current
// account, so what's saved is simply that account's balance.
//
// StartMonth and TargetMonth are budget months, stored as the 1st of the month they're named after
// (2027-01-01 is the January budget month, whatever payday is), like budget figures. TargetMonth is
// the last month I save in: from November "by January" is three payments, Nov, Dec and Jan.
// Amounts are in pounds, so the account is a GBP one.
public class PlannedPurchase
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal TargetAmount { get; set; }
    public decimal MonthlyAmount { get; set; }    // the plan; the budget line each month unless that month says otherwise
    public DateOnly StartMonth { get; set; }
    public DateOnly TargetMonth { get; set; }
    public bool IsEssential { get; set; }         // a need (a visa fee), not a want (a new laptop), like categories
    public PlannedPurchaseStatus Status { get; set; } = PlannedPurchaseStatus.Active;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int AccountId { get; set; }
    public Account Account { get; set; } = null!;
}
