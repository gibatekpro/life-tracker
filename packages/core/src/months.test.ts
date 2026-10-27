import { describe, expect, it } from 'vitest';

import { parseYm, shiftMonth, toYm } from './months';

describe('budget month strings', () => {
  it('pads the month and moves across year ends', () => {
    expect(toYm(2026, 3)).toBe('2026-03');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-10', -6)).toBe('2026-04');
    expect(parseYm('2026-09')).toEqual({ year: 2026, month: 9 });
  });
});
