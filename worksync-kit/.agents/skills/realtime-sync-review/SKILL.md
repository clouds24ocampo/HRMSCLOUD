---
name: realtime-sync-review
description: Review WorkSync realtime (WebSocket) board updates, presence, subscriptions, and reconnect behaviour.
---
1. Authenticate at connect with the same identity as HTTP. Reject unauthenticated sockets quickly; expire sockets when tokens expire.
2. Subscribe only after a server-side board membership check. Room names are never the authority; the server tracks the subscription.
3. Authorize every inbound event, not just the first. Validate payload schema, cap size and rate per socket and per user.
4. Server pushes minimal change events (ids, version, changed fields). Clients patch or refetch. Never push data the receiver may not see, including field values hidden by column rules.
5. Membership or role changes re-evaluate open subscriptions immediately (drop or downgrade). Test with a removed member who stays connected.
6. Fan-out is per board. A board with thousands of items and 100 viewers must not melt: batch bursts, coalesce updates, apply back-pressure.
7. Reconnect: clients send the last seen event id; the server replays missed events or tells the client to refetch. Handle duplicate and out-of-order delivery by version.
8. Presence is optional, minimal, and never reveals which private boards someone is on.
9. Horizontal scale: sticky sessions or a Redis adapter, and a test that two API instances deliver the same event once.
10. Resource cleanup: leaving a board, closing a tab, or a dead connection frees subscriptions and timers.
11. Logging: event type and ids only, never payload content or tokens.

Tests: unauthenticated connect; subscribe to a non-member board; event for a board not subscribed; oversize payload; revoked mid-session; reconnect storm of 200 clients; two instances.
Output findings by severity with file:line.
