import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTapTargets } from './helpers.js';

const JAN = 'tests/fixtures/comma-split.csv';
const FEB = 'tests/fixtures/missing-balance.csv';

const card = page => page.locator('#result-categories');
const rows = page => page.locator('#step-body-categories .category-row');
const row = (page, name) =>
  page.locator(`#step-body-categories .category-row[data-category="${name}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto('/import.html');
  await page.getByRole('tab', { name: /^Import/ }).click();
  await page.getByLabel('Statement files').setInputFiles([JAN, FEB]);
  await page.getByRole('tab', { name: /^Categories/ }).click();
});

test('IMP-9: lists the categories with the rules that use them', async ({ page }) => {
  await expect(rows(page)).toHaveCount(8);
  await expect(row(page, 'Salary')).toContainText('Used by 1 rule');
  await expect(row(page, 'Own transfers')).toContainText('Not used by any rule');
  const fallback = row(page, 'Other income');
  await expect(fallback).toContainText('unmatched');
  await expect(fallback.getByRole('button', { name: 'Delete Other income' })).toBeDisabled();
  await expect(fallback.getByLabel('Name of Other income')).toHaveAttribute('readonly', '');
});

test('IMP-9: a category can be added; a duplicate is refused with a message', async ({ page }) => {
  const name = page.getByLabel('New category');
  await name.fill('Hobbies');
  await name.press('Enter');
  await expect(rows(page)).toHaveCount(9);
  await expect(row(page, 'Hobbies')).toBeVisible();

  await name.fill('housing');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByRole('alert')).toContainText('already exists');
  await expect(rows(page)).toHaveCount(9);
});

test('IMP-9: renaming a category updates the rules that use it', async ({ page }) => {
  const input = page.getByLabel('Name of Housing');
  await input.fill('Home');
  await input.press('Enter');
  await expect(row(page, 'Home')).toContainText('Used by 1 rule');
  await page.getByRole('tab', { name: /^Categories/ }).click();
  await expect(
    page
      .getByRole('group', { name: 'Matching rules', exact: true })
      .locator('.pattern-item')
      .nth(1)
      .getByLabel('Category'),
  ).toHaveValue('Home');
  await expect(page.getByRole('tab', { name: /^Categories/ }).locator('.badge')).toHaveText(
    'Ready',
  );
});

test('IMP-9: a rename to an existing name is refused and the name goes back', async ({ page }) => {
  const input = page.getByLabel('Name of Housing');
  await input.fill('Utilities');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('already exists');
  await expect(page.getByLabel('Name of Housing')).toHaveValue('Housing');
});

test('IMP-9: an unused category is deleted at once', async ({ page }) => {
  await page.getByRole('button', { name: 'Delete Own transfers' }).click();
  await expect(rows(page)).toHaveCount(7);
});

test('IMP-9: deleting a category in use asks where its rules go', async ({ page }) => {
  await page.getByRole('button', { name: 'Delete Housing' }).click();
  const confirm = page.getByRole('group', { name: 'Delete Housing' });
  await expect(confirm).toContainText('used by 1 rule');
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(rows(page)).toHaveCount(8);

  await page.getByRole('button', { name: 'Delete Housing' }).click();
  await confirm.getByLabel('Move the rules to').selectOption('Utilities');
  await confirm.getByRole('button', { name: 'Move rules and delete' }).click();
  await expect(rows(page)).toHaveCount(7);
  await expect(row(page, 'Utilities')).toContainText('Used by 2 rules');
});

test('IMP-9: the result lists transactions and totals per category', async ({ page }) => {
  const housing = card(page).getByRole('row', { name: /Housing/ });
  await expect(housing).toContainText('2');
  await expect(housing).toContainText('-840.00');
  await expect(card(page).getByRole('row', { name: /Salary/ })).toContainText('3000.00');
  await expect(card(page).getByRole('row', { name: /Other expenses/ })).toContainText('-19.90');
});

test('layout holds with the categories step open', async ({ page }, info) => {
  await expectNoHorizontalOverflow(page);
  if (info.project.name === 'mobile') await expectTapTargets(page);
});
