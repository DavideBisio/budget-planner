import { expect, test } from '@playwright/test';
import { PLAN, entry, openPlanner } from './planner-helpers.js';

const summary = page => page.getByRole('region', { name: 'Balance summary' });
const chart = page => page.getByRole('region', { name: 'Balance chart' });

const withSaving = amountCents => {
  const plan = structuredClone(PLAN);
  plan.cards[0].entries = [entry('entry-9', 'Rainy day', 'saving', amountCents)];
  plan.cards[1].entries = [];
  return plan;
};

test('PLAN-6: savings are not clamped and a warning says when they go below zero', async ({
  page,
}) => {
  await openPlanner(page, withSaving(-30000));
  await expect(summary(page)).toContainText('Savings: -3600.00');
  await expect(summary(page)).toContainText('Savings go below zero from Jan 26 (lowest -3600.00)');
  await expect(chart(page)).toContainText('Savings go below zero from Jan 26');
});

test('PLAN-6: no warning while savings stay at or above zero', async ({ page }) => {
  await openPlanner(page, withSaving(10000));
  await expect(summary(page)).toContainText('Savings: 1200.00');
  await expect(page.getByText('Savings go below zero')).toHaveCount(0);
});

test('PLAN-6: the warning appears and goes away as the amount is edited', async ({ page }) => {
  await openPlanner(page, withSaving(10000));
  const row = page.getByRole('article', { name: 'Every month' });
  await row.getByLabel('Amount').fill('-20');
  await row.getByLabel('Amount').press('Tab');
  await expect(summary(page)).toContainText('Savings go below zero from Jan 26 (lowest -240.00)');
  await row.getByLabel('Amount').fill('20');
  await row.getByLabel('Amount').press('Tab');
  await expect(page.getByText('Savings go below zero')).toHaveCount(0);
});

test('PLAN-6: a saving entry explains that a negative amount is a withdrawal', async ({ page }) => {
  await openPlanner(page, withSaving(10000));
  const row = page.getByRole('article', { name: 'Every month' });
  await expect(row.getByText('A negative amount takes money out of savings')).toBeVisible();
  await row.getByLabel('Kind').selectOption('expense');
  await expect(row.getByText('A negative amount takes money out of savings')).toBeHidden();
});
