---
name: Engineer schema extensions
description: New columns added to engineers table beyond the original schema; how JSON fields are handled.
---

Added to `lib/db/src/schema/engineers.ts`:
- `regions` — `text`, JSON array of regions (e.g. `["Москва", "Подмосковье"]`)
- `isOnline` — `boolean`
- `responseTime` — `varchar(100)`, e.g. "за 1 час"
- `priceFrom` — `integer`, minimum price in RUB
- `portfolioItems` — `text`, JSON array of `PortfolioItem` objects

**Why:** Frontend cards and profile pages need all these fields for Avito Profi–style UX. Stored as JSON text in Postgres rather than separate tables because portfolio items are read-only display data, not queried/filtered independently.

**How to apply:** After any schema change, run `pnpm --filter @workspace/db run push` (dev) and then `pnpm --filter @workspace/api-spec run codegen` to regenerate types. The `formatEngineer` helper in `engineers.ts` route must parse JSON fields with `parseJson()`.
