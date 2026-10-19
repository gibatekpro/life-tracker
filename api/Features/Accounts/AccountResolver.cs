namespace LifeTracker.Api.Features.Accounts;

public record ResolvableAccount(int Id, string Name, IReadOnlyList<string> Aliases);

public enum MatchedBy { Alias, Name, Default }

public record AccountResolution(int AccountId, MatchedBy MatchedBy);

public static class AccountResolver
{
    // Wallet card names vary ("Lloyd's", "LLOYDS"), so compare on letters and digits only.
    public static string Normalise(string? name) =>
        new((name ?? "").ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

    public static AccountResolution? Resolve(
        string? cardName, IEnumerable<ResolvableAccount> accounts, int? defaultAccountId)
    {
        var card = Normalise(cardName);

        if (card.Length > 0)
        {
            var list = accounts.ToList();

            var byAlias = list.FirstOrDefault(a => a.Aliases.Any(alias => Normalise(alias) == card));
            if (byAlias is not null) return new(byAlias.Id, MatchedBy.Alias);

            var byName = list.FirstOrDefault(a => Normalise(a.Name) == card);
            if (byName is not null) return new(byName.Id, MatchedBy.Name);
        }

        return defaultAccountId is { } id ? new(id, MatchedBy.Default) : null;
    }
}
