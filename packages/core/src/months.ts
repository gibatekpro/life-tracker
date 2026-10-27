// Budget months as "2026-10" strings, which compare and sort correctly as text.

export const toYm = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

// The month `by` months before or after: shiftMonth("2026-01", -1) = "2025-12".
export function shiftMonth(ym: string, by: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + by);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const parseYm = (ym: string) => {
  const [year, month] = ym.split('-').map(Number);
  return { year, month };
};
