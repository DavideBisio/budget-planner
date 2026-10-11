// Fictional planner states for the e2e tests, stored the way the app stores them.
export const entry = (id, label, kind, amountCents, source = 'manual', category = 'Sample') => ({
  id,
  label,
  category,
  kind,
  amountCents,
  source,
});

export const PLAN = {
  salaryCents: 250000,
  start: '2026-01',
  horizon: 12,
  cards: [
    {
      id: 'card-1',
      type: 'recurring',
      title: 'Every month',
      month: null,
      entries: [
        entry('entry-1', 'Sample Landlord', 'expense', 42000, 'imported', 'Housing'),
        entry('entry-2', 'Piggy bank', 'saving', 10000),
      ],
    },
    {
      id: 'card-2',
      type: 'one-time',
      title: 'Holiday',
      month: '2026-03',
      entries: [entry('entry-3', 'Demo Trip', 'expense', 20000, 'imported', 'Travel')],
    },
  ],
};

/** Open the planner with the given state already stored (null: nothing stored). */
export async function openPlanner(page, plan = null) {
  await page.goto('/index.html');
  await page.evaluate(plan => {
    localStorage.clear();
    if (plan)
      localStorage.setItem('budget-planner:planner', JSON.stringify({ version: 1, data: plan }));
  }, plan);
  await page.reload();
}

export const storedPlan = page =>
  page.evaluate(() => JSON.parse(localStorage.getItem('budget-planner:planner'))?.data);
