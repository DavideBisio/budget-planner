# Specification: general

Requirements: [req/general.md](../req/general.md). Issue numbers refer to GitHub issues.

## GEN-1 Mobile

- Mobile-first CSS: base styles are the phone layout, wider layouts are added with `min-width` queries.
- Tap target size is a design token (`--tap: 44px`) used by buttons, inputs, list rows and icon buttons.
- Information shown on hover (tooltips) is built on one shared popover component that opens on tap, hover and keyboard focus.
- Issues: #7 (shell and tokens), #8 (e2e harness).
- Verified by: Playwright `mobile` project (Pixel 7): no horizontal overflow, minimum target sizes, on every page.

## GEN-2 Two columns on large screens

- One layout primitive: a CSS grid that is one column by default and two columns from 1100 px.
- The breakpoint is a single documented constant. CSS custom properties cannot be used in media queries, so it is defined once in the shared stylesheet and mirrored in the e2e helper.
- DOM order is left column then right column, so the single-column order is the natural reading order.
- Page assignment: planner has inputs and cards left, chart and totals right; import has the step settings left, live preview or result right.
- Issues: #7, #8, #22 (import), #34 (planner).
- Verified by: Playwright asserts the column count at 375, 768 and 1440 px.

## GEN-3 Offline

- No CDNs, web fonts or external scripts; everything is bundled.
- A Content-Security-Policy meta tag forbids network connections (`connect-src 'none'`).
- A self-contained single-file build is produced for use from `file://`.
- Issues: #45.
- Verified by: e2e fails on any request outside the local origin.

## GEN-4 Light and dark

- Colors are tokens defined once; a `prefers-color-scheme: dark` block redefines them.
- Issue: #7. Verified by: screenshot or computed-style check of both schemes.

## GEN-5 Accessibility

- Native elements first (button, label, details, table); ARIA only where no native element exists.
- Steps and dialogs manage focus; reordering and drag and drop have button alternatives.
- Issue: #43. Verified by: axe checks in e2e and a manual keyboard pass.

## GEN-6 Locale

- Formatting through `Intl.NumberFormat` and `Intl.DateTimeFormat`; currency stored in settings.
- Issue: #46. Verified by: unit tests with several locales.

## GEN-7 Quality gates

- Husky pre-commit: privacy guard, lint-staged, ESLint, Prettier check, unit tests. CI repeats them, adds coverage, build and e2e.
- Done. Files: `.husky/pre-commit`, `.github/workflows/ci.yml`, `package.json` scripts.
- Issues: #12 (HTML and CSS linting), #11 (branch protection).
