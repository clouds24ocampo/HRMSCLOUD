---
description: Run the authorization lint and review routes and WebSocket events against the permission model
---
Check rule Z-1 (deny by default) for the WorkSync API.

1. Run `node scripts/authz-guard.mjs --require-root` (default folder `apps/api/src`). If the API folder does not exist yet, say the API has not been started and stop. Report the real output and exit code.
2. List the controllers and gateways changed in the current diff (`git diff --name-only`). For each route or `@SubscribeMessage` handler, apply the `permission-model-review` skill: where is the authorization rule, does the object lookup check board membership, which role is allowed, and is there a denial test.
3. Check `docs/security/public-routes.json`: every entry needs a reason and an ADR, and every `@Public()` must be listed.
4. Compare against the `authz-test-matrix` skill and list the denial cases that have no test.
5. State clearly: the lint is one signal. A pass does not prove authorization is correct. List what still needs matrix tests and review.

Do not edit files. Do not add allow-list entries yourself; a public route needs an ADR decided by a human.
