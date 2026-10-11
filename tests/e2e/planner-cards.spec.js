import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTapTargets } from './helpers.js';
import { PLAN, openPlanner, storedPlan } from './planner-helpers.js';

const summary = page => page.getByRole('region', { name: 'Balance summary' });
const card = (page, name) => page.getByRole('article', { name });

test('PLAN-3: "+ recurring card" adds an empty recurring card and focuses its title', async ({
  page,
}) => {
  await openPlanner(page);
  await page.getByRole('button', { name: '+ recurring card' }).click();
  const added = page.getByRole('article').first();
  await expect(added.getByText('Recurring', { exact: true })).toBeVisible();
  await expect(added.getByText('Manual', { exact: true })).toBeVisible();
  await expect(added.getByLabel('Card title')).toBeFocused();
  await added.getByLabel('Card title').fill('Bills');
  await page.reload();
  await expect(card(page, 'Bills')).toBeVisible();
});

test('PLAN-3: "+ one-time card" adds a card with a month that starts at the first month', async ({
  page,
}) => {
  await openPlanner(page, { ...PLAN, cards: [] });
  await page.getByRole('button', { name: '+ one-time card' }).click();
  const added = page.getByRole('article').first();
  await expect(added.getByText('One-time', { exact: true })).toBeVisible();
  await expect(added.getByLabel('Month')).toHaveValue('2026-01');
  await added.getByLabel('Month').fill('2026-05');
  expect((await storedPlan(page)).cards[0].month).toBe('2026-05');
});

test('PLAN-3: entries are added, edited and removed, and the summary follows', async ({ page }) => {
  await openPlanner(page, { ...PLAN, salaryCents: 100000, cards: [] });
  await page.getByRole('button', { name: '+ recurring card' }).click();
  const added = page.getByRole('article').first();
  await added.getByRole('button', { name: 'Add entry' }).click();
  await expect(added.getByLabel('Entry label')).toBeFocused();
  await added.getByLabel('Entry label').fill('Gym');
  await added.getByLabel('Amount').fill('30');
  await added.getByLabel('Amount').press('Tab');
  await expect(summary(page)).toContainText('Cash after 12 months: 11640.00');
  await added.getByLabel('Amount').fill('50');
  await added.getByLabel('Amount').press('Tab');
  await expect(summary(page)).toContainText('Cash after 12 months: 11400.00');
  await added.getByLabel('Kind').selectOption('income');
  await expect(summary(page)).toContainText('Cash after 12 months: 12600.00');
  await added.getByRole('button', { name: 'Remove entry Gym' }).click();
  await expect(summary(page)).toContainText('Cash after 12 months: 12000.00');
  await expect(added.getByLabel('Entry label')).toHaveCount(0);
  expect((await storedPlan(page)).cards[0].entries).toEqual([]);
});

test('PLAN-3: a card with entries asks before it is deleted', async ({ page }) => {
  await openPlanner(page, PLAN);
  page.once('dialog', dialog => dialog.dismiss());
  await card(page, 'Holiday').getByRole('button', { name: 'Delete card Holiday' }).click();
  await expect(card(page, 'Holiday')).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await card(page, 'Holiday').getByRole('button', { name: 'Delete card Holiday' }).click();
  await expect(card(page, 'Holiday')).toHaveCount(0);
  expect((await storedPlan(page)).cards).toHaveLength(1);
});

test('PLAN-3: an empty card is deleted without a question', async ({ page }) => {
  await openPlanner(page);
  await page.getByRole('button', { name: '+ recurring card' }).click();
  await page.getByRole('button', { name: /^Delete card/ }).click();
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('PLAN-6: a saving accepts a negative amount; other kinds do not', async ({ page }) => {
  await openPlanner(page, { ...PLAN, salaryCents: 0, cards: [] });
  await page.getByRole('button', { name: '+ recurring card' }).click();
  const added = page.getByRole('article').first();
  await added.getByRole('button', { name: 'Add entry' }).click();
  await added.getByLabel('Kind').selectOption('saving');
  await added.getByLabel('Amount').fill('-50');
  await added.getByLabel('Amount').press('Tab');
  await expect(added.getByLabel('Amount')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(summary(page)).toContainText('Savings: -600.00');
  await added.getByLabel('Kind').selectOption('expense');
  await expect(added.getByLabel('Amount')).toHaveAttribute('aria-invalid', 'true');
  await expect(added.getByText('Only a saving can be negative')).toBeVisible();
  // the invalid edit is not applied: the plan keeps the last valid entry
  await expect(summary(page)).toContainText('Savings: -600.00');
});

test('PLAN-8: badges show the kind of a card and the source of cards and entries', async ({
  page,
}) => {
  await openPlanner(page, PLAN);
  const monthly = card(page, 'Every month');
  await expect(monthly.getByText('Recurring', { exact: true })).toBeVisible();
  await expect(monthly.getByText('Mixed', { exact: true })).toBeVisible();
  const landlord = monthly.getByRole('listitem').filter({ hasText: 'Sample Landlord' });
  await expect(landlord.getByText('Imported', { exact: true })).toBeVisible();
  const piggy = monthly.getByRole('listitem').filter({ hasText: 'Piggy bank' });
  await expect(piggy.getByText('Manual', { exact: true })).toBeVisible();
  const holiday = card(page, 'Holiday');
  await expect(holiday.getByText('One-time', { exact: true })).toBeVisible();
  await expect(holiday.getByText('Imported', { exact: true }).first()).toBeVisible();
});

test('PLAN-8: the details of an entry open on tap or click, not only on hover', async ({
  page,
}) => {
  await openPlanner(page, PLAN);
  await page.getByRole('button', { name: 'About Sample Landlord' }).click();
  const tip = page.getByRole('tooltip').filter({ hasText: 'Sample Landlord' });
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Expense');
  await expect(tip).toContainText('Housing');
  await expect(tip).toContainText('Every month');
  await expect(tip).toContainText('420.00');
  await expect(tip).toContainText('Imported');
  await page.getByRole('heading', { level: 1 }).click();
  await expect(tip).toBeHidden();
});

test('PLAN-9: "Import bank CSV" opens the import page', async ({ page }) => {
  await openPlanner(page);
  await page.getByRole('link', { name: 'Import bank CSV' }).click();
  await expect(page).toHaveURL(/import\.html$/);
});

test('GEN-1: cards fit a phone without sideways scrolling', async ({ page }) => {
  await openPlanner(page, PLAN);
  await page.setViewportSize({ width: 375, height: 800 });
  await expectNoHorizontalOverflow(page);
  await expectTapTargets(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await expectNoHorizontalOverflow(page);
});
