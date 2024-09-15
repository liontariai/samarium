# Directives

Directives in GraphQL provide a way to affect the execution of a query in a flexible and reusable way. The SDK supports the use of directives in your queries.

## Usage

You can apply directives to fields in your queries:

```typescript
import sdk, { $directives } from "./sdks/books";

const tag = $directives.tag;
const { operation1 } = await sdk((op) => ({
    operation1: op.query((q) => ({
        bookTitles: q.books(({ title }) => ({
            title: tag({ tag: "tagging directive" })(title),
        })),
    })),
}));
```
