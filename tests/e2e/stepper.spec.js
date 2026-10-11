import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTapTargets } from './helpers.js';

const TITLES = [
  'Parsing',
  'Import',
  'Filtering',
  'Payee extraction',
  'Matching rules',
  'Categories',
  'Output',
];

const stepHeader = (page, title) => page.getByRole('button', { name: new RegExp(`^${title}`) });

test.beforeEach(async ({ page }) => {
  await page.goto('/import.html');
});

test('IMP-1: seven numbered steps in the required DOM order', async ({ page }) => {
  const steps = page.locator('ol.steps > li');
  await expect(steps).toHaveCount(7);
  const titles = await page.locator('ol.steps > li .step-title').allTextContents();
  expect(titles).toEqual(TITLES);
  const numbers = await page.locator('ol.steps .step-number').allTextContents();
  expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '7']);
});

test('IMP-2: every step shows a purpose line and a status badge', async ({ page }) => {
  await expect(page.locator('ol.steps .step-purpose')).toHaveCount(7);
  await expect(page.locator('ol.steps .badge')).toHaveCount(7);
  await expect(stepHeader(page, 'Parsing').locator('.badge')).toHaveText('Ready');
  await expect(stepHeader(page, 'Import').locator('.badge')).toHaveText('To do');
});

test('IMP-2: later steps are disabled and explain what they wait for', async ({ page }) => {
  for (const title of TITLES.slice(2)) {
    const header = stepHeader(page, title);
    await expect(header).toBeDisabled();
    await expect(header.locator('.badge')).toHaveText('Waiting');
    await expect(header.locator('.step-reason')).toContainText('step 2');
  }
  await expect(stepHeader(page, 'Import')).toBeEnabled();
});

test('the first open step is parsing; headers collapse and expand their body', async ({ page }) => {
  const parsing = stepHeader(page, 'Parsing');
  const importStep = stepHeader(page, 'Import');
  await expect(parsing).toHaveAttribute('aria-expanded', 'true');
  await expect(importStep).toHaveAttribute('aria-expanded', 'false');
  await importStep.click();
  await expect(importStep).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#step-body-import')).toBeVisible();
  await parsing.click();
  await expect(parsing).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#step-body-parsing')).toBeHidden();
});

test('progress counts the steps that are ready', async ({ page }) => {
  const progress = page.getByRole('progressbar', { name: 'Steps ready' });
  await expect(progress).toHaveAttribute('value', '1');
  await expect(page.locator('.progress-label')).toHaveText('1 of 7 steps ready');
});

test('the progress bar stays visible while scrolling on a phone', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'sticky progress is a phone feature');
  await page.evaluate(() => {
    document.querySelector('main').style.minHeight = '4000px';
    window.scrollTo(0, 1500);
  });
  await expect(page.locator('.progress')).toBeInViewport();
});

test('settings left and live result right on large screens, one column on phones', async ({
  page,
}, info) => {
  const steps = await page.locator('ol.steps').boundingBox();
  const result = await page.locator('#result-empty').boundingBox();
  if (info.project.name === 'desktop') {
    expect(result.x).toBeGreaterThan(steps.x + steps.width - 1);
    expect(Math.abs(result.y - steps.y)).toBeLessThan(80);
  } else {
    expect(result.y).toBeGreaterThan(steps.y + steps.height - 1);
  }
});

test('no horizontal overflow and 44 px targets on the phone', async ({ page }, info) => {
  await expectNoHorizontalOverflow(page);
  if (info.project.name === 'mobile') await expectTapTargets(page);
});
