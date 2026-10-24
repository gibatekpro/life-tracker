// Green while on track, amber when today's pace would overspend by month-end, red once over.
// Pace only matters while there's money left: a bill paid exactly in full (a £18 subscription)
// isn't heading anywhere, even though "£18 in 27 days" projects past £18.
export function lineTone(planned: number, spent: number, projected: number, daysLeft: number) {
  if (planned > 0 && spent > planned) return 'negative' as const;
  if (planned > 0 && spent < planned && daysLeft > 0 && projected > planned) return 'warning' as const;
  return 'accent' as const;
}
