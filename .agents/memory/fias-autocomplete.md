---
name: ФИАС address autocomplete
description: How the address suggest endpoint works and how to add Dadata integration
---

## Endpoint

`GET /api/address/suggest?query=...&level=...&region=...&district=...&parentId=...`

Levels: `region | district | locality | territory | street | house | address`
Returns: `{ label, value, fiasId, level, type, region, district, locality, fullAddress }`

- `query` must be ≥ 2 characters
- `district` + `parentId` (FIAS GUID) narrow results hierarchically
- Dadata bounds: region→region, district→area, locality/territory→city/settlement, street→street, house/address→street/house

## Production guard

- `NODE_ENV=production` + no `DADATA_API_KEY` → HTTP 503 with admin-facing error message
- Dev without key → mock fallback + console warning

## Mock coverage

Mock data covers 82 RF regions for `level=region` search (full list), with district/locality data for ~6 major regions.

## Frontend component

`artifacts/kadastr-pro/src/components/AddressAutocomplete.tsx`

Props: `value/onChange`, `level` (AddressLevel), `region?`, `district?`, `parentId?`, `freeText?`, `className?`
Exports: `AddressSuggestion` interface, `AddressLevel` type

- `freeText=false` — only allow selecting from suggestions (for district/locality/territory)
- `freeText=true` — allow free typing with suggestions (for address fields)
- 503 response shows amber warning banner inside the component

Used in:
- `CreateOrderPage` — district/locality (freeText=false), address (freeText=true)
- `EngineerDashboardPage` — territory district/locality (freeText=false)
- `EngineersPage` — district catalog filter (freeText=false, region-narrowed)

**Why:** PRD §3 requires prohibiting free-form entry of region/district/locality/territory/address.

**How to apply:** Pass `freeText={false}` for all geographic hierarchy fields. For free-text address/house fields use `freeText={true}`. Always pass `region` when level=district; pass `district` when level=locality.

## Adding real Dadata

Set `DADATA_API_KEY` in environment secrets. Also set `DADATA_SECRET_KEY` if needed for clean API (not required for suggestions). Dadata free tier: 10,000 requests/day.
