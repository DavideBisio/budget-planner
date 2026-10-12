import { expect } from '@playwright/test';

// Mirrors the breakpoint in src/ui/styles/layout.css (CSS cannot share it with a media query).
export const BREAKPOINT = 1100;
export const MIN_TAP = 44;

export const PAGES = ['/index.html', '/import.html'];

const INTERACTIVE =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"]';

/** GEN-1: the page never scrolls sideways. */
export async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
}

/** GEN-1: every visible interactive element is at least 44 x 44 px. Returns nothing; fails with a list. */
export async function expectTapTargets(page, min = MIN_TAP) {
  const tooSmall = await page.evaluate(
    ({ selector, min }) =>
      [...document.querySelectorAll(selector)]
        .map(el => ({ el, box: el.getBoundingClientRect() }))
        .filter(
          ({ el, box }) =>
            box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden',
        )
        .filter(({ box }) => box.width < min || box.height < min)
        .map(
          ({ el, box }) =>
            `${el.tagName.toLowerCase()} "${(el.textContent || el.id || '').trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`,
        ),
    { selector: INTERACTIVE, min },
  );
  expect(tooSmall, 'interactive elements under the minimum size').toEqual([]);
}

/** GEN-2: number of grid columns of the first `.columns` container on the page. */
export async function countColumns(page) {
  return page.evaluate(() => {
    const grid = document.querySelector('.columns');
    return getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  });
}

export async function expectColumns(page, expected) {
  expect(await countColumns(page)).toBe(expected);
}

/** Open a step by its tab. */
export const openStep = (page, title) =>
  page.getByRole('tab', { name: new RegExp(`^${title}`) }).click();

/** Load statement files in the first step, then open the parsing step. */
export async function openParsing(page, files = 'data/sample-bank-report.csv') {
  await page.goto('/import.html');
  await page.getByLabel('Statement files').setInputFiles(files);
  await openStep(page, 'Parsing');
}
