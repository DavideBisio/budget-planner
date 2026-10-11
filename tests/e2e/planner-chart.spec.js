import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers.js';
import { PLAN, entry, openPlanner } from './planner-helpers.js';

const chart = page => page.getByRole('region', { name: 'Balance chart' });
const figure = page => chart(page).getByRole('img');

const pathY = async (page, series) =>
  (await chart(page).locator(`path[data-series="${series}"]`).getAttribute('d'))
    .match(/[ML][^ML]+/g)
    .map(part => Number(part.slice(1).trim().split(/[ ,]/)[1]));

test('PLAN-4, PLAN-5: the chart draws a cash line and a savings line with their end values', async ({
  page,
}) => {
  await openPlanner(page, PLAN);
  await expect(figure(page)).toBeVisible();
  await expect(figure(page)).toHaveAccessibleName(/Cash and savings per month, Jan 26 to Dec 26/);
  await expect(chart(page).locator('path[data-series="cash"]')).toBeVisible();
  await expect(chart(page).locator('path[data-series="savings"]')).toBeVisible();
  // the values are written out, no hover needed
  const legend = chart(page).getByRole('list', { name: 'Legend' });
  await expect(legend).toContainText('Cash balance');
  await expect(legend).toContainText('Savings');
  // salary 2500 - rent 420 - saved 100 = 1980 a month; the holiday costs 200: 12 x 1980 - 200
  await expect(legend).toContainText('23560.00');
  await expect(legend).toContainText('1200.00');
});

test('PLAN-6: a withdrawal makes the savings line go down', async ({ page }) => {
  const plan = structuredClone(PLAN);
  plan.cards[0].entries = [entry('entry-9', 'Rainy day', 'saving', -30000)];
  await openPlanner(page, plan);
  const savings = await pathY(page, 'savings');
  // a lower value is drawn lower on the screen, which is a larger y
  for (let i = 1; i < savings.length; i += 1) expect(savings[i]).toBeGreaterThan(savings[i - 1]);
  await expect(chart(page).getByRole('list', { name: 'Legend' })).toContainText('-3600.00');
});

test('PLAN-4: the chart follows the inputs', async ({ page }) => {
  await openPlanner(page, PLAN);
  await page.getByLabel('Monthly salary').fill('3000');
  await expect(chart(page).getByRole('list', { name: 'Legend' })).toContainText('29560.00');
  await page.getByLabel('Months shown').selectOption('6');
  await expect(figure(page)).toHaveAccessibleName(/Jan 26 to Jun 26/);
});

test('GEN-1: readable at 375 px: drawn at its real size, text of 11 px or more', async ({
  page,
}) => {
  await openPlanner(page, PLAN);
  await page.setViewportSize({ width: 375, height: 800 });
  await expectNoHorizontalOverflow(page);
  const svg = figure(page);
  const box = await svg.boundingBox();
  const viewBoxWidth = Number((await svg.getAttribute('viewBox')).split(' ')[2]);
  expect(Math.abs(box.width - viewBoxWidth)).toBeLessThan(1.5);
  expect(box.width).toBeLessThanOrEqual(375);
  const sizes = await svg
    .locator('text')
    .evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).fontSize)));
  expect(sizes.length).toBeGreaterThan(4);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
});

test('GEN-2: the chart is drawn again when the screen changes size', async ({ page }) => {
  await openPlanner(page, PLAN);
  await page.setViewportSize({ width: 375, height: 800 });
  const narrow = Number((await figure(page).getAttribute('viewBox')).split(' ')[2]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect
    .poll(async () => Number((await figure(page).getAttribute('viewBox')).split(' ')[2]))
    .toBeGreaterThan(narrow + 100);
});

test('PLAN-4: a data table gives the same numbers as text', async ({ page }) => {
  await openPlanner(page, PLAN);
  await chart(page).getByText('Show data table').click();
  const table = chart(page).getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(13);
  await expect(table.getByRole('columnheader')).toHaveText([
    'Month',
    'Cash change',
    'Cash balance',
    'Savings',
  ]);
  const march = table.getByRole('row').filter({ hasText: 'Mar 26' });
  await expect(march).toContainText('1780.00');
  await expect(march).toContainText('5740.00');
  await expect(march).toContainText('300.00');
});

test('PLAN-4: an empty plan still draws, flat at zero', async ({ page }) => {
  await openPlanner(page);
  await expect(figure(page)).toBeVisible();
  const cash = await pathY(page, 'cash');
  expect(new Set(cash).size).toBe(1);
});
