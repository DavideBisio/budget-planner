import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTapTargets, openStep } from './helpers.js';

const TITLES = ['Import', 'Parsing', 'Categories', 'Filtering', 'Payees', 'Output'];
const JAN = 'tests/fixtures/comma-split.csv';

const tabOf = (page, title) => page.getByRole('tab', { name: new RegExp(`^${title}`) });

test.beforeEach(async ({ page }) => {
  await page.goto('/import.html');
});

test('IMP-1: six numbered tabs in the required order', async ({ page }) => {
  await expect(page.getByRole('tab')).toHaveCount(6);
  expect(await page.locator('.step-tab .step-title').allTextContents()).toEqual(TITLES);
  expect(await page.locator('.step-tab .step-number').allTextContents()).toEqual([
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
  ]);
});

test('IMP-2: every step shows a purpose line and a status badge', async ({ page }) => {
  await expect(page.locator('.step-tab .badge')).toHaveCount(6);
  await expect(page.locator('.tab-panel .step-purpose')).toHaveCount(6);
  await expect(tabOf(page, 'Import').locator('.badge')).toHaveText('To do');
  await page.getByLabel('Statement files').setInputFiles(JAN);
  await expect(tabOf(page, 'Import').locator('.badge')).toHaveText('Ready');
  await expect(tabOf(page, 'Parsing').locator('.badge')).toHaveText('Ready');
});

test('IMP-2: later steps are disabled and explain what they wait for', async ({ page }) => {
  for (const title of TITLES.slice(1)) {
    const tab = tabOf(page, title);
    await expect(tab).toBeDisabled();
    await expect(tab.locator('.badge')).toHaveText('Waiting');
    await expect(tab.locator('.step-reason')).toContainText('step 1');
  }
  await expect(page.locator('#tabs-note')).toContainText('Waiting for step 1');
  await expect(tabOf(page, 'Import')).toBeEnabled();
  await page.getByLabel('Statement files').setInputFiles(JAN);
  await expect(tabOf(page, 'Parsing')).toBeEnabled();
  await expect(page.locator('#tabs-note')).toBeHidden();
});

test('only the selected tab shows its panel; the tabs follow the arrow keys', async ({ page }) => {
  await page.getByLabel('Statement files').setInputFiles(JAN);
  await expect(tabOf(page, 'Import')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#step-body-import')).toBeVisible();
  await openStep(page, 'Parsing');
  await expect(tabOf(page, 'Parsing')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#step-body-parsing')).toBeVisible();
  await expect(page.locator('#step-body-import')).toBeHidden();
  await page.keyboard.press('ArrowRight');
  await expect(tabOf(page, 'Categories')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tabOf(page, 'Output')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(tabOf(page, 'Import')).toHaveAttribute('aria-selected', 'true');
});

test('the Next button opens the following step', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Next: Parsing' })).toBeDisabled();
  await page.getByLabel('Statement files').setInputFiles(JAN);
  await page.getByRole('button', { name: 'Next: Parsing' }).click();
  await expect(tabOf(page, 'Parsing')).toHaveAttribute('aria-selected', 'true');
});

test('progress starts at zero and advances as steps are done and opened', async ({ page }) => {
  const progress = page.getByRole('progressbar', { name: 'Steps done' });
  await expect(progress).toHaveAttribute('value', '0');
  await expect(page.locator('.progress-label')).toHaveText('0 of 6 steps done');
  await page.getByLabel('Statement files').setInputFiles(JAN);
  await expect(page.locator('.progress-label')).toHaveText('1 of 6 steps done');
  await openStep(page, 'Parsing');
  await expect(page.locator('.progress-label')).toHaveText('2 of 6 steps done');
  await expect(progress).toHaveAttribute('value', '2');
});

test('the progress bar stays visible while scrolling on a phone', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'sticky progress is a phone feature');
  await page.evaluate(() => {
    document.querySelector('main').style.minHeight = '4000px';
    window.scrollTo(0, 1500);
  });
  await expect(page.locator('.progress')).toBeInViewport();
});

test('settings left and results right on large screens, one column on phones', async ({
  page,
}, info) => {
  await page.getByLabel('Statement files').setInputFiles(JAN);
  const left = await page.locator('#step-body-import .stack').first().boundingBox();
  const right = await page.locator('#result-settings').boundingBox();
  if (info.project.name === 'desktop') {
    expect(right.x).toBeGreaterThan(left.x + left.width - 1);
    expect(Math.abs(right.y - left.y)).toBeLessThan(80);
  } else {
    expect(right.y).toBeGreaterThan(left.y + left.height - 1);
  }
});

test('no horizontal overflow and 44 px targets on the phone', async ({ page }, info) => {
  await expectNoHorizontalOverflow(page);
  if (info.project.name === 'mobile') await expectTapTargets(page);
});
