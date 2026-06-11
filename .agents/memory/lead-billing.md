---
name: Lead billing architecture
description: How leads, debt, PRO subscriptions, and profile boosts work together in КадастрПро
---

## Constants
- `DEBT_LIMIT = 3000` (₽) — defined in both `bids.ts` (server-side enforcement) and `EngineerDashboardPage.tsx` (UI warnings). Keep in sync.

## Tables
- `leads` — created automatically when a bid is accepted; stores `orderId`, `engineerId`, `serviceType`, `leadCost`, `paymentStatus` (unpaid/paid)
- `lead_prices` — per-serviceType price config, upserted via `PUT /admin/lead-prices`; defaults to 500₽ if service type not found
- `profile_boosts` — finite-duration boosts; new rows inserted per grant (not upserted); check `expiresAt >= now` for active boost
- `engineers.debtAmount` — running total; incremented on bid accept, decremented (floor 0) when admin marks lead as paid

## Enforcement
- `POST /orders/:id/bids` returns 403 if `debtAmount >= DEBT_LIMIT`
- Catalog sort: debt-blocked → last; PRO active → first; active boost → second; then by rating

## PRO
- `engineers.isPro` + `engineers.proExpiresAt` — admin sets via `PATCH /admin/engineers/:id`
- Active PRO check: `isPro && (!proExpiresAt || proExpiresAt > now)`
- UI: amber banner on EngineerCard + amber PRO badge

## Admin seeding
- 11 default lead prices seeded via `PUT /admin/lead-prices` (run once after DB push)
