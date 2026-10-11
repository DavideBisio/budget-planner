import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTapTargets } from './helpers.js';

const JAN = 'tests/fixtures/comma-split.csv';
const FEB = 'tests/fixtures/missing-balance.csv';

const card = page => page.locator('#result-result');
const tab = (page, name) => card(page).getByRole('tab', { name: new RegExp(`^${name}`) });
const item = (page, payee) => card(page).locator('.result-item', { hasText: payee });

async function importFixtures(page) {
  await page.goto('/import.html');
  await page.getByRole('button', { name: /^Import/ }).click();
  await page.getByLabel('Statement files').setInputFiles([JAN, FEB]);
}

test.beforeEach(async ({ page }) => {
  await importFixtures(page);
});

test('IMP-10: recurring, one-time and ignored entries are separate tabs with counts', async ({
  page,
}) => {
  await expect(tab(page, 'Recurring')).toHaveText('Recurring (2)');
  await expect(tab(page, 'One-time')).toHaveText('One-time (1)');
  await expect(tab(page, 'Ignored')).toHaveText('Ignored (0)');
  await expect(tab(page, 'Recurring')).toHaveAttribute('aria-selected', 'true');
  await expect(item(page, 'Sample Landlord')).toContainText('-420.00');
  await expect(item(page, 'Sample Landlord')).toContainText('Housing');
  await tab(page, 'One-time').click();
  await expect(item(page, 'Demo Streaming')).toContainText('2026-01-09');
  await expect(item(page, 'Demo Streaming')).toContainText('Other expenses');
});

test('IMP-10: tabs work with the arrow keys', async ({ page }) => {
  await tab(page, 'Recurring').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'One-time')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'One-time')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(tab(page, 'Recurring')).toHaveAttribute('aria-selected', 'true');
});

test('IMP-10: details show the input row, payee, matched rule, category and kind', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Details of Sample Landlord' });
  await trigger.click();
  const details = item(page, 'Sample Landlord').locator('.popover-body');
  await expect(details).toBeVisible();
  await expect(details).toContainText('2026-01-04');
  await expect(details).toContainText('2026-02-04');
  await expect(details).toContainText('Paid to Sample Landlord ref RENT');
  await expect(details).toContainText('Debit: 420.00');
  await expect(details).toContainText('Payee: Sample Landlord (found by pattern 1)');
  await expect(details).toContainText('Rule: 2 – landlord|rent');
  await expect(details).toContainText('Category: Housing');
  await expect(details).toContainText('Kind: expense');
  await page.keyboard.press('Escape');
  await expect(details).toBeHidden();
});

test('IMP-10: details open from the keyboard focus alone', async ({ page }) => {
  await page.getByRole('button', { name: 'Details of Sample Landlord' }).focus();
  await expect(item(page, 'Sample Landlord').locator('.popover-body')).toBeVisible();
});

test('IMP-10: a long series shows five transactions and a "+N more" note', async ({ page }) => {
  const rows = ['Booking date,Value date,Debit,Credit,Type,Description'];
  for (const month of ['2026-01', '2026-02']) {
    for (const day of ['02', '03', '04']) {
      rows.push(`${month}-${day},${month}-${day},3.50,,Card,Paid to Corner Cafe ref C${day}`);
    }
  }
  await page.getByLabel('Statement files').setInputFiles({
    name: 'cafe.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(rows.join('\n')),
  });
  await page.getByRole('button', { name: 'Details of Corner Cafe' }).click();
  const details = item(page, 'Corner Cafe').locator('.popover-body');
  await expect(details.locator('.tx-detail')).toHaveCount(5);
  await expect(details).toContainText('+1 more');
});

test('IMP-11: a category can be changed for one transaction and reset', async ({ page }) => {
  await tab(page, 'One-time').click();
  const row = item(page, 'Demo Streaming');
  await row.getByRole('button', { name: 'Change Demo Streaming' }).click();
  await row.getByLabel('Category').selectOption('Utilities');
  await expect(row).toContainText('Utilities');
  await expect(row).toContainText('Changed by hand');
  await expect(row.getByLabel('Apply to')).toHaveValue('transaction');
  await row.getByRole('button', { name: 'Reset changes' }).click();
  await expect(row).toContainText('Other expenses');
  await expect(row).not.toContainText('Changed by hand');
});

test('IMP-11: a change for a payee applies to all of its transactions', async ({ page }) => {
  const row = item(page, 'Sample Landlord');
  await row.getByRole('button', { name: 'Change Sample Landlord' }).click();
  await row.getByLabel('Kind').selectOption('saving');
  await expect(row).toContainText('Saving');
  await page.getByRole('button', { name: 'Details of Sample Landlord' }).click();
  await expect(row.locator('.popover-body')).toContainText('Changed by hand: payee');
});

test('IMP-11: an ignored transaction moves to the Ignored tab and can be restored', async ({
  page,
}) => {
  await tab(page, 'One-time').click();
  const row = item(page, 'Demo Streaming');
  await row.getByRole('button', { name: 'Change Demo Streaming' }).click();
  await row.getByRole('button', { name: 'Ignore Demo Streaming' }).click();
  await expect(tab(page, 'One-time')).toHaveText('One-time (0)');
  await expect(tab(page, 'Ignored')).toHaveText('Ignored (1)');
  await tab(page, 'Ignored').click();
  await item(page, 'Demo Streaming')
    .getByRole('button', { name: 'Restore Demo Streaming' })
    .click();
  await expect(tab(page, 'Ignored')).toHaveText('Ignored (0)');
  await expect(tab(page, 'One-time')).toHaveText('One-time (1)');
});

test('layout holds with the result open', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Details of Sample Landlord' }).click();
  await expectNoHorizontalOverflow(page);
  if (info.project.name === 'mobile') await expectTapTargets(page);
});
