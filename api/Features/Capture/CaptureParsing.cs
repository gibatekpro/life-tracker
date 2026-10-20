using System.Globalization;
using System.Text.RegularExpressions;

namespace LifeTracker.Api.Features.Capture;

// Helpers for turning the text Apple Pay sends into something usable. Both are pure
// (no database, no logging) so they're quick to test; the capture endpoint logs what happens.

// Turns the amount text from Wallet into a number.
public static class AmountParser
{
    public static bool TryParse(string? raw, out decimal amount)
    {
        amount = 0;
        if (string.IsNullOrWhiteSpace(raw)) return false;

        // Keep only digits, the decimal point and a minus sign: "£1,234.50" -> "1234.50".
        var cleaned = Regex.Replace(raw, @"[^\d.\-]", "");

        // InvariantCulture so "." is always the decimal point, whatever the server's locale.
        // Zero and negative amounts aren't real purchases, so they're rejected too.
        return decimal.TryParse(cleaned, NumberStyles.Number, CultureInfo.InvariantCulture, out amount)
               && amount > 0;
    }
}

// Picks a category from the merchant name, so most captures don't need tidying up.
// It's deliberately simple: a keyword list I add to whenever a merchant keeps landing in "Other".
public static class CategoryGuesser
{
    private static readonly (string Keyword, string Category)[] Rules =
    [
        ("tesco", "Food"), ("aldi", "Food"), ("lidl", "Food"),
        ("sainsbury", "Food"), ("vending", "Food"),
        ("centrebus", "Transport"), ("stagecoach", "Transport"),
        ("bolt", "Transport"), ("uber", "Transport")
    ];

    public static string Guess(string merchant)
    {
        var m = merchant.ToLowerInvariant();
        foreach (var (keyword, category) in Rules)
            if (m.Contains(keyword)) return category;
        return "Other";
    }
}
