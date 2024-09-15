# Authentication

The SDK provides multiple ways to handle authentication for your GraphQL requests. You can set authentication tokens or headers globally or on a per-request basis.

## Usage

### Setting Authentication Globally

There are several ways to set authentication globally for one sdk:

1. String token:

```typescript
import sdk from "./sdks/spacex";

sdk.init({
    auth: "YOUR_TOKEN_HERE",
});
```

2. Function returning a token:

```typescript
import sdk from "./sdks/spacex";

sdk.init({
    auth: () => "YOUR_TOKEN_HERE",
});
```

3. Function returning a promise resolving to a token:

```typescript
import sdk from "./sdks/spacex";

sdk.init({
    auth: async () => await Promise.resolve("YOUR_TOKEN_HERE"),
});
```

4. Headers object:

```typescript
import sdk from "./sdks/spacex";

sdk.init({
    auth: {
        Authorization: "YOUR_TOKEN_HERE",
    },
});
```

5. Function returning a headers object:

```typescript
import sdk from "./sdks/spacex";

sdk.init({
    auth: () => ({
        Authorization: "YOUR_TOKEN_HERE",
    }),
});
```

6. Function returning a promise resolving to a headers object:

```typescript
import sdk from "./sdks/spacex";

sdk.init({
    auth: async () =>
        await Promise.resolve({
            Authorization: "YOUR_TOKEN_HERE",
        }),
});
```

### Setting Authentication on a Per-Request Basis

You can also set authentication on a per-request basis. This is useful if you want to authenticate a request with a different token or header than the global authentication.

1. String token:

```typescript
const result = await sdk((op) => ({
    // Your query here
})).auth("Bearer token");
```

2. Headers object:

```typescript
const result = await sdk((op) => ({
    // Your query here
})).auth({ Authorization: "Bearer token" });
```

3. Function returning a token:

```typescript
const result = await sdk((op) => ({
    // Your query here
})).auth(() => "Bearer token");
```

4. Function returning a promise resolving to a token:

```typescript
const result = await sdk((op) => ({
    // Your query here
})).auth(async () => await Promise.resolve("Bearer token"));
```

5. Function returning a headers object:

```typescript
const result = await sdk((op) => ({
    // Your query here
})).auth(() => ({ Authorization: "Bearer token" }));
```

6. Function returning a promise resolving to a headers object:

```typescript
const result = await sdk((op) => ({
    // Your query here
})).auth(async () => await Promise.resolve({ Authorization: "Bearer token" }));
```

### Notes

-   If you set authentication globally, it will be used for all requests.
-   If you set authentication per-request, it will override the global authentication for that request.
-   If you set authentication per-request, it will not be used on other requests.
