# Lazy Execution

Lazy execution allows you to define operations that can be executed later, potentially with different arguments. This feature is useful for creating reusable query templates or for delaying the execution of certain operations.

## Usage

You can create a lazy operation by using the `$lazy` property:

```typescript
import sdk from "./sdks/spacex";

const { first10OrNLaunches } = await sdk((op) =>
    op.query((q) => ({
        first10OrNLaunches: q.launches({ limit: 10 })(({ id }) => ({ id }))
            .$lazy,
    })),
);

// Later:
const result10 = await first10OrNLaunches({}); // default limit of 10, because we didn't pass a limit argument and it was defined as a default argument

// some time later:
const result5 = await first10OrNLaunches({ limit: 5 }); // limit of 5, because we passed a limit argument

// some time later:
const result22 = await first10OrNLaunches({ limit: 22 }); // limit of 22, because we passed a limit argument
```

## Notes

-   Lazy operations are useful for creating reusable query templates.
-   You can pass different arguments to a lazy operation, and it will execute with the appropriate arguments when you call `await` on it.
