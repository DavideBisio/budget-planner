import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTapTargets, openStep } from './helpers.js';

const SAMPLE_CONFIG = 'data/sample-config.json';
const JAN = 'tests/fixtures/comma-split.csv';
const FEB = 'tests/fixtures/missing-balance.csv';

const card = page => page.locator('#result-settings');
const load = page => page.getByLabel('Statement files').setInputFiles(JAN);
const notice = page => card(page).getByRole('status');

test('IMP-13: the configuration exports as a versioned file without any transactions', async ({
  page,
}) => {
  await page.goto('/import.html');
  await page.getByRole('tab', { name: /^Import/ }).click();
  await page.getByLabel('Statement files').setInputFiles(JAN);
  const download = page.waitForEvent('download');
  await openStep(page, 'Output');
  await page.getByRole('button', { name: 'Download settings (JSON)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('budget-planner-settings.json');
  const text = readFileSync(await file.path(), 'utf8');
  const config = JSON.parse(text);
  expect(Object.keys(config).sort()).toEqual([
    'cats',
    'filter',
    'parse',
    'payees',
    'rules',
    'version',
  ]);
  expect(config.version).toBe(1);
  expect(text).not.toContain('Payroll');
  expect(text).not.toContain('Landlord');
});

test('IMP-13: importing the sample configuration works', async ({ page }) => {
  await page.goto('/import.html');
  await load(page);
  await card(page).getByLabel('Load settings from a file').setInputFiles(SAMPLE_CONFIG);
  await expect(notice(page)).toContainText('Settings imported');
  await openStep(page, 'Parsing');
  await expect(page.getByLabel('Delimiter')).toHaveValue(',');
});

test('IMP-13: an imported file replaces the settings and shows up in the steps', async ({
  page,
}) => {
  await page.goto('/import.html');
  await load(page);
  const config = JSON.parse(readFileSync(SAMPLE_CONFIG, 'utf8'));
  config.parse.delim = ';';
  config.cats.push('Hobbies');
  await card(page)
    .getByLabel('Load settings from a file')
    .setInputFiles({
      name: 'mine.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(config)),
    });
  await expect(notice(page)).toContainText('Settings imported');
  await openStep(page, 'Parsing');
  await expect(page.getByLabel('Delimiter')).toHaveValue(';');
});

test('IMP-13: problems are listed by field path and nothing changes', async ({ page }) => {
  await page.goto('/import.html');
  await load(page);
  const config = JSON.parse(readFileSync(SAMPLE_CONFIG, 'utf8'));
  config.payees = ['(open'];
  config.parse.delim = 'x';
  await card(page)
    .getByLabel('Load settings from a file')
    .setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(config)),
    });
  const problems = card(page).getByRole('alert');
  await expect(problems).toContainText('parse.delim');
  await expect(problems).toContainText('payees[0]');
  await expect(problems).not.toContainText('Invalid regular expression');
  await openStep(page, 'Parsing');
  await expect(page.getByLabel('Delimiter')).toHaveValue(',');
});

test('IMP-13: a file that is not JSON is refused with a plain message', async ({ page }) => {
  await page.goto('/import.html');
  await card(page)
    .getByLabel('Load settings from a file')
    .setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    });
  await expect(card(page).getByRole('alert')).toContainText('not valid JSON');
});

test('IMP-14: settings persist between visits', async ({ page }) => {
  await page.goto('/import.html');
  await load(page);
  await openStep(page, 'Parsing');
  await page.getByLabel('Delimiter').selectOption(';');
  await page.getByLabel('Description column').fill('Descrizione');
  await page.reload();
  await openStep(page, 'Parsing');
  await expect(page.getByLabel('Delimiter')).toHaveValue(';');
  await expect(page.getByLabel('Description column')).toHaveValue('Descrizione');
});

test('IMP-14: settings and manual changes persist in their own keys', async ({ page }) => {
  await page.goto('/import.html');
  await load(page);
  await openStep(page, 'Parsing');
  await page.getByLabel('Delimiter').selectOption(';');
  const config = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('budget-planner:config')),
  );
  expect(config.version).toBe(1);
  expect(config.data.parse.delim).toBe(';');

  await page.getByLabel('Delimiter').selectOption(',');
  await openStep(page, 'Import');
  await page.getByLabel('Statement files').setInputFiles(FEB);
  await openStep(page, 'Output');
  const row = page.locator('#result-result .result-item', { hasText: 'Sample Landlord' });
  await row.getByRole('button', { name: 'Change Sample Landlord' }).click();
  await row.getByLabel('Kind').selectOption('saving');
  const overrides = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('budget-planner:overrides')),
  );
  expect(overrides.version).toBe(1);
  expect(Object.keys(overrides.data.payees)).toHaveLength(1);
});

test('IMP-14: settings from a newer version are left untouched and the user is told', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('budget-planner:config')) {
      localStorage.setItem(
        'budget-planner:config',
        JSON.stringify({ version: 9, data: { future: true } }),
      );
    }
  });
  await page.goto('/import.html');
  await expect(notice(page)).toContainText('newer version');
  await load(page);
  await openStep(page, 'Parsing');
  await page.getByLabel('Delimiter').selectOption(';');
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('budget-planner:config')),
  );
  expect(stored).toEqual({ version: 9, data: { future: true } });
});

test('IMP-14: unreadable stored settings fall back to the defaults with a notice', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('budget-planner:config', '{ broken');
    }
  });
  await page.goto('/import.html');
  await expect(notice(page)).toContainText('could not be read');
  await load(page);
  await openStep(page, 'Parsing');
  await expect(page.getByLabel('Delimiter')).toHaveValue(',');
});

test('layout holds with the settings card', async ({ page }, info) => {
  await page.goto('/import.html');
  await expectNoHorizontalOverflow(page);
  if (info.project.name === 'mobile') await expectTapTargets(page);
});
