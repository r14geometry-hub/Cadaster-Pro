---
name: Region enforcement
description: 85 RF federal subjects table — statuses block order/bid creation
---

## Seeding

`seedRegionsIfEmpty()` in `artifacts/api-server/src/lib/seed-regions.ts` runs on startup. Inserts 85 subjects if the table is empty. Idempotent.

## Status meanings

| Status   | Effect |
|----------|--------|
| active   | Normal — orders and bids allowed |
| limited  | No new orders, no new bids |
| paused   | No new orders, no new bids |
| closed   | No new orders, no new bids |

## Enforcement locations

- `POST /orders` — checks region status; returns 403 with localized Russian message if not active.
- `POST /bids` — looks up the order's region; returns 403 if not active.

## Admin panel

`AdminPage.tsx` — "География" tab (superadmin-only): shows 85 regions with stats (engineer count, order count, revenue), inline status + comment edit.

Endpoints:
- `GET /admin/regions` — requires superadmin role
- `PATCH /admin/regions/:id` — requires superadmin role

**Why:** Platform needs to control rollout by geography; non-active regions prevent new work from being created there.
