import { expect, test } from '@playwright/test';

test('IMP-15: the import page has a "Budget Planner" button that opens the planner', async ({
  page,
}) => {
  await page.goto('/import.html');
  const button = page.getByRole('link', { name: 'Budget Planner' });
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await button.click();
  await expect(page).toHaveURL(/index\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Planner' })).toBeVisible();
});
