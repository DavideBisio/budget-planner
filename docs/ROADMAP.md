# Roadmap

Milestones are mirrored on GitHub. What must be true is in [req/](req/), how it is built is in [spec/](spec/);
see [README.md](README.md) for how they fit together.

| #   | Milestone                   | Outcome                                                                                      | Main requirements |
| --- | --------------------------- | -------------------------------------------------------------------------------------------- | ----------------- |
| M0  | Foundation                  | App scaffold (Vite), architecture record, responsive shell, test harness, repo hygiene       | GEN, PRIV         |
| M1  | Core engine                 | Pure, tested logic: config, parsing, filtering, payees, matching, recurring detection, cards | ENG               |
| M2  | Import workflow             | Guided import page with the friendly pattern input                                           | IMP               |
| M3  | Planner                     | Planner page: salary, cumulative chart, cards, savings (incl. withdrawals), drag and drop    | PLAN              |
| M4  | Integration and persistence | Send to planner, storage and migrations, backup, legacy prototype migration                  | STOR              |
| M5  | Polish and release          | Accessibility, performance, locale, docs, offline single-file build, first release           | GEN               |
