using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Debt> Debts => Set<Debt>();
    public DbSet<DebtPayment> DebtPayments => Set<DebtPayment>();


    public DbSet<AppSettings> Settings => Set<AppSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Transaction>(e =>
        {
            e.Property(t => t.Amount).HasPrecision(18, 2);
            e.Property(t => t.Description).HasMaxLength(200);
            e.Property(t => t.Category).HasMaxLength(50);
        });

        modelBuilder.Entity<Debt>(e =>
        {
            e.Property(d => d.Name).HasMaxLength(100);
            e.Property(d => d.Balance).HasPrecision(18, 2);
            e.Property(d => d.Apr).HasPrecision(5, 2);
            e.Property(d => d.MinimumPayment).HasPrecision(18, 2);
            e.Property(d => d.MonthlyPayment).HasPrecision(18, 2);
        });

        modelBuilder.Entity<AppSettings>(e =>
        {
            e.ToTable("Settings");
            e.Property(s => s.Id).ValueGeneratedNever(); // always row 1, not auto-numbered
            e.Property(s => s.MonthlyIncome).HasPrecision(18, 2);
            e.Property(s => s.MonthlyDebtBudget).HasPrecision(18, 2);
            e.Property(s => s.UpdatedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<DebtPayment>(e =>
        {
            e.Property(p => p.Amount).HasPrecision(18, 2);

            e.HasOne(p => p.Debt)
            .WithMany()
            .HasForeignKey(p => p.DebtId)
            .OnDelete(DeleteBehavior.Cascade);   // delete a debt, and its payment history goes too

            e.HasOne(p => p.Transaction)
            .WithMany()
            .HasForeignKey(p => p.TransactionId)
            .OnDelete(DeleteBehavior.SetNull);   // delete the transaction, and the payment stays
        });
        
    }
}