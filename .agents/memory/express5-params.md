---
name: Express 5 req.params types
description: In Express 5, req.params[key] is typed as string | string[], so parseInt(req.params.foo) fails TS. Fix: parseInt(req.params.foo as string)
---

Express 5 widens `req.params[key]` to `string | string[]`. Any `parseInt(req.params.xxx)` call will fail TypeScript with "Argument of type 'string | string[]' is not assignable to parameter of type 'string'".

**Fix:** Cast at the call site:
```ts
const id = parseInt(req.params.userId as string);
```

**Why:** The Express 5 `ParamsDictionary` type is `{ [key: string]: string | string[] }`. This is a breaking change from Express 4.

**How to apply:** Whenever adding a new route handler that parses a path param, always append `as string` to the `req.params.xxx` reference inside `parseInt()`.
