import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PLAN, openPlanner, storedPlan } from './planner-helpers.js';

const FILES = [{ name: 'january', text: 'fictional raw text' }];

const seed = page =>
  page.evaluate(files => {
    localStorage.setItem('budget-planner:files', JSON.stringify({ version: 1, data: files }));
    localStorage.setItem(
      'budget-planner:overrides',
      JSON.stringify({ version: 1, data: { transactions: {}, payees: {} } }),
    );
  }, FILES);

async function download(page, includeFiles = false) {
  if (includeFiles) await page.getByLabel('Include the imported bank files').check();
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const file = await waiting;
  expect(file.suggestedFilename()).toBe('budget-planner-backup.json');
  return { path: await file.path(), json: JSON.parse(readFileSync(await file.path(), 'utf8')) };
}

test('STOR-4: the backup is one versioned file with the plan and the settings', async ({
  page,
}) => {
  await openPlanner(page, PLAN);
  await seed(page);
  await page.reload();
  const { json } = await download(page);
  expect(json).toMatchObject({ app: 'budget-planner', version: 1 });
  expect(json.data.planner).toEqual(PLAN);
  expect(Object.keys(json.data).sort()).toEqual(['overrides', 'planner']);
});

test('STOR-4: raw bank files are left out unless the person includes them', async ({ page }) => {
  await openPlanner(page, PLAN);
  await seed(page);
  await page.reload();
  const without = await download(page);
  expect(JSON.stringify(without.json)).not.toContain('fictional raw text');
  const withFiles = await download(page, true);
  expect(withFiles.json.data.files).toEqual(FILES);
});

test('STOR-4: a backup restores the plan on an empty browser', async ({ page }) => {
  await openPlanner(page, PLAN);
  const { path } = await download(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByLabel('Monthly salary')).toHaveValue('0.00');

  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('Restore from a backup file').setInputFiles(path);
  await expect(page.getByLabel('Monthly salary')).toHaveValue('2500.00');
  await expect(page.getByRole('article', { name: 'Holiday' })).toBeVisible();
  expect(await storedPlan(page)).toEqual(PLAN);
});

test('STOR-4: restoring asks first, and cancelling changes nothing', async ({ page }) => {
  await openPlanner(page, PLAN);
  const { path } = await download(page);
  await page.getByLabel('Monthly salary').fill('1');
  page.once('dialog', dialog => {
    expect(dialog.message()).toContain('replace');
    return dialog.dismiss();
  });
  await page.getByLabel('Restore from a backup file').setInputFiles(path);
  await expect(page.getByLabel('Monthly salary')).toHaveValue('1');
  expect((await storedPlan(page)).salaryCents).toBe(100);
});

test('STOR-4: files in the backup are restored, and absent files leave the current ones', async ({
  page,
}) => {
  await openPlanner(page, PLAN);
  await seed(page);
  await page.reload();
  const without = await download(page);
  await page.evaluate(() =>
    localStorage.setItem(
      'budget-planner:files',
      JSON.stringify({ version: 1, data: [{ name: 'other', text: 'x' }] }),
    ),
  );
  page.once('dialog', dialog => dialog.accept());
  await Promise.all([
    page.waitForEvent('load'),
    page.getByLabel('Restore from a backup file').setInputFiles(without.path),
  ]);
  const kept = await page.evaluate(() => localStorage.getItem('budget-planner:files'));
  expect(JSON.parse(kept).data[0].name).toBe('other');
});

test('STOR-4: an invalid backup is refused as a whole, with the problems listed', async ({
  page,
}, info) => {
  await openPlanner(page, PLAN);
  const { json } = await download(page);
  json.data.planner.start = 'soon';
  json.data.overrides = [];
  const bad = info.outputPath('bad-backup.json');
  writeFileSync(bad, JSON.stringify(json));
  await page.getByLabel('Monthly salary').fill('1');
  let asked = false;
  page.on('dialog', dialog => {
    asked = true;
    return dialog.accept();
  });
  await page.getByLabel('Restore from a backup file').setInputFiles(bad);
  const problems = page.getByRole('alert').filter({ hasText: 'nothing was changed' });
  await expect(problems).toBeVisible();
  await expect(problems).toContainText('planner.start');
  await expect(problems).toContainText('overrides');
  expect(asked).toBe(false);
  expect((await storedPlan(page)).salaryCents).toBe(100);
});

test('STOR-4: a file that is not a backup is refused', async ({ page }, info) => {
  await openPlanner(page, PLAN);
  const other = info.outputPath('other.json');
  writeFileSync(other, JSON.stringify({ hello: 'world' }));
  await page.getByLabel('Restore from a backup file').setInputFiles(other);
  await expect(
    page.getByRole('alert').filter({ hasText: 'not a Budget Planner backup' }),
  ).toBeVisible();
  expect(await storedPlan(page)).toEqual(PLAN);
});

test('STOR-4: the backup controls are on the import page too', async ({ page }) => {
  await page.goto('/import.html');
  await expect(page.getByRole('button', { name: 'Download backup' })).toBeVisible();
  await expect(page.getByLabel('Restore from a backup file')).toBeAttached();
});
