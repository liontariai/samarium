# Aliases

Aliases allow you to rename fields in your GraphQL queries. This feature is useful when you want to query the same field multiple times with different arguments or when you want to give a field a more descriptive name in your result.

## Usage

You can use aliases by specifying a new name for a field in your query:

```typescript
const { operation1 } = await sdk((op) => ({
    operation1: op.query((q) => ({
        bookTitles: q.books(({ title }) => ({
            nameOfBook: title,
        })),
    })),
}));
```

Now `operation1` is using two aliases:

1. `bookTitles` is aliasing `books`
2. `nameOfBook` is aliasing `title`

So the result will be:

```typescript
{
    operation1: {
        bookTitles: [
            {
                nameOfBook: "The Great Gatsby",
            },
        ];
    }
}
```

This way you could query the same field multiple times with different aliases.
In this case you could query multiple times for the field books. And also rename the fields to your liking.
