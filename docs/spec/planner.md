# Specification: planner page

Requirements: [req/planner.md](../req/planner.md).

## Model (PLAN-1, 2, 4, 5, 6)

- Pure functions in `src/core/planner`: salary per month, recurring cards applied to every month, one-time cards applied to their month, cumulative cash balance, cumulative savings.
- Saving subtracts from cash and adds to savings. A negative saving is a withdrawal: cash goes up, savings go down. The model does not clamp; the UI warns when savings drop below zero.
- Issues: #33, #38.

## Layout (GEN-1, GEN-2 applied)

- Large screens: inputs and cards left, chart and totals right. Phones: single column with a sticky balance summary.
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
