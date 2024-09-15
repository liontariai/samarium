# Samarium SDK Documentation

After generating a SDK from your GraphQL API of choice, you will want to use it as efficiently as possible. This documentation provides a comprehensive guide on how to leverage the various features of Samarium SDKs to make the most of your GraphQL implementation. Whether you're dealing with complex queries, authentication, or custom types, you'll find detailed explanations and examples to help you navigate through your development process.

## Table of Contents

1. [Multiple Operations](./multiple-operations.md)
2. [Authentication](./authentication.md)
3. [Aliases](./aliases.md)
4. [Scalar Selection Helper](./scalar-selection-helper.md)
5. [Inline Fragments](./inline-fragments.md)
6. [Named Fragments](./named-fragments.md)
7. [Parameterized Fragments](./parameterized-fragments.md)
8. [Directives](./directives.md)
9. [Union Types](./union-types.md)
10. [Custom Scalars](./custom-scalars.md)
11. [Lazy Execution](./lazy-execution.md)

Each of these documents provides detailed information about specific features of the SDK:

-   **Multiple Operations**: Learn how to execute / define multiple operations in a single sdk call.
-   **Authentication**: Discover how to set authentication tokens or headers globally or on a per-request basis.
-   **Aliases**: Discover how you can easily make use of GraphQL aliases in your typescript sdk call.
-   **Scalar Selection Helper**: Understand how to use the scalar selection helper to simplify your queries by not having to type out all fields by hand.
-   **Inline Fragments**: Learn how to use inline fragments to query fields on specific object types.
-   **Named Fragments**: Explore how to use named fragments to reuse common field selections across multiple queries with real GraphQL fragments.
-   **Parameterized Fragments**: Discover how to create and use parameterized fragments for more flexible and reusable queries.
-   **Directives**: Learn how to use (client) directives to add additional instructions to your queries.
-   **Union Types**: Understand how to work with union types in your queries and handle different possible return types.
-   **Custom Scalars**: Learn how to work with custom scalar types defined in your GraphQL schema.
-   **Lazy Execution**: Learn how to execute your queries lazily / on-demand. This is useful when you want to create a query or mutation that can be executed in multiple places with different parameters.

I recommend looking at some of the examples and then start using it intuitively.
