---
name: progress-reporting-design
description: Design or review WorkSync progress reporting: status rollups, daily check-ins, weekly digests, stuck detection, dashboards.
---
Goal: managers see an accurate current picture without chasing people. See MASTER_GUIDE section 6.

1. Everything aggregates by status category (`todo`, `doing`, `blocked`, `done`), never by label text.
2. Percent complete: done subitems / total subitems, or a manual value if there are none. Document how archived and blocked items count, and keep the formula in one tested function.
3. Define "stuck": not done, no update/status change for N days (N per board, default 3 working days). Working days respect each person's time zone and holidays setting.
4. Daily check-in: Done / Next / Blocked, pre-filled from the person's changes that day, completable in under a minute on a phone, prompt at the person's local time (field staff: end of shift). A blocker flags the manager.
5. Check-in completion is shown as a team rate and a follow-up list for managers. It is not a score or ranking. Do not build leaderboards or per-person "productivity" numbers.
6. Weekly digest: completed, overdue, blocked, stuck, workload by person, check-in rate, upcoming deadlines. Same numbers as the dashboards, produced by the same queries.
7. Dashboards read through the permission layer: a widget never counts or lists what the viewer cannot open.
8. Time zones and DST: store UTC, display local; test the week boundary for a team spread across zones.
9. Accuracy tests: build fixtures with known answers (including subitems, archived items, blocked) and assert exact numbers; a digest must equal a hand count.
10. Performance: precompute or cache rollups per board with invalidation on event, and test a board with 10k items.
11. Every metric has a one-line plain-language definition shown in the UI.

Output: gaps against this list, with the test that would prove each fix.
