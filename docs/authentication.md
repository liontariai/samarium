# Authentication

The SDK provides multiple ways to handle authentication for your GraphQL requests. You can set authentication tokens or resolvers globally, or pass a per-request source into `.auth(...)`.

## Global configuration (`sdk.init`)

### 1. Static token (`authToken`) — CLI / scripts / tests

Use a fixed string token when there is a single process-wide credential (CLI tools, one-off scripts, unit tests).

```typescript
import sdk from "./sdks/spacex";

sdk.init({
    authToken: "YOUR_TOKEN_HERE",
});
```

**Do not** re-call `init({ authToken })` per HTTP request in multi-user SSR. That stores one shared token and concurrent requests can cross-contaminate.

### 2. Auth resolver (`auth`) — apps (SSR + browser)

`auth` is a function that is invoked **on every SDK call**. It receives the optional argument passed to `.auth(source)`, or `undefined` when `.auth()` is omitted.

```typescript
import sdk from "./sdks/spacex";
import { accessTokenFromCookie } from "@cobalt27/auth/react/rr7"; // example helper

sdk.init({
    auth: (source?: string | Request) => {
        if (typeof source === "string") return source;
        if (source instanceof Request) {
            // SSR: extract token from this request's cookies
            return accessTokenFromCookie("accessToken", source);
        }
        // Browser / client: read cookie from document
        return accessTokenFromCookie();
    },
});
```

The resolver may return:

- a **string** token (sent as the configured auth header, usually `Authorization`)
- a **headers object** (`{ Authorization: "…" }` or custom headers)
- a **Promise** of either of the above
- `undefined` (no auth header)

```typescript
// Sync
sdk.init({
    auth: () => "YOUR_TOKEN_HERE",
});

// Async
sdk.init({
    auth: async () => await Promise.resolve("YOUR_TOKEN_HERE"),
});

// Headers object
sdk.init({
    auth: () => ({
        Authorization: "YOUR_TOKEN_HERE",
    }),
});
```

### 3. Extra static headers

Non-auth headers (or a static Authorization when you intentionally want it always present) go through `headers`:

```typescript
sdk.init({
    headers: {
        "X-Custom-Header": "value",
    },
});
```

Resolved auth headers always win over static `headers` for the same header name.

## Per-request authentication (`.auth`)

### With a global `auth` resolver (recommended for SSR)

Pass a **source** (request, token string, or any value your resolver understands). The global `auth` function is called with that source for this call only — no process-wide mutation.

```typescript
// SSR loader
export async function loader({ request }: LoaderArgs) {
    const profile = await sdk.query.profile(/* selector */).auth(request);
    return { profile };
}
```

```typescript
// Explicit token for this call only
await sdk.query.profile(/* selector */).auth("Bearer user-specific-token");
```

### Without a global `auth` resolver

`.auth(...)` still accepts a token, headers object, or function and applies it to that call only:

```typescript
// String token
const result = await sdk((op) => ({
    // Your query here
})).auth("Bearer token");

// Headers object
const result = await sdk((op) => ({
    // Your query here
})).auth({ Authorization: "Bearer token" });

// Sync / async factories
const result = await sdk((op) => ({
    // Your query here
})).auth(() => "Bearer token");

const result = await sdk((op) => ({
    // Your query here
})).auth(async () => await Promise.resolve("Bearer token"));
```

## SSR multi-user pattern (important)

| Setting | Safe for concurrent multi-user SSR? |
|--------|--------------------------------------|
| `init({ auth: (source) => … })` + `.auth(request)` | Yes |
| `init({ authToken: string })` once in a CLI | Yes (single user) |
| `init({ authToken })` inside `onAuth` / per request | **No** — race across users |

Recommended React Router / Cobalt style:

```typescript
// root.tsx — configure once
sdk.init({
    auth: (source?: string | Request) => {
        if (typeof source === "string") return source;
        if (source instanceof Request) return accessTokenFromCookie("accessToken", source);
        return accessTokenFromCookie();
    },
});

// root loader: gatekeeping only (redirects, refresh) — do not stash tokens in init
export const loader = makeAuthLoader(config, undefined, onError);

// route loaders / server code
await sdk.query.profile(sel).auth(request);
```

## Notes

- Global `auth` runs **per SDK call** with the current `.auth(source)` argument (or `undefined`).
- Per-call `.auth(source)` with a global resolver **does not** overwrite a shared module-level token.
- Static `authToken` is for single-credential environments only.
- Deprecated: `init({ auth: "string" })` — use `authToken` instead (a runtime warning is emitted).
- Deprecated: `init({ auth: { Authorization: "…" } })` — use `headers` or `authToken`.
