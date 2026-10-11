# Specification: planner page

Requirements: [req/planner.md](../req/planner.md).

## Model (PLAN-1, 2, 4, 5, 6)

- Pure functions in `src/core/planner.js`: salary per month, recurring cards applied to every month, one-time cards applied to their month, cumulative cash balance, cumulative savings.
- State (schema version 1): `{salaryCents, start, horizon, cards}`. `start` is the first month shown (YYYY-MM) and `horizon` how many months (default 12). A card is a container: `{id, type: recurring | one-time, title, month, entries}`. An entry is `{id, label, category, kind: income | expense | saving, amountCents, source: imported | manual}`. Entry amounts are what the user sees: income and expenses positive, a saving positive when put aside and negative for a withdrawal.
- `project(state)` returns one row per month (`salary, income, expenses, saving, net, cash, savings`), totals, and `outside`: the one-time cards whose month is not shown, so the UI can say so instead of dropping them silently.
- Cash changes by `salary + income - expenses - saving` each month; savings change by the saving amount.
- Saving subtracts from cash and adds to savings. A negative saving is a withdrawal: cash goes up, savings go down. The model does not clamp; the UI warns when savings drop below zero.
- Issues: #33, #38.

## Layout (GEN-1, GEN-2 applied)

- Large screens: inputs and cards left, chart and totals right. Phones: single column with a sticky balance summary (cash and savings at the end of the shown months); from 1100 px the summary is static because the chart is in view.
- Inputs: monthly salary (text, parsed by `parseCents`; an invalid value is explained and not used), first month (defaults to the current month) and months shown (6, 12, 24 or 36). Every change is saved under `budget-planner:planner`.
- The store is shared with the import page (`src/ui/store.js`); planner modules live in `src/ui/planner/`.
- Issue: #34.

## Cards (PLAN-3, 8, 9)

- Buttons "+ recurring card" and "+ one-time card". Badges show kind and source (imported or manual). Tooltips use the shared tap-capable popover. The amount input accepts negative numbers.
- A header button "Import bank CSV" opens the import page.
- Issue: #35.

## Moving entries (PLAN-7)

- Pointer drag and drop on desktop. Every entry also has a "Move to..." menu, which is the path for phones and the keyboard.
- Issue: #36.

## Chart (PLAN-4, 5)

- Responsive SVG or canvas chart of balance and savings per month; values readable without hover; a data table alternative for accessibility.
- Issue: #37.
