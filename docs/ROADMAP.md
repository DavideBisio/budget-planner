# Roadmap

Milestones are mirrored on GitHub. What must be true is in [req/](req/), how it is built is in [spec/](spec/);
see [README.md](README.md) for how they fit together.

| #   | Milestone                   | Outcome                                                                                      | Main requirements |
| --- | --------------------------- | -------------------------------------------------------------------------------------------- | ----------------- |
| M0  | Foundation                  | App scaffold (Vite), architecture record, responsive shell, test harness, repo hygiene       | GEN, PRIV         |
| M1  | Core engine                 | Pure, tested logic: config, parsing, filtering, payees, matching, recurring detection, cards | ENG               |
| M2  | Import workflow             | Guided import page with the friendly pattern input                                           | IMP               |
| M3  | Planner                     | Planner page: salary, cumulative chart, cards, savings (incl. withdrawals), drag and drop    | PLAN              |
| M4  | Integration and persistence | Send to planner, storage and migrations, backup                                              | STOR              |
| M5  | Polish and release          | Accessibility, performance, locale, docs, offline single-file build, first release           | GEN               |

## Where to start

The goal of the first release is one end-to-end path: **import a bank CSV, apply rules, send the result to the
planner as cards, and see the cumulative balance**. Work milestones in order; inside a milestone follow the
order below (issue numbers). Items on the same line can run in parallel.

1. **M0 Foundation**: #5 scaffold, then #6 architecture record, then #7 shell, #8 e2e harness, #9 test conventions.
   Housekeeping any time: #10, #12; #11 once the setup PR is merged.
2. **M1 Core engine** (tests first, no UI): #13 config, then #14 parser, then #16 filters, then #17 payees,
   then #18 matching, then #19 recurring, then #20 overrides, then #21 cards. #15 reconciliation can run beside #14.
3. **M2 Import workflow**: #22 stepper, then #23 parsing step, #24 file import, #25 regex input,
   then #26 to #29 rule steps, then #30 result table, then #31 output preview, #32 config import/export.
4. **M3 Planner**: #33 model, then #34 layout, #35 cards, #37 chart, then #36 drag and drop, #38 withdrawals.
5. **M4 Integration**: #39 storage, then #40 handoff, then #41 backup.
6. **M5 Polish and release**: #43 to #48 in any order, #48 last.

Next step today: **#5, scaffold the app with Vite**.
