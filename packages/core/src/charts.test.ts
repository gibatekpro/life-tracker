import { describe, expect, it } from 'vitest';

import { niceAxis } from './charts';

describe('niceAxis', () => {
  it('rounds the top up to a whole number of round steps', () => {
    expect(niceAxis(1830)).toEqual({ max: 2000, step: 500 });
    expect(niceAxis(2589.23)).toEqual({ max: 4000, step: 1000 });
    expect(niceAxis(42.11)).toEqual({ max: 80, step: 20 });
    expect(niceAxis(100)).toEqual({ max: 100, step: 25 });
    expect(niceAxis(7, 4)).toEqual({ max: 8, step: 2 });
  });

  it('always covers the value', () => {
    for (const v of [0.3, 3, 33, 333, 999, 1001, 12345, 76543]) expect(niceAxis(v).max).toBeGreaterThanOrEqual(v);
  });

  it('gives an empty chart an axis anyway', () => {
    expect(niceAxis(0)).toEqual({ max: 4, step: 1 });
  });
});
