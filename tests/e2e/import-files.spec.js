import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTapTargets } from './helpers.js';

const JAN = 'tests/fixtures/comma-split.csv';
const FEB = 'tests/fixtures/missing-balance.csv';

const summary = page => page.locator('#result-import');
const files = page => page.getByRole('list', { name: 'Imported files' });
const badge = (page, title) =>
  page.getByRole('button', { name: new RegExp(`^${title}`) }).locator('.badge');

test.beforeEach(async ({ page }) => {
  await page.goto('/import.html');
  await page.getByRole('button', { name: /^Import/ }).click();
});

test('IMP-4: importing files shows the totals and the balance check', async ({ page }) => {
  await page.getByLabel('Statement files').setInputFiles([JAN, FEB]);
  await expect(summary(page)).toContainText('5 transactions over 2 months');
  await expect(summary(page)).toContainText('Total income: 3000.00');
  await expect(summary(page)).toContainText('Total outcome: 859.90');
  await expect(summary(page)).toContainText('Balance reconciles: Yes');
  await expect(files(page).getByRole('listitem')).toHaveCount(2);
  await expect(files(page)).toContainText('comma-split.csv');
  await expect(files(page)).toContainText('Balance matches');
  await expect(files(page)).toContainText('No opening or closing balance');
  await expect(badge(page, 'Import')).toHaveText('Ready');
  await expect(badge(page, 'Filtering')).toHaveText('Ready');
});

test('IMP-4: a file can be removed and the summary follows', async ({ page }) => {
  await page.getByLabel('Statement files').setInputFiles([JAN, FEB]);
  await expect(files(page).getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'Remove missing-balance.csv' }).click();
  await expect(files(page).getByRole('listitem')).toHaveCount(1);
  await expect(summary(page)).toContainText('3 transactions over 1 month');
  await page.getByRole('button', { name: 'Remove comma-split.csv' }).click();
  await expect(summary(page)).toBeHidden();
  await expect(badge(page, 'Import')).toHaveText('To do');
  await expect(badge(page, 'Filtering')).toHaveText('Waiting');
});

test('IMP-4: a balance that does not reconcile is reported', async ({ page }) => {
  const text = readFileSync(JAN, 'utf8').replace('2060.10', '2000.00');
  await page.getByLabel('Statement files').setInputFiles({
    name: 'off.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(text),
  });
  await expect(summary(page)).toContainText('Balance reconciles: No');
  await expect(files(page)).toContainText('off by');
});

test('IMP-4: files are kept as raw text and re-parsed when the parsing settings change', async ({
  page,
}) => {
  await page.getByLabel('Statement files').setInputFiles(JAN);
  await expect(badge(page, 'Import')).toHaveText('Ready');

  await page.getByLabel('Description column').fill('Nonexistent');
  await expect(badge(page, 'Import')).toHaveText('Needs attention');
  await expect(page.getByRole('button', { name: /^Import/ }).locator('.step-reason')).toContainText(
    'comma-split.csv',
  );
  await expect(files(page)).toContainText('"Nonexistent" not found');

  await page.getByLabel('Description column').fill('Description');
  await expect(badge(page, 'Import')).toHaveText('Ready');
  await expect(summary(page)).toContainText('3 transactions over 1 month');
});

test('IMP-4: the same file name twice stays distinct', async ({ page }) => {
  await page.getByLabel('Statement files').setInputFiles(JAN);
  await page.getByLabel('Statement files').setInputFiles(JAN);
  await expect(files(page).getByRole('listitem')).toHaveCount(2);
  await expect(files(page).getByRole('listitem').nth(1)).toContainText('comma-split (2).csv');
});

test('IMP-4: dropping files works as an extra on desktop', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'drag and drop is a desktop extra');
  const text = readFileSync(FEB, 'utf8');
  await page.locator('.dropzone').evaluate((zone, content) => {
    const data = new DataTransfer();
    data.items.add(new File([content], 'dropped.csv', { type: 'text/csv' }));
    zone.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true }));
  }, text);
  await expect(files(page)).toContainText('dropped.csv');
  await expect(summary(page)).toContainText('2 transactions over 1 month');
});

test('nothing is uploaded: no request leaves the page origin', async ({ page }) => {
  const external = [];
  page.on('request', request => {
    if (!request.url().startsWith('http://localhost:4173')) external.push(request.url());
  });
  await page.getByLabel('Statement files').setInputFiles([JAN, FEB]);
  await expect(summary(page)).toBeVisible();
  expect(external).toEqual([]);
});

test('layout holds with files imported', async ({ page }, info) => {
  await page.getByLabel('Statement files').setInputFiles([JAN, FEB]);
  await expect(summary(page)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  if (info.project.name === 'mobile') await expectTapTargets(page);
});
