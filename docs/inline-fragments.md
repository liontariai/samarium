# Inline Fragments

Inline fragments allow you to reuse selections across multiple queries or mutations. They are particularly useful for creating modular and reusable parts of your GraphQL operations.

## Usage

You can define an inline fragment as a function and use it in your queries, to reuse selections across multiple queries or mutations.

```typescript
function titleOnly() {
    return BookArraySelection((s) => ({
        titleFromFragment: s.title,
    }));
}
const { operation1 } = await sdk((op) => ({
    operation1: op.query((q) => ({
        bookTitles: q.books(() => ({
            ...titleOnly(),
        })),
    })),
}));
```
