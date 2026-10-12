import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTapTargets } from './helpers.js';

const JAN = 'tests/fixtures/comma-split.csv';
const FEB = 'tests/fixtures/missing-balance.csv';

const card = page => page.locator('#result-rules');
const list = page => page.getByRole('group', { name: 'Matching rules', exact: true });
const rules = page => list(page).locator('.pattern-item');

test.beforeEach(async ({ page }) => {
  await page.goto('/import.html');
  await page.getByRole('tab', { name: /^Import/ }).click();
  await page.getByLabel('Statement files').setInputFiles([JAN, FEB]);
  await page.getByRole('tab', { name: /^Categories/ }).click();
});

test('IMP-8: every rule shows its category, kind and how many transactions it matches', async ({
  page,
}) => {
  await expect(rules(page)).toHaveCount(5);
  const first = rules(page).first();
  await expect(first.getByLabel('Category')).toHaveValue('Salary');
  await expect(first.getByLabel('Kind')).toHaveValue('income');
  await expect(first).toContainText('Matches 2 transactions');
  await expect(rules(page).nth(1)).toContainText('Matches 2 transactions');
  await expect(rules(page).nth(1).getByLabel('Kind')).toHaveValue('');
  await expect(rules(page).nth(4)).toContainText('Matches 0 transactions');
});

test('IMP-8: transactions no rule matches are listed', async ({ page }) => {
  await expect(card(page)).toContainText('Unmatched: 1');
  await expect(card(page).getByText('Paid to Demo Streaming ref SUB')).toBeVisible();
});

test('IMP-8: a new rule picks up the unmatched transaction', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a matching rule' }).click();
  const added = rules(page).nth(5);
  await added.getByLabel('Text to look for').fill('streaming');
  await added.getByLabel('Category').selectOption('Utilities');
  await added.getByLabel('Kind').selectOption('expense');
  await expect(added).toContainText('Matches 1 transaction');
  await expect(card(page)).toContainText('Unmatched: 0');
});

test('IMP-8: the first matching rule wins, so order matters and moves with buttons', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add a matching rule' }).click();
  const added = rules(page).nth(5);
  await added.getByLabel('Text to look for').fill('landlord');
  await added.getByLabel('Category').selectOption('Food & dining');
  await expect(added).toContainText('Matches 0 transactions');

  for (let step = 6; step > 2; step -= 1) {
    await page.getByRole('button', { name: `Move Matching rules ${step} up` }).click();
  }
  await expect(rules(page).nth(1).getByLabel('Text to look for')).toHaveValue('landlord');
  await expect(rules(page).nth(1)).toContainText('Matches 2 transactions');
  await expect(rules(page).nth(2)).toContainText('Matches 0 transactions');
  await expect(page.getByRole('button', { name: 'Move Matching rules 2 up' })).toBeFocused();
});

test('IMP-8: a rule can be removed', async ({ page }) => {
  await rules(page).nth(4).getByRole('button', { name: 'Remove Matching rules 5' }).click();
  await expect(rules(page)).toHaveCount(4);
});

test('IMP-8: rules are cards that fit a phone', async ({ page }, info) => {
  await expectNoHorizontalOverflow(page);
  if (info.project.name === 'mobile') {
    await expectTapTargets(page);
    const box = await rules(page).first().boundingBox();
    expect(box.width).toBeLessThanOrEqual(375);
  }
});
