---
description: Check a WorkSync milestone's exit criteria against the repo, with evidence for every line
argument-hint: W0 | W1 | W2 | W3 | W4 | W5 | W6 | W7
---
Check milestone **$ARGUMENTS** of WorkSync. If no milestone was given, ask which one (W0-W7).

1. Read `docs/architecture/MASTER_GUIDE.md` section 14 and take that milestone's checklist and **Exit** line verbatim.
2. For each item, look for evidence in the repo: a file, a test name, an ADR, a CI workflow, a config. Check that a command exists in `package.json` / the repo before running it, and run only commands that exist.
3. Report a table: `item | status | evidence`.
   - **Done** only with concrete evidence (path, test name, or real command output you just saw).
   - **Not done** when nothing exists.
   - **Unverified** when it needs a human or an environment you do not have (pilot results, interviews, pen-test, HR/DPO sign-off, restore drill, airplane-mode device test). Name the owner.
4. Finish with a verdict. The gate passes only if every Exit item is **Done**. List blockers first, most severe first.

Rules: never tick an item from memory or from the author's summary (V-1). Do not edit files. Do not install anything or change infrastructure.
