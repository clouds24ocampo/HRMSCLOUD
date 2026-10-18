---
name: permission-model-review
description: Review any change touching roles, board membership, guests, visibility, or who can see or edit what in WorkSync.
---
Model: org roles (Admin, Manager, Member, Guest) and board roles (Owner, Editor, Contributor, Assigned-only, Viewer). A board role can narrow an org role, never exceed it. See MASTER_GUIDE section 9.

Check:
1. Every controller route and WebSocket handler has an authorization rule written down next to the code, and the global guard is deny-by-default. `@Public()` is only allowed for entries in `docs/security/public-routes.json` with an ADR.
2. Resource ownership: the item, column, update, attachment, view, or automation in the URL or payload belongs to the board the caller was authorized for. Fetching by id alone is an IDOR bug.
3. Assigned-only: editing is limited to items where the caller is in a People column; check on update, delete, move, and bulk actions.
4. Contributor cannot change columns, automations, board members, or visibility. Viewer cannot write anywhere, including via forms they can open, automations, or imports.
5. Visibility: Open, Private, Shared. Search, dashboards, notifications, activity feeds, exports, and @mention pickers must not leak titles of boards the user cannot open.
6. Guests: only their shared boards, no user directory, no org-wide search, no export unless explicitly allowed.
7. Membership change (removed, role lowered, user disabled) takes effect for open WebSocket subscriptions and queued jobs, not only new requests.
8. Dashboards and automations never show or act on more than the viewer/creator could.
9. Last-owner rule: a board cannot be left without an owner; an admin takeover is audited.
10. Every change in roles, membership, or visibility writes an audit event.

Pair with `authz-test-matrix`. Output findings by severity with file:line; an unguarded route or missing ownership check is a release blocker.
