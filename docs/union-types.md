# Union Types

Union types in GraphQL allow a field to return one of several possible object types. The SDK provides a convenient way to handle union types using inline fragments.

## Usage

You can use the `$on` helper to specify selections for each possible type in a union:

```typescript
const { operation1 } = await sdk((op) => ({
    operation1: op.query((q) => ({
        all: q.search({ title: "test" })(({ $on }) => ({
            ...$on.Book((s) => ({
                ...s.$scalars(),
            })),
            ...$on.Article((s) => ({
                ...s.$scalars(),
            })),
        })),
    })),
}));
```
