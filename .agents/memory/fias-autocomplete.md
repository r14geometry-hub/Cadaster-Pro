---
name: ФИАС address autocomplete
description: How the address suggest endpoint works and how to add Dadata integration
---

## Endpoint

`GET /api/address/suggest?query=...&level=district|locality|address&region=...`

- Returns array of `{ value, district, locality, region }` suggestions
- `query` must be ≥ 2 characters
- `level` controls granularity; `region` narrows results to one RF subject

## Mock vs live

- If `DADATA_API_KEY` env var is set → proxies to Dadata suggestions API
- Otherwise → returns from curated static dataset in `address.ts`

Mock covers 13 major regions: Москва, Санкт-Петербург, Московская область, Краснодарский край, Татарстан, Свердловская, Новосибирская, Самарская, Ростовская, Нижегородская, Башкортостан, Челябинская, Иркутская.

## Frontend component

`artifacts/kadastr-pro/src/components/AddressAutocomplete.tsx`

Props:
- `value / onChange` — controlled
- `level` — "district" | "locality" | "address"
- `region` — optional filter
- `freeText` — if false, only allow selecting from suggestions; if true, allow free typing + suggestions

Used in:
- `CreateOrderPage` — district (freeText=false), locality (freeText=false), address (freeText=true)
- `EngineerDashboardPage` territory editor — district/locality fields (freeText=false)

**Why:** PRD §3 requires prohibiting free-form entry of region/district/locality. freeText=false enforces selection from autocomplete results.

**How to apply:** Always pass `freeText={false}` for district/locality fields. For address fields (can contain cadastral numbers), use `freeText={true}`.

## Adding real Dadata

Set `DADATA_API_KEY` in environment secrets. The endpoint auto-switches from mock to live. Dadata's free tier provides 10,000 requests/day.
