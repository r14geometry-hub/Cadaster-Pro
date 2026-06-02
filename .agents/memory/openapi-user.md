---
name: OpenAPI User schema completeness
description: The User schema in openapi.yaml must include all fields returned by the backend or TS errors appear in consumer pages.
---

The `User` schema in `lib/api-spec/openapi.yaml` must include `isBlocked` (type `["string","null"]`) because `AdminPage.tsx` reads it. Without it, `tsc --noEmit` reports TS2339 on the generated `User` type.

**Why:** Orval generates the `User` TS interface strictly from the OpenAPI schema. Any field the backend returns but that is absent from the spec won't appear in the generated type, causing type errors in pages that use it.

**How to apply:** Whenever adding a field to `usersTable`, also add it to the `User` object in `openapi.yaml`, then re-run codegen.
