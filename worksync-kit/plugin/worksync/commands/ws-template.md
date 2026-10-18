---
description: Draft a role template spec (board, statuses, views, form, automations) for WorkSync
argument-hint: field | office | remote | programmer | marketing | manager | <other role>
---
Draft a board template spec for: **$ARGUMENTS**. If none was given, ask which role.

1. Use the `board-template-design` skill and the role table in `docs/architecture/MASTER_GUIDE.md` sections 1.1 and 5.
2. If interview notes or pilot findings exist (check `docs/research/` and `docs/`), base the spec on them and cite the file. If they do not exist, say the spec is a hypothesis to test in the pilot.
3. Produce the markdown spec: who and why, groups, 6-10 columns, 4-6 statuses each mapped to a category (`todo`, `doing`, `blocked`, `done`), views, form, 2-5 automations, reporting hooks, mobile first screen, default permissions, sample data, and a 5-step first-day checklist.
4. Use our own wording and layout. Do not copy any other product's template text or look.
5. Save to `docs/research/templates/<role>.md` and report the path. Do not write application code.
