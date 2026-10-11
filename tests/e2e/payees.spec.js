import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTapTargets } from './helpers.js';

const JAN = 'tests/fixtures/comma-split.csv';
const FEB = 'tests/fixtures/missing-balance.csv';

const card = page => page.locator('#result-payees');
const list = page => page.getByRole('group', { name: 'Payee patterns', exact: true });
const items = page => list(page).locator('.pattern-item');

test.beforeEach(async ({ page }) => {
  await page.goto('/import.html');
  await page.getByRole('button', { name: /^Import/ }).click();
  await page.getByLabel('Statement files').setInputFiles([JAN, FEB]);
  await page.getByRole('button', { name: /^Payee extraction/ }).click();
});

test('IMP-7: the stored rule is shown and the result counts payees with none extracted', async ({
  page,
}) => {
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText('Used for 3 transactions');
  await expect(card(page)).toContainText('Read by a pattern: 3');
  await expect(card(page)).toContainText('No payee extracted: 2');
  await expect(card(page)).toContainText('Type column: 2');
});

test('IMP-5, IMP-7: a payee pattern is built from words and the name is marked in examples', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add a payee pattern' }).click();
  const added = items(page).nth(1);
  await expect(added.getByLabel('Match when the text')).toHaveValue('between');
  await added.getByLabel('Match when the text').selectOption('after');
  await added.getByLabel('Text just before the part to keep').fill('payroll');
  await expect(added.locator('code')).toHaveText('payroll\\s*(.+?)\\s*$');
  await expect(added.locator('.match-count')).toHaveText('A name is found in 2 of 5 descriptions.');
  await expect(added.locator('mark').first()).toHaveText('Example Corp ref JAN');
  await expect(added).toContainText('Used for 2 transactions');
  await expect(card(page)).toContainText('No payee extracted: 0');
});

test('IMP-7: between two words needs both words', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a payee pattern' }).click();
  const added = items(page).nth(1);
  await added.getByLabel('Text just before the part to keep').fill('paid to');
  await expect(added.locator('code')).toHaveText('(nothing yet)');
  await added.getByLabel('Text just after the part to keep').fill('ref');
  await expect(added.locator('code')).toHaveText('paid to\\s*(.+?)\\s*ref');
  await expect(added.locator('.match-count')).toHaveText('A name is found in 3 of 5 descriptions.');
});

test('IMP-7: rules can be moved up and down with buttons and the order decides', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add a payee pattern' }).click();
  const added = items(page).nth(1);
  await added.getByLabel('Match when the text').selectOption('after');
  await added.getByLabel('Text just before the part to keep').fill('paid to');
  // Rule 1 still wins for the rows it matches, so the new rule is not used
  await expect(added).toContainText('Used for 0 transactions');
  await expect(page.getByRole('button', { name: 'Move Payee patterns 1 up' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Move Payee patterns 2 down' })).toBeDisabled();

  await page.getByRole('button', { name: 'Move Payee patterns 2 up' }).click();
  await expect(items(page).first().locator('code')).toHaveText('paid to\\s*(.+?)\\s*$');
  await expect(items(page).first()).toContainText('Used for 3 transactions');
  await expect(items(page).nth(1)).toContainText('Used for 0 transactions');
  // Focus follows the moved item so the keyboard user can keep going
  await expect(page.getByRole('button', { name: 'Move Payee patterns 1 down' })).toBeFocused();
});

test('IMP-7: pick a transaction in the test panel to see its payee', async ({ page }) => {
  const panel = page.getByRole('group', { name: 'Try a transaction' });
  await panel
    .getByLabel('Transaction')
    .selectOption({ label: '2026-01-09 · -19.90 · Paid to Demo Streaming ref SUB' });
  await expect(panel.getByRole('status')).toContainText('Payee: Demo Streaming');
  await expect(panel.getByRole('status')).toContainText('pattern 1');
  await panel
    .getByLabel('Transaction')
    .selectOption({ label: '2026-02-02 · 1500.00 · Payroll Example Corp ref FEB' });
  await expect(panel.getByRole('status')).toContainText('Payee: Salary');
  await expect(panel.getByRole('status')).toContainText('Type column');
});

test('layout holds with the payee step open', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Add a payee pattern' }).click();
  await expectNoHorizontalOverflow(page);
  if (info.project.name === 'mobile') await expectTapTargets(page);
});
