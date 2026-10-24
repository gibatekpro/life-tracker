namespace LifeTracker.Api.Models;

// An exchange rate I've set myself, for one direction: Rate units of ToCurrency per 1 FromCurrency.
// Sending money and converting it back are usually at different rates, so each direction has its
// own row, e.g. GBP->NGN 1,850 and NGN->GBP 0.00052.
public class ExchangeRate
{
    public int Id { get; set; }
    public string FromCurrency { get; set; } = string.Empty;
    public string ToCurrency { get; set; } = string.Empty;
    public decimal Rate { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
