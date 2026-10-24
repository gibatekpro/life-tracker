namespace LifeTracker.Api.Models;

public enum CategoryKind
{
    Expense,
    Income
}

// A spending or income category. Categories form a tree of any depth,
// e.g. Subscriptions > AI > Claude; a subcategory has the same kind as its parent.
public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public CategoryKind Kind { get; set; }
    public int SortOrder { get; set; }
    public bool IsArchived { get; set; }                 // hidden from pickers, kept for history
    public decimal? DefaultMonthlyAmount { get; set; }   // budgeted every month (GBP), unless a month says otherwise
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int? ParentId { get; set; }
    public Category? Parent { get; set; }
    public List<Category> Children { get; set; } = [];
}
