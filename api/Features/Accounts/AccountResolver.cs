namespace LifeTracker.Api.Features.Accounts;

// An account plus every name it might be called by.
public record ResolvableAccount(int Id, string Name, IReadOnlyList<string> Aliases);

public enum MatchedBy { Alias, Name, Default }

// Which account was picked, and how. The capture endpoint uses "how" to warn me when it had to
// fall back to the default, which usually means I should add an alias.
public record AccountResolution(int AccountId, MatchedBy MatchedBy);

// Works out which account an Apple Pay payment belongs to, from the card name the Shortcut sends.
//
// Wallet names don't match account names exactly ("Lloyd's" vs "Lloyds Current"), so this
// checks aliases first, then account names, and if nothing matches it uses the default
// account from Settings, so a capture is never lost just because a name didn't match.
//
// Pure on purpose, like BalanceRules: no database, no logging, easy to test.
// The capture endpoint loads the accounts and logs the outcome.
public static class AccountResolver
{
    // "Lloyd's", "LLOYDS" and " lloyds " all become "lloyds", so small differences in how a
    // name is typed don't stop a match.
    public static string Normalise(string? name) =>
        new((name ?? "").ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

    public static AccountResolution? Resolve(
        string? cardName, IEnumerable<ResolvableAccount> accounts, int? defaultAccountId)
    {
        var card = Normalise(cardName);

        if (card.Length > 0)
        {
            var list = accounts.ToList();

            // An alias is something I added on purpose, so it wins over an account that happens to have that name.
            var byAlias = list.FirstOrDefault(a => a.Aliases.Any(alias => Normalise(alias) == card));
            if (byAlias is not null) return new(byAlias.Id, MatchedBy.Alias);

            var byName = list.FirstOrDefault(a => Normalise(a.Name) == card);
            if (byName is not null) return new(byName.Id, MatchedBy.Name);
        }

        // No card name, or nothing matched. Null only if there's no default either.
        return defaultAccountId is { } id ? new(id, MatchedBy.Default) : null;
    }
}
