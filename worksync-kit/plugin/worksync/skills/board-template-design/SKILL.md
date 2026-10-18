---
name: board-template-design
description: Draft or review a WorkSync role template (field visit, office requests, sprint, content calendar, check-in, portfolio).
---
Templates make adoption work (MASTER_GUIDE sections 5 and 17). Write them in our own words and layout; never copy another product's template text or look.

For the requested role, produce a spec with:
1. **Who and why:** the group, their current routine (from interviews or the pilot), and the one decision or report this board must make possible.
2. **Groups:** how work is sectioned (week, sprint, month, request type).
3. **Columns:** 6 to 10 at most. For each: name, type, required?, default, validation.
4. **Statuses:** 4 to 6 labels, each mapped to a category (`todo`, `doing`, `blocked`, `done`). Always include one blocked-type status.
5. **Views:** the default view first, then at most two more.
6. **Forms:** fields, who may submit, what item it creates, where it lands.
7. **Automations:** 2 to 5 that remove nagging (reminders, handoffs, stuck flags, recurring items). Each with trigger, condition, action, and who is notified.
8. **Reporting hooks:** which dashboard widgets and digest lines this board feeds.
9. **Mobile:** what the field/phone user sees first; the fastest path to update status or submit a report.
10. **Permissions:** default board roles and visibility.
11. **Sample data and a 5-step "first day" checklist** for the champion.

Check against the role table in the guide. Reject columns nobody will fill in. Output the spec as markdown; do not generate code unless asked.
