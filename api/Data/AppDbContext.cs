using LifeTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LifeTracker.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Debt> Debts => Set<Debt>();

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
        
    }
}