# Multiple Operations

The SDK allows you to execute multiple operations in a single request. This feature is useful when you need to fetch or mutate data from different parts of your GraphQL schema simultaneously.

## Usage

You can define multiple operations by returning an object with named operations from the SDK function:

```typescript
const { operation1, operation2, mutation1 } = await sdk((op) => ({
    operation1: op.query((q) => ({
        bookTitles: q.books(({ title }) => ({ title })),
    })),
    operation2: op.query((q) => ({
        bookAuthors: q.books(({ author }) => ({ author })),
    })),
    mutation1: op.mutation((m) => ({
        created: m.createBooks({
            titles: ["book1", "book2"],
            authors: ["author1", "author2"],
        })(({ title }) => ({ title })),
    })),
}));
```

Each operation will be executed separately, allowing you to combine queries and mutations in a single SDK call.

## Notes

-   The operations are executed in the order they are defined. But they are executed in parallel, so the result is the same as if you executed each operation separately.
-   You can also use the `.$lazy` property to create a lazy operation alongside with other operations. See [lazy execution](./lazy-execution.md) for more information.
