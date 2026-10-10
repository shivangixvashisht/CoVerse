/** Categorical slots in fixed order (validated for CVD separation). Colour follows list position. */
const SERIES_VARS = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5"] as const;

export function seriesColor(index: number): string {
  return `var(${SERIES_VARS[index % SERIES_VARS.length]})`;
}
