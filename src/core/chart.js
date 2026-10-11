/**
 * Geometry for the cumulative chart (PLAN-4, PLAN-5): scales, ticks and the points of the two
 * lines for a given size. No DOM; the UI draws what this returns. Money is integer cents.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MARGIN = { top: 12, right: 16, bottom: 28, left: 56 };
const MIN_LABEL_GAP = 48;

/** "2026-03" becomes "Mar 26". */
export const monthLabel = month => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(2, 4)}`;

/** A short axis label for an amount in cents: 250, 7.7k, -1.2M. */
export function axisLabel(cents) {
  const units = cents / 100;
  const abs = Math.abs(units);
  const short = (value, suffix) => `${Number(value.toFixed(1))}${suffix}`;
  if (abs >= 1_000_000) return short(units / 1_000_000, 'M');
  if (abs >= 1000) return short(units / 1000, 'k');
  return String(Math.round(units) || 0);
}

/** Round limits and an even tick step (1, 2 or 5 times a power of ten) that include zero. */
export function niceScale(min, max, target = 5) {
  let low = Math.min(min, 0);
  let high = Math.max(max, 0);
  if (low === high) high = 10000;
  const rough = (high - low) / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map(m => m * power).find(s => s >= rough);
  low = Math.floor(low / step) * step;
  high = Math.ceil(high / step) * step;
  const ticks = [];
  for (let value = low; value <= high; value += step) ticks.push(value);
  return { min: low, max: high, step, ticks };
}

/**
 * @param {{month: string, cash: number, savings: number}[]} rows from `project`
 * @param {{width: number, height: number}} size
 */
export function buildChart(rows, { width, height }) {
  const plot = {
    x: MARGIN.left,
    y: MARGIN.top,
    width: Math.max(width - MARGIN.left - MARGIN.right, 1),
    height: Math.max(height - MARGIN.top - MARGIN.bottom, 1),
  };
  const values = rows.flatMap(row => [row.cash, row.savings]);
  const scale = niceScale(Math.min(...values), Math.max(...values));
  const n = rows.length;
  const xAt = i => (n === 1 ? plot.x + plot.width / 2 : plot.x + (i * plot.width) / (n - 1));
  const yAt = value => plot.y + ((scale.max - value) / (scale.max - scale.min)) * plot.height;

  const spacing = n === 1 ? plot.width : plot.width / (n - 1);
  const every = Math.max(1, Math.ceil(MIN_LABEL_GAP / spacing));
  const xTicks = rows
    .map((row, index) => ({ index, x: xAt(index), label: monthLabel(row.month) }))
    .filter(tick => tick.index % every === 0);

  return {
    width,
    height,
    plot,
    scale,
    zeroY: yAt(0),
    yTicks: scale.ticks.map(value => ({ value, y: yAt(value), label: axisLabel(value) })),
    xTicks,
    cash: rows.map((row, i) => ({ x: xAt(i), y: yAt(row.cash), value: row.cash })),
    savings: rows.map((row, i) => ({ x: xAt(i), y: yAt(row.savings), value: row.savings })),
  };
}
