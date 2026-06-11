---
name: Territory matching
description: How engineer service areas filter available orders — data model and matching logic
---

## Data model

`engineers.service_areas` — JSON text column, array of:
```ts
interface ServiceArea { region: string; districts: string[]; localities: string[]; }
```
- `districts: [], localities: []` = covers entire region
- `districts: ["X"], localities: []` = covers district X and all its localities
- `localities: ["Y"]` = covers only locality Y

`orders.district`, `orders.locality`, `orders.address` — nullable varchar columns added alongside existing `orders.region`.

## Matching (territory-match.ts)

Priority: locality > district > region. Returns true if the order falls in any of the engineer's service areas.
If engineer has no service areas configured, all orders are shown (empty = no filter).

## Backend integration

- `GET /orders?forEngineer={engineerId}` — fetches all matching orders, applies territory filter in app code, then paginates.
- `POST /orders` (non-draft) — after insert, notifies all verified engineers whose serviceAreas match the new order's region/district/locality.
- `PUT /engineers/me` — accepts `serviceAreas` array; stored as JSON.

## Frontend

Engineer dashboard "Профиль" tab: territory editor allows adding entries (region + optional district + optional locality) and removing them. Saved with the rest of the profile form.

CreateOrderPage: district, locality, address fields in a "Location details" collapsible section. Region dropdown populated from live `/api/regions` (active only).

**Why:** Per PRD, engineers should only see orders in their work territory. This avoids showing irrelevant orders and reduces noise in notifications.
