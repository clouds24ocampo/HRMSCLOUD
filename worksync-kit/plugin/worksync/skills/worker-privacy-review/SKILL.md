---
name: worker-privacy-review
description: Review any WorkSync feature that collects or shows data about employees: location, time, photos, check-ins, activity, metrics.
---
Rule P-1: no covert monitoring. Rule D-1: collect the minimum. See MASTER_GUIDE section 10. This is a gap list for HR, counsel, and the DPO, not legal advice (Philippine Data Privacy Act, RA 10173).

For each data item the feature touches, answer:
1. **Purpose:** the specific work reason, written in one sentence and shown to the employee at the moment of capture.
2. **Trigger:** an explicit employee action (tap, submit). Anything automatic or background is rejected: no screenshots, keystroke or app/URL logging, continuous or background location, idle detection, or activity scoring.
3. **Minimum:** one location reading with accuracy, not a trail; time as start/end entries, not minute-level activity; photos only when attached to an item.
4. **Visibility:** who can see it (employee, board members with permission, named managers). The "What can my manager see about me?" page lists it. Every manager view of place data is audited.
5. **Retention:** period set per type (default location 90 days, owner decides), automated purge, verified by a test.
6. **Notice and basis:** policy text exists and is shown at first use; consent captured where counsel says it is required; DPO contact available.
7. **Rights:** the employee can view and request correction or deletion of their own data; the process is documented.
8. **Use of metrics:** completion counts and check-in rates are management information, not an automatic performance score; HR defines how they are used. No ranking screens.
9. **Exports and integrations:** no personal data to third parties without a recorded reason; exports are permissioned and audited.
10. **Security:** encrypted at rest and in transit; logs hold ids, not content or coordinates.

Output: table of data item | purpose | trigger | retention | visibility | gap. Any automatic or background collection is a blocker.
