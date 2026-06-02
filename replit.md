# КадастрПро

Маркетплейс кадастровых услуг России — платформа для поиска и найма сертифицированных кадастровых инженеров.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, shadcn/ui, wouter (routing), react-hook-form + zod, TanStack Query
- API: Express 5 with generated OpenAPI client (`@workspace/api-client-react`)
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT Bearer tokens via bcryptjs + jsonwebtoken
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/kadastr-pro/` — React/Vite frontend (previewPath `/`)
- `artifacts/api-server/` — Express API server (previewPath `/api`)
- `lib/db/src/schema/` — Drizzle ORM schema (users, engineers, orders, bids, reviews, chat)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for API)

## Architecture decisions

- JWT Bearer token stored in `localStorage` as `kadastr_token`; injected via `setAuthTokenGetter` in AuthContext
- Engineers table stores `specializations` as a JSON string (array of service type strings)
- `lib/api-client-react/package.json` exports `./src/custom-fetch` so frontend can call `setAuthTokenGetter`
- All UI text is in Russian; green accent `#16a34a` (Tailwind `primary: 142.1 76.2% 36.3%`)
- Proxy routes: `/` → frontend (port 19892), `/api` → backend (port 8080)

## Product

- **Homepage**: hero, stats, service type grid, top engineers, recent orders
- **Engineers catalog**: filter by region/specialization/rating, search by name
- **Engineer profile**: bio, specializations, reviews, star ratings, chat button
- **Create order**: form with service type, region, budget, deadline
- **Customer dashboard**: my orders + bid management per order (accept/reject) + chats tab
- **Engineer dashboard**: available orders + bid form + my bids + profile edit + registry verification
- **Chat**: list of conversations + real-time-polled chat room
- **Admin panel**: stats dashboard, user management (block/unblock), order management

## Test accounts (seeded)

- Admin: `admin@kadastr.pro` / `admin123`
- Customer: `maria@example.com` / `password123`
- Engineer: `dmitry@kadastr.pro` / `engineer123`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change before editing frontend
- `api-client-react` must export `./src/custom-fetch` in its package.json for AuthContext to work
- Chat page polls every 3 seconds via `queryClient.invalidateQueries` (no WebSocket)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
