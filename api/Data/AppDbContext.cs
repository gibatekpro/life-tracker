using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<AccountAlias> AccountAliases => Set<AccountAlias>();
    public DbSet<Category> Categories => Set<Category>();


    public DbSet<AppSettings> Settings => Set<AppSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Transaction>(e =>
        {
            e.Property(t => t.Amount).HasPrecision(18, 2);
            e.Property(t => t.GbpAmount).HasPrecision(18, 2);
            e.Property(t => t.ToAmount).HasPrecision(18, 2);
            e.Property(t => t.Description).HasMaxLength(200);
            e.Property(t => t.Type).HasConversion<string>().HasMaxLength(20); // stored as 'Expense', not 0

            // Two foreign keys to the same table, so each one is configured explicitly.
            // Restrict: an account can't be deleted while it still has transactions.
            e.HasOne(t => t.Account)
            .WithMany()
            .HasForeignKey(t => t.AccountId)
            .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(t => t.ToAccount)
            .WithMany()
            .HasForeignKey(t => t.ToAccountId)
            .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(t => t.Category)
            .WithMany()
            .HasForeignKey(t => t.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);   // a category with transactions is archived, not deleted

            e.ToTable(t =>
            {
                // The database itself rejects a transfer without a destination, a destination on
                // anything that isn't a transfer, and a transfer from an account to itself.
                t.HasCheckConstraint(
                    "CK_Transactions_TransferHasDestination",
                    """("Type" = 'Transfer') = ("ToAccountId" IS NOT NULL) AND ("ToAccountId" IS NULL OR "ToAccountId" <> "AccountId")""");

                // A received amount only makes sense on a transfer (between currencies), and must be positive.
                t.HasCheckConstraint(
                    "CK_Transactions_ToAmountOnlyOnTransfers",
                    "\"ToAmount\" IS NULL OR (\"Type\" = 'Transfer' AND \"ToAmount\" > 0)");

                // Spending and income always have a category; a transfer between my accounts never does.
                t.HasCheckConstraint(
                    "CK_Transactions_CategoryUnlessTransfer",
                    "(\"Type\" = 'Transfer') = (\"CategoryId\" IS NULL)");
            });
        });

        modelBuilder.Entity<Account>(e =>
        {
            e.Property(a => a.Name).HasMaxLength(100);
            e.Property(a => a.Type).HasConversion<string>().HasMaxLength(20);
            e.Property(a => a.Currency).HasMaxLength(3);
            e.Property(a => a.Balance).HasPrecision(18, 2);
            e.Property(a => a.Apr).HasPrecision(5, 2);
            e.Property(a => a.MinimumPayment).HasPrecision(18, 2);
            e.Property(a => a.MonthlyPayment).HasPrecision(18, 2);
            e.Property(a => a.CreditLimit).HasPrecision(18, 2);

            e.HasMany(a => a.Aliases)
            .WithOne()
            .HasForeignKey(x => x.AccountId)
            .OnDelete(DeleteBehavior.Cascade);   // delete an account, and its aliases go too
        });

        modelBuilder.Entity<Category>(e =>
        {
            e.Property(c => c.Name).HasMaxLength(100);
            e.Property(c => c.Kind).HasConversion<string>().HasMaxLength(20);
            e.Property(c => c.DefaultMonthlyAmount).HasPrecision(18, 2);

            e.HasOne(c => c.Parent)
            .WithMany(c => c.Children)
            .HasForeignKey(c => c.ParentId)
            .OnDelete(DeleteBehavior.Restrict);   // no deleting a category that has subcategories

            // No two categories with the same name and kind under the same parent. NULLS NOT DISTINCT
            // makes that hold at the top level too, where ParentId is null (Postgres 15+).
            e.HasIndex(c => new { c.ParentId, c.Kind, c.Name }).IsUnique().AreNullsDistinct(false);
        });

        modelBuilder.Entity<AccountAlias>(e =>
        {
            e.Property(x => x.Alias).HasMaxLength(100);
            e.HasIndex(x => x.Alias).IsUnique();
        });

        modelBuilder.Entity<AppSettings>(e =>
        {
            e.ToTable("Settings");
            e.Property(s => s.Id).ValueGeneratedNever(); // always row 1, not auto-numbered
            e.Property(s => s.MonthlyIncome).HasPrecision(18, 2);
            e.Property(s => s.MonthlyDebtBudget).HasPrecision(18, 2);
            e.Property(s => s.UpdatedAt).HasDefaultValueSql("now()");
            e.Property(s => s.IncomeMode).HasConversion<string>().HasMaxLength(20);

            e.HasOne<Account>()
            .WithMany()
            .HasForeignKey(s => s.DefaultAccountId)
            .OnDelete(DeleteBehavior.SetNull);   // delete the default account, and there's just no default
        });

    }
}
