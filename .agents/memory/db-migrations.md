---
name: DB migrations
description: How to safely apply schema changes in this project — drizzle-kit push has a TTY bug
---

## Rule
Never use `pnpm --filter @workspace/db run push` in a non-interactive shell — it hangs waiting for user confirmation when unique constraints are involved.

**Why:** drizzle-kit push prompts for confirmation before applying changes that touch unique constraints; without a TTY it blocks forever.

**How to apply:** Use `executeSql()` in the code_execution tool to run raw `ALTER TABLE` statements directly.

Example:
```js
await executeSql({ sqlQuery: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS district varchar(255);` });
```

After adding columns to the Drizzle schema file, run `pnpm run typecheck:libs` to regenerate declarations, then run codegen if the OpenAPI spec changed.
