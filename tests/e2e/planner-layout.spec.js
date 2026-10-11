import { expect, test } from '@playwright/test';
import { BREAKPOINT, expectNoHorizontalOverflow, expectTapTargets } from './helpers.js';

const summary = page => page.getByRole('region', { name: 'Balance summary' });

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('PLAN-1: the monthly salary drives the balance summary', async ({ page }) => {
  await expect(summary(page)).toContainText('Cash after 12 months: 0.00');
  await page.getByLabel('Monthly salary').fill('2500');
  await expect(summary(page)).toContainText('Cash after 12 months: 30000.00');
  await page.getByLabel('Months shown').selectOption('24');
  await expect(summary(page)).toContainText('Cash after 24 months: 60000.00');
});

test('PLAN-1: a salary that is not an amount is explained and not used', async ({ page }) => {
  await page.getByLabel('Monthly salary').fill('2500');
  await page.getByLabel('Monthly salary').fill('lots');
  await expect(page.getByLabel('Monthly salary')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Type an amount such as 2500 or 2500.50')).toBeVisible();
  await expect(summary(page)).toContainText('Cash after 12 months: 30000.00');
});

test('PLAN-1: the inputs survive a reload', async ({ page }) => {
  await page.getByLabel('Monthly salary').fill('1800.50');
  await page.getByLabel('First month').fill('2027-03');
  await page.reload();
  await expect(page.getByLabel('Monthly salary')).toHaveValue('1800.50');
  await expect(page.getByLabel('First month')).toHaveValue('2027-03');
});

test('GEN-2: inputs and cards sit left, chart and totals right on a large screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: BREAKPOINT, height: 900 });
  const inputs = await page.getByRole('region', { name: 'Inputs' }).boundingBox();
  const cards = await page.getByRole('region', { name: 'Cards' }).boundingBox();
  const chart = await page.getByRole('region', { name: 'Balance chart' }).boundingBox();
  const totals = await page.getByRole('region', { name: 'Totals' }).boundingBox();
  expect(cards.x).toBe(inputs.x);
  expect(chart.x).toBeGreaterThan(inputs.x + inputs.width - 1);
  expect(totals.x).toBe(chart.x);
  expect(cards.y).toBeGreaterThan(inputs.y);
  expect(totals.y).toBeGreaterThan(chart.y);
});

test('GEN-1: one column on a phone, with the summary kept in view while scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await expectNoHorizontalOverflow(page);
  await expectTapTargets(page);
  const before = await summary(page).boundingBox();
  await page.evaluate(() => window.scrollTo(0, 400));
  const after = await summary(page).boundingBox();
  expect(after.y).toBeGreaterThanOrEqual(0);
  expect(after.y).toBeLessThan(before.y);
  expect(after.y).toBeLessThan(100);
  const inputs = await page.getByRole('region', { name: 'Inputs' }).boundingBox();
  const chart = await page.getByRole('region', { name: 'Balance chart' }).boundingBox();
  expect(chart.x).toBe(inputs.x);
});
