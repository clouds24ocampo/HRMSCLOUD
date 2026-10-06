# DTR Punch Screen (Sub-project A)

Date: 2026-10-06. Status: draft for review.

## Roadmap context

The DTR/Schedule request grew into eight sub-projects, each with its own spec, plan and build. Agreed order:

| # | Sub-project | Summary |
|---|---|---|
| **A** | **Punch screen (this spec)** | Break 1/2/3, bio-break daily cap, On Trip form, OT-gated Break 3, two-tab clock card |
| F | Permissions (RBAC) | Code-defined permission catalog, per-org custom roles, per-user grants/denials, scope per grant |
| G | Schedule v2 | Team-linked schedules (members follow leader until changed by an authorized person), fast grid edits, swap, copy week |
| H | Schedule dashboard | Live Personnel, person search + adherence verdict, analytics graphs |
| B | DTR requests | Weather, Absent (+proof upload), Half Day, Missed punch, Late reason, Early out, Dispute, OT pre-approval; approval flow |
| E | Work sites + geofence | Map-drawn circle per site, exact GPS pin on every punch, INSIDE/OUTSIDE tag, policy OFF/FLAG/BLOCK |
| C | Auto-attendance engine | Auto time-out 2 h after shift end, auto-absent 2 h after shift start, no-punch notifications, scheduler |
| D | Discipline ladder | Monthly offense count, warning 1/2/3, 4th = HR dismissal **review task** (never automatic) |

Out of scope for A: everything except the first row.

## Goal

Employees record their day on one screen. Page 1 holds work punches. Page 2 ("Issues") holds events that explain or interrupt work. Rules live in the server, driven by data on each time stamp type, so every organization and industry uses the same engine.

## Current state (verified in code)

- Clock UI: `hrms/src/components/ClockCard.tsx`. Buttons come from `TimeStampType` rows.
- Recording: `recordTime` in `hrms/src/app/(app)/dtr/actions.ts`. Server clock only, append-only `TimeEvent`.
- Calculation: `buildDtr` in `hrms/src/lib/dtr.ts`. Over-limit is per pause (`allowedMinutes`), grouped by pause name.
- Stamp types are seeded lazily by `getStampTypes` (`hrms/src/lib/stamps.ts`) only when an org has zero rows. Existing orgs will not receive new defaults unless we top up.
- `OvertimeRequest` exists (`PENDING | APPROVED | REJECTED | CANCELLED`, unique per employee per date, `minutes`). Today it is filed after the fact. Pre-approval flow is sub-project B.

## Requirements

Page 1 (Punch):
1. Time In.
2. Break 1, Break 2: 15 min each, once per day each.
3. Break 3: 15 min, once per day, only when the employee has an `APPROVED` overtime request for today with `minutes` greater than 120.
4. Meal: 60 min unpaid, up to 2 per day (lunch, dinner).
5. Bio Break: paid, recorded; daily total capped at 10 minutes. Passing the cap is **flagged**, not blocked.
6. On Trip: requires departure, destination and reason. Date and time are stamped by the server at press.
7. Time Out.

Page 2 (Issues), in A: Clinic Break (30 min), System Issue (note required). Sub-project B adds the rest.

## Design

### Data (one migration, additive)

`TimeStampType` gains:
- `page StampPage @default(PUNCH)` where `enum StampPage { PUNCH ISSUE }`
- `maxPerDay Int?`
- `dailyCapMinutes Int?`
- `requiresOvertimeOver Int?` (minutes of approved overtime that must be exceeded)

`TimeEvent` gains nullable `tripFrom`, `tripTo`, `tripReason` (String). Rows stay append-only.

Backfill for existing organizations, in the same migration (idempotent, keyed on `organizationId` + `key`):
- `BREAK`: rename to "Break 1", `maxPerDay = 1`, sort 20.
- Insert `BREAK_2` (sort 21) and `BREAK_3` (sort 22, `requiresOvertimeOver = 120`), 15 min, `maxPerDay = 1`, tone amber, icon ☕.
- `MEAL`: `maxPerDay = 2`.
- `BIO_BREAK`: `dailyCapMinutes = 10`.
- `CLINIC_BREAK`, `SYSTEM_ISSUE`: `page = ISSUE`.
- `ON_TRIP`: set `requiresNote = false`. The three trip fields replace the note (enforced by the `ON_TRIP` key, see Rules).

