# Named Fragments

Named fragments are reusable pieces of query logic that can be shared across multiple operations. They are similar to inline fragments but are defined separately and can be more complex.

## Usage

You can define a named fragment and use it in your queries:

```typescript
import sdk, { LaunchSelection } from "./sdks/spacex";

function launchFragment(this: any) {
    return LaunchSelection.bind(this)(({ id }) => ({
        id,
    }));
}
const { operation1 } = await sdk((op) => ({
    operation1: op.query((q) => ({
        withFragment: q.launches({ limit: 10 })(({ $fragment }) => ({
            ...$fragment(launchFragment)(),
        })),
    })),
}));
```

## Notes

-   A fragment used with the `...$fragment(...)()` helper is automatically converted into a named fragment and defined in the gql document that is sent to the server.
-   The name of the fragment is the name of the function that is passed to the `...$fragment(...)()` helper.
