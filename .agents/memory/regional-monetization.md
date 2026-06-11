---
name: Regional monetization
description: Per-region monetization model settings — DB columns, models, admin API
---

## DB columns on `regions` table

- `monetization_model` varchar(20) NOT NULL DEFAULT 'global'
- `fixed_lead_fee` integer NOT NULL DEFAULT 0 (rubles per lead)
- `percent_fee` real NOT NULL DEFAULT 0 (percent of order budget)

## Models

| Model    | Description |
|----------|-------------|
| global   | Use global platform default (default for all regions) |
| fixed    | Fixed ₽ per lead (use fixed_lead_fee) |
| percent  | Percent of order budget (use percent_fee) |
| hybrid   | Fixed + percent (use both columns) |
| disabled | No monetization in this region |

## Admin API

- `PATCH /admin/regions/:id` — requires superadmin role
  - Accepts `monetizationModel`, `fixedLeadFee`, `percentFee` in body
  - Validates model against allowed enum

- `GET /admin/regions` — returns all three columns in `AdminRegionItem`

## Admin UI

`AdminPage.tsx` "География" tab — "Монетизация" column:
- View mode: shows model label + fee summary
- Edit mode: model selector + conditional fee inputs (fixedLeadFee for fixed/hybrid, percentFee for percent/hybrid)

**Why:** PRD §6 requires per-region monetization configuration accessible only to superadmin.

**How to apply:** When billing a lead, check the order's region → look up its monetization model → apply the appropriate fee calculation. Currently the models are stored but the billing logic still uses the global lead_prices table — this is the next implementation step.
