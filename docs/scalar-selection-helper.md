# Scalar Selection Helper

The Scalar Selection Helper is a utility that allows you to easily select all scalar fields of a type without explicitly listing them.

## Usage

You can use the `$scalars()` helper to select all scalar fields:

```typescript
const { operation1 } = await sdk((op) => ({
    operation1: op.query((q) => ({
        bookTitles: q.books(({ $scalars }) => ({
            ...$scalars(),
        })),
    })),
}));
```

## Notes

-   The `$scalars()` helper selects all scalar fields of a type, so in this case it will select e.g. `id`, `title`, `author` and so on.
-   If a field is not a scalar or has arguments, it will not be selected.
-   You will see the selected fields in the typescript type.
