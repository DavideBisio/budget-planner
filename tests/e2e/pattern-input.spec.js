import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTapTargets } from './helpers.js';

const SAMPLE = 'data/sample-bank-report.csv';

// The balance row fields of the parsing step are pattern inputs (IMP-5).
const opening = page => page.getByRole('group', { name: 'Opening balance row' });
const mode = page => opening(page).getByLabel('Match when the text');
const stored = page => opening(page).locator('code');

test.beforeEach(async ({ page }) => {
  await page.goto('/import.html');
});

test('IMP-5: a stored regular expression opens in the closest mode', async ({ page }) => {
  await expect(mode(page)).toHaveValue('starts');
  await expect(opening(page).getByLabel('Text to look for')).toHaveValue('opening balance');
  await expect(stored(page)).toHaveText('^opening balance');
});

test('IMP-5: plain text is escaped automatically', async ({ page }) => {
  await mode(page).selectOption('contains');
  await opening(page).getByLabel('Text to look for').fill('a.b (c)');
  await expect(stored(page)).toHaveText('a\\.b \\(c\\)');
  await mode(page).selectOption('equals');
  await expect(stored(page)).toHaveText('^a\\.b \\(c\\)$');
  await mode(page).selectOption('ends');
  await expect(stored(page)).toHaveText('a\\.b \\(c\\)$');
});

test('IMP-5: several words become chips that can be added and removed with the keyboard', async ({
  page,
}) => {
  await mode(page).selectOption('anyOf');
  const add = opening(page).getByLabel('Add a word');
  await add.fill('opening');
  await add.press('Enter');
  await add.fill('start of period');
  await opening(page).getByRole('button', { name: 'Add', exact: true }).click();
  await expect(opening(page).getByRole('listitem')).toHaveCount(2);
  await expect(stored(page)).toHaveText('opening|start of period');
  await opening(page).getByRole('button', { name: 'Remove opening' }).click();
  await expect(stored(page)).toHaveText('start of period');
});

test('IMP-5: live feedback counts matches and marks them against the imported descriptions', async ({
  page,
}) => {
  await expect(opening(page)).toContainText('Import a file to see which descriptions match');
  await page.getByLabel('Sample statement').setInputFiles(SAMPLE);
  await expect(opening(page).locator('.match-count')).toHaveText(/^1 of \d+ descriptions match\.$/);
  await expect(opening(page).locator('mark')).toHaveText('Opening balance');
  await expect(opening(page).getByText('Not matching')).toBeVisible();

  await mode(page).selectOption('contains');
  await opening(page).getByLabel('Text to look for').fill('zzz-nothing');
  await expect(opening(page).locator('.match-count')).toHaveText(/^0 of \d+ descriptions match\.$/);
});

test('IMP-5: an invalid advanced expression is explained in plain language', async ({ page }) => {
  await mode(page).selectOption('advanced');
  await expect(opening(page).getByLabel('Regular expression')).toHaveValue('^opening balance');
  await opening(page).getByLabel('Regular expression').fill('[abc');
  const alert = opening(page).getByRole('alert');
  await expect(alert).toContainText('never closed');
  await expect(alert).not.toContainText('Invalid regular expression');
  await expect(stored(page)).toHaveText('[abc');
});

test('IMP-5: switching back from advanced keeps what can be read as words', async ({ page }) => {
  await mode(page).selectOption('advanced');
  await opening(page).getByLabel('Regular expression').fill('^closing');
  await mode(page).selectOption('contains');
  await expect(opening(page).getByLabel('Text to look for')).toHaveValue('closing');
  await expect(stored(page)).toHaveText('closing');
});

test('IMP-5: touch targets and layout on the phone', async ({ page }, info) => {
  await page.getByLabel('Sample statement').setInputFiles(SAMPLE);
  await mode(page).selectOption('anyOf');
  await opening(page).getByLabel('Add a word').fill('opening');
  await opening(page).getByRole('button', { name: 'Add', exact: true }).click();
  await expectNoHorizontalOverflow(page);
  if (info.project.name === 'mobile') await expectTapTargets(page);
});
