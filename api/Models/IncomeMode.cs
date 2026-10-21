namespace LifeTracker.Api.Models;

// What the monthly summary measures spending against.
public enum IncomeMode
{
    Fixed,     // the take-home pay set in Settings
    Recorded   // the Income transactions actually recorded in the period
}
