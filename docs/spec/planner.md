# Specification: planner page

Requirements: [req/planner.md](../req/planner.md).

## Model (PLAN-1, 2, 4, 5, 6)

- Pure functions in `src/core/planner.js`: salary per month, recurring cards applied to every month, one-time cards applied to their month, cumulative cash balance, cumulative savings.
- State (schema version 1): `{salaryCents, start, horizon, cards}`. `start` is the first month shown (YYYY-MM) and `horizon` how many months (default 12). A card is a container: `{id, type: recurring | one-time, title, month, entries}`. An entry is `{id, label, category, kind: income | expense | saving, amountCents, source: imported | manual}`. Entry amounts are what the user sees: income and expenses positive, a saving positive when put aside and negative for a withdrawal.
- `project(state)` returns one row per month (`salary, income, expenses, saving, net, cash, savings`), totals, and `outside`: the one-time cards whose month is not shown, so the UI can say so instead of dropping them silently.
- Cash changes by `salary + income - expenses - saving` each month; savings change by the saving amount.
- Saving subtracts from cash and adds to savings. A negative saving is a withdrawal: cash goes up, savings go down. The model does not clamp.
- `project` also returns `warnings.savingsBelowZero` (`{month, lowest}` or null): the first month the savings are negative and the lowest value reached. The UI shows "Savings go below zero from Mar 26 (lowest -200.00)" in the summary and above the chart, as text with a symbol.
- A saving entry shows a hint that a negative amount is a withdrawal. Imported incoming transactions of kind saving already arrive as negative savings (ENG-9, `buildCards`), so the handoff needs no conversion.
- Issues: #33, #38.

## Layout (GEN-1, GEN-2 applied)

- Large screens: inputs and cards left, chart and totals right. Phones: single column with a sticky balance summary (cash and savings at the end of the shown months); from 1100 px the summary is static because the chart is in view.
- Inputs: monthly salary (text, parsed by `parseCents`; an invalid value is explained and not used), first month (defaults to the current month) and months shown (6, 12, 24 or 36). Every change is saved under `budget-planner:planner`.
- The store is shared with the import page (`src/ui/store.js`); planner modules live in `src/ui/planner/`.
- Issue: #34.

## Cards (PLAN-3, 8, 9)

- Buttons "+ recurring card" and "+ one-time card" add an empty card (a one-time card starts at the first month shown). A card has a title, and a month if it is one-time; entries have a label, category, kind (income, expense, saving) and amount. Adding focuses the new field; deleting a card that has entries asks first.
- Editing happens in place and is saved on every change. The list is rebuilt only when cards or entries are added, removed or moved, so typing never loses focus.
- Badges: the card shows its kind (Recurring or One-time) and its source (Imported when all entries came from the import page, Manual when none did, otherwise Mixed); each entry shows Imported or Manual. Each entry has an info button (tap, click, hover or focus) with its kind, category, amount, when it applies and its source, using the shared popover.
- The amount accepts a negative value only for a saving (a withdrawal, PLAN-6); for any other kind it is explained and the edit is not applied. An amount that is not a number is explained and not applied.
- A header button "Import bank CSV" opens the import page.
- Issue: #35.

## Moving entries (PLAN-7)

- `moveEntry(state, entryId, toCardId)` puts an entry at the end of another card and keeps its id and source.
- Pointer drag and drop on desktop: each entry has a drag handle (hidden on touch screens); dropping on a card moves the entry there, and the card is outlined while it is a target.
- Every entry also has a "Move <entry> to" menu listing the other cards. It is the path for phones and the keyboard. After a move the status line says what moved where, and focus goes to the entry's menu in its new card.
- Issue: #36.

## Chart (PLAN-4, 5)

- `src/core/chart.js` computes the geometry (nice scale that always includes zero, tick labels, evenly spaced months, month labels thinned to at least 48 px apart); `src/ui/planner/chart.js` draws it as an SVG at its real pixel size (the viewBox equals the rendered width, so text stays 11 px or more at 375 px) and redraws when the container is resized.
- Cash is a solid line and savings a dashed one, so the two differ without colour. A withdrawal makes the savings line go down; negative values stay inside the plot.
- No hover is needed: the legend writes the end values, the SVG has an accessible name with the range and end values, and a "Show data table" section lists month, cash change, cash balance and savings.
- Issue: #37.
