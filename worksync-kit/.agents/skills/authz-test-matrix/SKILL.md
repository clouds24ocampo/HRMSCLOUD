---
name: authz-test-matrix
description: Generate or review the negative authorization tests for WorkSync routes, WebSocket events, dashboards, and forms.
---
For each endpoint or event, write the allowed case first, then every denial below. A route with no denial test is not done.

Actors: anonymous · member · manager · admin · guest · disabled user · expired token · removed board member (still connected).
Board roles: owner · editor · contributor · assigned-only · viewer · non-member.

Matrix to cover per resource (board, group, item, subitem, column, view, update, attachment, form, automation, dashboard, check-in, time entry, place check-in):
1. Non-member requests the resource by id: expect 404 or 403 with no existence leak (same response for missing and forbidden).
2. Member of board A requests an item that belongs to board B: denied.
3. Each board role x each action (read, create, edit own, edit any, move, delete, change structure, manage members, manage automations): table-driven test.
4. Assigned-only edits an unassigned item, and bulk-edits a mix: only assigned succeed.
5. Mass assignment: extra fields (`board_id`, `created_by`, `role`, `version`) in the body are rejected or ignored.
6. Guest lists users, searches org-wide, opens a non-shared board: denied.
7. Dashboard widget on a board the viewer cannot open shows nothing and leaks no counts.
8. WebSocket: subscribe without membership; send an event for a board not subscribed; membership revoked mid-session (further events denied, subscription dropped); oversized or malformed payload.
9. Manager can see check-ins and place check-ins only for people and boards in scope; each view of place data is audited.
10. Rate limits on login, form submit, upload, and automation test-run.

Test style: table-driven, one assertion on status code and one on "no data leaked". Run in CI on every PR. Report which cases exist and which are missing.
