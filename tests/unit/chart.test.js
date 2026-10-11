import { describe, expect, it } from 'vitest';
import { axisLabel, buildChart, monthLabel, niceScale } from '../../src/core/chart.js';

const rows = values =>
  values.map(([cash, savings], i) => ({
    month: `2026-${String(i + 1).padStart(2, '0')}`,
    cash,
    savings,
  }));

describe('niceScale', () => {
  it('rounds the limits out to round numbers', () => {
    const scale = niceScale(0, 772000);
    expect(scale.min).toBe(0);
    expect(scale.max).toBeGreaterThanOrEqual(772000);
    expect(scale.ticks[0]).toBe(0);
    expect(scale.ticks.at(-1)).toBe(scale.max);
    const steps = scale.ticks.slice(1).map((t, i) => t - scale.ticks[i]);
    expect(new Set(steps).size).toBe(1);
  });

  it('includes negative values', () => {
    const scale = niceScale(-125000, 400000);
    expect(scale.min).toBeLessThanOrEqual(-125000);
    expect(scale.ticks).toContain(0);
  });

  it('copes with all-zero data', () => {
    const scale = niceScale(0, 0);
    expect(scale.max).toBeGreaterThan(scale.min);
    expect(scale.ticks.length).toBeGreaterThan(1);
  });
});

describe('monthLabel', () => {
  it('gives a short month and year', () => {
    expect(monthLabel('2026-03')).toBe('Mar 26');
    expect(monthLabel('2027-12')).toBe('Dec 27');
  });
});

describe('buildChart (PLAN-4, PLAN-5)', () => {
  const size = { width: 400, height: 240 };

  it('spreads the months evenly across the plot', () => {
    const chart = buildChart(
      rows([
        [0, 0],
        [100, 0],
        [200, 0],
        [300, 0],
      ]),
      size,
    );
    const xs = chart.cash.map(p => p.x);
    expect(xs[0]).toBe(chart.plot.x);
    expect(xs.at(-1)).toBe(chart.plot.x + chart.plot.width);
    expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1]);
  });

  it('draws higher values higher on the screen', () => {
    const chart = buildChart(
      rows([
        [0, 0],
        [500000, 100000],
      ]),
      size,
    );
    expect(chart.cash[1].y).toBeLessThan(chart.cash[0].y);
    expect(chart.savings[1].y).toBeLessThan(chart.savings[0].y);
    expect(chart.savings[1].y).toBeGreaterThan(chart.cash[1].y);
  });

  it('shows a withdrawal as a line that goes down', () => {
    const chart = buildChart(
      rows([
        [0, 300000],
        [100000, 200000],
        [200000, 100000],
      ]),
      size,
    );
    expect(chart.savings[1].y).toBeGreaterThan(chart.savings[0].y);
    expect(chart.savings[2].y).toBeGreaterThan(chart.savings[1].y);
  });

  it('keeps negative values inside the plot and puts the zero line between', () => {
    const chart = buildChart(
      rows([
        [-100000, -50000],
        [200000, 100000],
      ]),
      size,
    );
    const bottom = chart.plot.y + chart.plot.height;
    for (const p of [...chart.cash, ...chart.savings]) {
      expect(p.y).toBeGreaterThanOrEqual(chart.plot.y);
      expect(p.y).toBeLessThanOrEqual(bottom);
    }
    expect(chart.zeroY).toBeGreaterThan(chart.plot.y);
    expect(chart.zeroY).toBeLessThan(bottom);
  });

  it('labels the value axis with ticks inside the plot', () => {
    const chart = buildChart(
      rows([
        [0, 0],
        [772000, 40000],
      ]),
      size,
    );
    expect(chart.yTicks.length).toBeGreaterThan(2);
    for (const tick of chart.yTicks) {
      expect(tick.y).toBeGreaterThanOrEqual(chart.plot.y - 0.001);
      expect(tick.y).toBeLessThanOrEqual(chart.plot.y + chart.plot.height + 0.001);
    }
  });

  it('thins the month labels so they do not overlap on a narrow screen', () => {
    const many = rows(Array.from({ length: 12 }, (_, i) => [i * 100, 0]));
    const narrow = buildChart(many, { width: 320, height: 240 });
    const wide = buildChart(many, { width: 1000, height: 240 });
    expect(narrow.xTicks.length).toBeLessThan(wide.xTicks.length);
    const gaps = narrow.xTicks.slice(1).map((t, i) => t.x - narrow.xTicks[i].x);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(48);
    expect(narrow.xTicks[0].index).toBe(0);
  });

  it('handles a single month', () => {
    const chart = buildChart(rows([[500, 100]]), size);
    expect(chart.cash).toHaveLength(1);
    expect(Number.isFinite(chart.cash[0].x)).toBe(true);
  });
});

describe('axisLabel', () => {
  it.each([
    [0, '0'],
    [25000, '250'],
    [-25000, '-250'],
    [100000, '1k'],
    [772000, '7.7k'],
    [-120000, '-1.2k'],
    [250000000, '2.5M'],
  ])('shortens %i cents to %s', (cents, text) => {
    expect(axisLabel(cents)).toBe(text);
  });
});
