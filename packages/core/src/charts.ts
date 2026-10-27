// A chart's value axis with round numbers: the top of the axis and the step between gridlines,
// so `sections` gridlines cover `max` (e.g. 1,830 over 4 sections: 2,000 in steps of 500).
// Values below zero aren't charted here; an empty chart gets an axis of 0..sections.
export function niceAxis(max: number, sections = 4) {
  if (!(max > 0)) return { max: sections, step: 1 };
  const raw = max / sections;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  return { max: step * sections, step };
}
