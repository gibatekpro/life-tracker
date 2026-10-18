using System.Globalization;
using System.Text.RegularExpressions;

namespace LifeTracker.Api.Features.Capture;

public static class AmountParser
{
    public static bool TryParse(string? raw, out decimal amount)
    {
        amount = 0;
        if (string.IsNullOrWhiteSpace(raw)) return false;

        // "£1,234.50" -> "1234.50"
        var cleaned = Regex.Replace(raw, @"[^\d.\-]", "");

        return decimal.TryParse(cleaned, NumberStyles.Number, CultureInfo.InvariantCulture, out amount)
               && amount > 0;
    }
}

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