`DEFAULT_STAMP_TYPES` in `hrms/src/lib/defaults.ts` is updated to the same values for new organizations. The key `BREAK` is kept so history stays attached.

Existing events are untouched. Past "Break" punches display under the renamed "Break 1".

### Rules (server, single source of truth)

New pure module `hrms/src/lib/stamp-rules.ts` exporting `stampBlock(input): string | null` (a blocking reason or null). Input: the stamp type, today's non-voided events for that employee, approved overtime minutes for today, current clock state. Both `recordTime` and the UI use it: the UI receives the reason string from the server and only displays it; it never re-implements the rule.

- `maxPerDay`: count of `PAUSE_START` events for that stamp type in the employee's current work day. At or over the limit: blocked, "Already used today".
- `requiresOvertimeOver`: approved overtime minutes today must be strictly greater. Otherwise blocked, "Needs approved overtime over 2 h".
- Work day = the day of the session's Time In in org timezone (matches `buildDtr`, so overnight shifts stay on one day).
- On Trip trip fields: required when `stamp.key === "ON_TRIP"` and type is `PAUSE_START`; each trimmed, 3 to 120 characters. Server rejects otherwise with `needTrip: true`. Ending the trip needs no fields.
- Bio break cap: never blocks. After the pause ends, `buildDtr` computes the daily total; the excess over `dailyCapMinutes` is counted into `overLimitMinutes` and the pause summary's `overMinutes`, so the existing "Over break limit" badge works unchanged.

`StampInfo` and `Pause` in `dtr.ts` gain `dailyCapMinutes`. `STAMP_SELECT` in `punch.ts` adds it. Per-pause `allowedMinutes` logic stays; the cap is applied per pause name after grouping.

### UI (`ClockCard.tsx`)

- Two tabs under the time display: **Punch** and **Issues**, chosen by `TimeStampType.page`. Steps 1 (work context) and 2 (password) are shared and stay above the tabs.
- Tile subtext, supplied by the server as data: "1 of 1 today", "7 of 10 min used today", "Needs approved overtime over 2 h".
- Pressing On Trip opens an inline three-field form (Departure, Destination, Reason) in place of the single note. Submit stamps the pause start.
- Existing behaviors kept: password unlock per stamp, location capture at press, same-pause-again ends it.
- DTR day detail (`dtr/page.tsx`) shows "Trip: from → to, reason" under the On Trip punch.

### Security and privacy

- Server remains the only authority for time, caps and gating; client hints are cosmetic.
- No new data exposure: trip text is visible to the same people who already see that punch (self, supervisor chain, HR).
- All trip text is plain text, length-limited, rendered escaped.

### Error handling

- Blocked press returns `{ error }` with the reason; UI shows it and keeps the tile disabled with a tooltip.
- Missing trip fields return `needTrip`; UI highlights the form.
- Migration is additive and idempotent; no data deleted. Rollback = drop the added columns (no old behavior depends on them).

## Testing

Unit tests (vitest, extend `dtr.test.ts` and new `stamp-rules.test.ts`):
- `maxPerDay` blocks the second Break 1, allows Meal twice and blocks the third.
- Break 3 blocked with no approved OT, with exactly 120 min, with PENDING 180 min; allowed with APPROVED 121 min.
- Bio break: 6 + 6 minutes yields 2 over; 4 + 4 yields 0; cap does not block starting a bio break.
- Overnight shift: counts for `maxPerDay` use the session's start day.
- Voided events are ignored by every count.
- On Trip: missing or short trip fields rejected; end of trip accepted without fields.

Manual / e2e: punch screen shows two tabs, tile subtext correct, Break 3 locked then unlocked after OT approval, On Trip form flow, DTR day detail shows trip. Typecheck and full test run must pass before the work is called done.

## Open assumptions (change here if wrong)

- Break lengths are 15 minutes; Meal 60; Clinic 30. All editable later in Settings.
- Bio-break overage is flagged, not blocked.
- "More than 2 hours" of overtime means strictly greater than 120 minutes.
