// The cumulative chart (PLAN-4, PLAN-5): cash balance and savings per month as an SVG drawn at its
// real size, so text stays readable on a phone. Values are written in the legend and in the data
// table, so nothing needs hover. The geometry comes from core/chart.js.
import { buildChart, monthLabel } from '../../core/chart.js';
import { h, uid, fill } from '../dom.js';
import { formatCents } from '../format.js';
import { savingsWarning } from './summary.js';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, ...children) {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  node.append(...children);
  return node;
}

const path = points =>
  points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

export function mountChart(root, store) {
  const legend = h('ul', { class: 'legend', 'aria-label': 'Legend' });
  const holder = h('div', { class: 'chart' });
  const tableBody = h('tbody');
  const table = h(
    'table',
    {},
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        ['Month', 'Cash change', 'Cash balance', 'Savings'].map(t => h('th', { scope: 'col' }, t)),
      ),
    ),
    tableBody,
  );
  const tableId = uid('chart-table');
  const details = h(
    'details',
    { class: 'chart-data' },
    h('summary', {}, 'Show data table'),
    h('div', { class: 'table-wrap', id: tableId }, table),
  );
  const warning = h('p', { class: 'warning' });
  root.append(warning, legend, holder, details);

  function draw({ projection }) {
    const { rows, totals } = projection;
    const width = Math.floor(holder.clientWidth) || 320;
    const height = Math.round(Math.min(340, Math.max(200, width * 0.6)));
    const chart = buildChart(rows, { width, height });
    const { plot } = chart;

    warning.textContent = savingsWarning(projection);
    warning.hidden = !warning.textContent;
    const first = monthLabel(rows[0].month);
    const last = monthLabel(rows.at(-1).month);
    const svg = el(
      'svg',
      {
        viewBox: `0 0 ${width} ${height}`,
        width,
        height,
        role: 'img',
        'aria-label': `Cash and savings per month, ${first} to ${last}. Cash ends at ${formatCents(totals.cash)} and savings at ${formatCents(totals.savings)}.`,
      },
      ...chart.yTicks.flatMap(tick => [
        el('line', {
          class: tick.value === 0 ? 'chart-zero' : 'chart-grid',
          x1: plot.x,
          x2: plot.x + plot.width,
          y1: tick.y.toFixed(1),
          y2: tick.y.toFixed(1),
        }),
        el(
          'text',
          {
            class: 'chart-label',
            x: plot.x - 6,
            y: tick.y.toFixed(1),
            'text-anchor': 'end',
            'dominant-baseline': 'middle',
          },
          tick.label,
        ),
      ]),
      ...chart.xTicks.map(tick =>
        el(
          'text',
          { class: 'chart-label', x: tick.x.toFixed(1), y: height - 8, 'text-anchor': 'middle' },
          tick.label,
        ),
      ),
      el('path', { class: 'chart-line cash', 'data-series': 'cash', d: path(chart.cash) }),
      el('path', { class: 'chart-line savings', 'data-series': 'savings', d: path(chart.savings) }),
      ...chart.cash.map(p =>
        el('circle', { class: 'chart-dot cash', cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 3 }),
      ),
      ...chart.savings.map(p =>
        el('circle', { class: 'chart-dot savings', cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 3 }),
      ),
    );
    fill(holder, svg);

    const item = (cls, name, cents) =>
      h(
        'li',
        { class: 'legend-item' },
        h('span', { class: `swatch ${cls}`, 'aria-hidden': 'true' }),
        `${name}: `,
        h('strong', {}, formatCents(cents)),
        ` after ${rows.length} months`,
      );
    fill(
      legend,
      item('cash', 'Cash balance', totals.cash),
      item('savings', 'Savings', totals.savings),
    );

    fill(
      tableBody,
      ...rows.map(row =>
        h(
          'tr',
          {},
          h('th', { scope: 'row' }, monthLabel(row.month)),
          h('td', { class: 'num' }, formatCents(row.net)),
          h('td', { class: 'num' }, formatCents(row.cash)),
          h('td', { class: 'num' }, formatCents(row.savings)),
        ),
      ),
    );
  }

  let latest = null;
  store.subscribe(state => {
    latest = state;
    draw(state);
  });
  let lastWidth = holder.clientWidth;
  new ResizeObserver(() => {
    if (holder.clientWidth !== lastWidth && latest) {
      lastWidth = holder.clientWidth;
      draw(latest);
    }
  }).observe(holder);
}
