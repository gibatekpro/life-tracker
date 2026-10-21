// Formats an amount in its own currency: £10.00, ₦18,000.00.
// narrowSymbol shows "₦" rather than "NGN".
export const formatMoney = (amount: number, currency = 'GBP') =>
  amount.toLocaleString('en-GB', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' });
