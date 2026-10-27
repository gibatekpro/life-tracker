import { describe, expect, it } from 'vitest';

import { approxPounds, rateNote } from './rates';
import { rate } from './testData';

describe('approxPounds and rateNote', () => {
  const rates = [rate('NGN', 'GBP', 0.000509), rate('GBP', 'NGN', 1811.5)];

  it('converts other currencies to pounds for display', () => {
    expect(approxPounds(36849.72, 'NGN', rates)).toBe('≈ £18.76');
    expect(approxPounds(10, 'GBP', rates)).toBeNull();
    expect(approxPounds(10, 'EUR', rates)).toBe('no £ rate yet');
  });

  it('says what the rate is and where it comes from', () => {
    expect(rateNote('NGN', rates)).toBe('₦1 = £0.000509 · Your rate');
    expect(rateNote('EUR', rates)).toBe('No EUR to £ rate yet. Set one in Settings → Currencies.');
  });
});
