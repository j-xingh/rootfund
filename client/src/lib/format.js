const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
/** Money is always shown with cents so displayed figures reconcile to the pool. */
export const usd = (n) => usdFmt.format(Number(n) || 0);
export const int = (n) => new Intl.NumberFormat('en-US').format(Number(n) || 0);
export const pct1 = (n) => `${(Number(n) || 0).toFixed(1)}%`;
/** Sum of matches in cents: the number that must equal the pool. */
export const sumCents = (items) => items.reduce((a, i) => a + (i.matchCents || 0), 0);
