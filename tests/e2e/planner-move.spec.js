import { expect, test } from '@playwright/test';
import { PLAN, openPlanner, storedPlan } from './planner-helpers.js';

const card = (page, name) => page.getByRole('article', { name });
const summary = page => page.getByRole('region', { name: 'Balance summary' });

test('PLAN-7: "Move to" moves an entry to another card (touch and keyboard path)', async ({
  page,
}) => {
  await openPlanner(page, PLAN);
  await expect(summary(page)).toContainText('Cash after 12 months: 23560.00');
  const move = card(page, 'Every month').getByLabel('Move Sample Landlord to');
  await move.selectOption({ label: 'Holiday (one-time, Mar 26)' });
  await expect(
    card(page, 'Holiday').getByRole('listitem').filter({ hasText: 'Sample Landlord' }),
  ).toBeVisible();
  await expect(card(page, 'Every month').getByLabel('Move Piggy bank to')).toBeVisible();
  await expect(card(page, 'Every month').getByLabel('Move Sample Landlord to')).toHaveCount(0);
  // rent once instead of twelve times: 12 x 2400 - 420 - 200
  await expect(summary(page)).toContainText('Cash after 12 months: 28180.00');
  await expect(page.getByRole('status').filter({ hasText: 'Moved Sample Landlord' })).toContainText(
    'Holiday',
  );
  await expect(card(page, 'Holiday').getByLabel('Move Sample Landlord to')).toBeFocused();
  const stored = await storedPlan(page);
  expect(stored.cards[1].entries.map(e => e.id)).toEqual(['entry-3', 'entry-1']);
});

test('PLAN-7: the Move to menu lists the other cards only', async ({ page }) => {
  await openPlanner(page, PLAN);
  const options = card(page, 'Every month').getByLabel('Move Piggy bank to').getByRole('option');
  await expect(options).toHaveText(['Move to…', 'Holiday (one-time, Mar 26)']);
});

test('PLAN-7: an entry can be dragged onto another card with the pointer', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'pointer drag is the desktop path');
  await openPlanner(page, PLAN);
  await page.setViewportSize({ width: 1440, height: 2600 }); // both cards in view while dragging
  const entry = card(page, 'Every month').getByRole('listitem').filter({ hasText: 'Piggy bank' });
  await entry.locator('.drag-handle').dragTo(card(page, 'Holiday'));
  await expect(card(page, 'Holiday').getByLabel('Move Piggy bank to')).toBeVisible();
  const stored = await storedPlan(page);
  expect(stored.cards[1].entries.map(e => e.id)).toContain('entry-2');
});

test('PLAN-7: dropping an entry on its own card changes nothing', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'pointer drag is the desktop path');
  await openPlanner(page, PLAN);
  await page.setViewportSize({ width: 1440, height: 2600 });
  const before = JSON.stringify((await storedPlan(page)) ?? PLAN);
  const entry = card(page, 'Every month').getByRole('listitem').filter({ hasText: 'Piggy bank' });
  await entry.locator('.drag-handle').dragTo(card(page, 'Every month'));
  await expect(card(page, 'Every month').getByLabel('Move Piggy bank to')).toBeVisible();
  const after = await storedPlan(page);
  expect(after === undefined || JSON.stringify(after) === before).toBe(true);
});
