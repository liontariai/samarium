# Parameterized Fragments

Parameterized fragments are reusable query fragments that can accept parameters. This feature allows you to create more flexible and dynamic fragments that can be customized at the point of use.

## Usage

You can define a parameterized fragment and use it with different arguments:

```typescript
function launchQueryFragment(limit: number) {
    return QuerySelection(({ launches }) => ({
        firstNLaunches: launches({ limit })(({ id }) => ({
            id,
        })),
    }));
}
const { operation1 } = await sdk((op) => ({
    operation1: op.query(({ $fragment }) => ({
        ...$fragment(launchQueryFragment)(10),
        ...$fragment(launchQueryFragment)(20),
    })),
}));
```
