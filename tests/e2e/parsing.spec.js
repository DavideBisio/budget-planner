import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTapTargets, openParsing } from './helpers.js';

const FIXTURE = 'tests/fixtures/semicolon-decimal-comma.csv';

const parsingBadge = page => page.getByRole('tab', { name: /^Parsing/ }).locator('.badge');
const opening = page => page.getByRole('group', { name: 'Opening balance row' });
const preview = page => page.locator('#result-parsing');

test('IMP-3: parsing waits for a file and the other steps wait for parsing', async ({ page }) => {
  await page.goto('/import.html');
  await expect(page.getByRole('tab', { name: /^Parsing/ })).toBeDisabled();
});

test('IMP-3: shows the current format and column settings', async ({ page }) => {
  await openParsing(page);
  await expect(page.getByLabel('Delimiter')).toHaveValue(',');
  await expect(page.getByLabel('Decimal separator')).toHaveValue('.');
  await expect(page.getByLabel('Date format')).toHaveValue('ymd');
  await expect(page.getByLabel('Booking date column')).toHaveValue('Booking date');
  await expect(opening(page).getByLabel('Text to look for')).toHaveValue('opening balance');
  await expect(preview(page)).toBeVisible();
});

test('IMP-3: the first imported file previews with the default settings', async ({ page }) => {
  await openParsing(page);
  await expect(preview(page)).toBeVisible();
  await expect(preview(page)).toContainText('16 transactions read');
  await expect(preview(page).getByRole('row')).toHaveCount(1 + 8);
  await expect(preview(page)).toContainText('Opening balance');
  await expect(page.getByText('Your settings already match.')).toBeVisible();
});

test('IMP-3: suggestions are offered, not applied, until the user applies them', async ({
  page,
}) => {
  await openParsing(page, FIXTURE);
  await expect(page.getByText('Delimiter: semicolon (;)')).toBeVisible();
  await expect(page.getByText('Decimal separator: comma (,)')).toBeVisible();
  // The fixture's dates are all valid day-first and month-first, so no format is suggested
  await expect(page.getByText(/Date format could not be told/)).toBeVisible();

  // Nothing changed yet, and the preview explains the problem in plain language
  await expect(page.getByLabel('Delimiter')).toHaveValue(',');
  await expect(preview(page).getByRole('alert')).toContainText('not found in the header');

  await page.getByRole('button', { name: 'Apply suggestions' }).click();
  await expect(page.getByLabel('Delimiter')).toHaveValue(';');
  await expect(page.getByLabel('Decimal separator')).toHaveValue(',');
  await expect(page.getByLabel('Date format')).toHaveValue('ymd');
  await expect(page.getByLabel('Booking date column')).toHaveValue('Registrazione');
  await page.getByLabel('Date format').selectOption('dmy');
  await expect(preview(page)).toContainText('3 transactions read');
  await expect(preview(page).getByRole('cell', { name: '-19.90' })).toBeVisible();
  await expect(preview(page).getByRole('cell', { name: '2026-01-04' })).toBeVisible();
});

test('IMP-2, IMP-3: an invalid setting is explained and changes the step status', async ({
  page,
}) => {
  await openParsing(page);
  await expect(parsingBadge(page)).toHaveText('Ready');
  await opening(page).getByLabel('Match when the text').selectOption('advanced');
  await opening(page).getByLabel('Regular expression').fill('(');
  await expect(opening(page).getByRole('alert')).toContainText('never closed');
  await expect(parsingBadge(page)).toHaveText('Needs attention');
  await expect(preview(page)).toContainText('Fix the settings');
  await expect(
    page.getByRole('tab', { name: /^Categories/ }).locator('.step-reason'),
  ).toContainText('step 2');
  await opening(page).getByLabel('Regular expression').fill('^opening balance');
  await expect(parsingBadge(page)).toHaveText('Ready');
  await expect(preview(page)).toContainText('16 transactions read');
});

test('layout holds with a preview: no sideways scroll, 44 px targets on the phone', async ({
  page,
}, info) => {
  await openParsing(page);
  await expect(preview(page)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  if (info.project.name === 'mobile') await expectTapTargets(page);
});
