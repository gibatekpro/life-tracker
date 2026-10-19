namespace LifeTracker.Api.Models;

// Another name for an account, e.g. the card name Apple Pay sends ("Lloyd's").
public class AccountAlias
{
    public int Id { get; set; }
    public int AccountId { get; set; }
    public string Alias { get; set; } = string.Empty;
}
