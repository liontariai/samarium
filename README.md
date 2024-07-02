![](https://samarium.liontari.ai/assets/demo-CavLQwfh.gif)

# Samarium

[![GitHub last commit](https://img.shields.io/github/last-commit/liontariai/samarium)](https://github.com/liontariai/samarium/commits/main/)
[![NPM Version](https://img.shields.io/npm/v/%40liontari.ai%2Fsamarium)](https://www.npmjs.com/package/@liontari.ai/samarium)
[![NPM Downloads](https://img.shields.io/npm/dm/%40liontari.ai%2Fsamarium)](https://www.npmjs.com/package/@liontari.ai/samarium)

No dependencies. No codegen steps. No graphql files. No IDE setup. No config files. No client boilerplate.

Just the contents of your apis. **Fully typesafe**.

With little magic this tool aims to give you an experience, where you just write down the data object you want and don't worry about the details of GraphQL.
You just define the object and use placeholders for the data that comes from the api, the syntax resembles the GraphQL query language, but it's just a plain JavaScript object.

Renaming a field in the api? No problem, just rename it in your code. It will automatically be a GraphQL aliased field in the query.

```bash
# example with SpaceX' GraphQL Api
npx @liontari.ai/samarium generate https://spacex-production.up.railway.app spacex.ts
```

```typescript
import spacex from "./spacex";

const { aliasedQuery } = await spacex(({ query }) => ({
    aliasedQuery: query(({ company }) => ({
        company: company(({ ceo, headquarters }) => ({
            ceo,
            headquarters: headquarters((s) => ({
                address: s.address,
            })),
        })),
    })),
}));
```

## Demo & Playground

Try some examples in the playground at [samarium.liontari.ai](https://samarium.liontari.ai).

![Demo](https://github.com/liontariai/samarium/blob/main/docs/images/screenshot1.png?raw=true)

## Usage

```bash
npx @liontari.ai/samarium
```

```bash
bunx @liontari.ai/samarium
```

```bash
yarn dlx @liontari.ai/samarium
```

```bash
pnpm dlx @liontari.ai/samarium
```

## Features

Implemented GraphQL features:

| Feature             | Supported | Description                                                                                                                                                                                                                                 |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queries             | ✅        | Queries are fully typed functions.                                                                                                                                                                                                          |
| Mutations           | ✅        | All mutations are fully typed functions just like queries.                                                                                                                                                                                  |
| Variables           | ✅        | All arguments used in queries and mutations are collected and hoisted to the top level as variables.                                                                                                                                        |
| Aliases             | ✅        | Aliases are supported for all fields.                                                                                                                                                                                                       |
| Multiple operations | ✅        | Multiple operations in a single query are supported. You can even mix queries and mutations. Just make sure to name them. They are sent in the order they are defined.                                                                      |
| ... on Type         | ✅        | Inline fragments on Union types. (see https://github.com/liontariai/samarium/pull/5 for an example)                                                                                                                                         |
| Fragments           | ✅        | Fragments are supported. As implicit and explicit fragments, also parameterized fragments (see https://github.com/graphql/graphql-spec/issues/204) are supported. ( see https://github.com/liontariai/samarium/pull/6 for more information) |

Not yet implemented GraphQL features:

| Feature       | Supported | Description                      |
| ------------- | --------- | -------------------------------- |
| Directives    | ❌        | Directives are not supported.    |
| Subscriptions | ❌        | Subscriptions are not supported. |

### Planned utility features and their status:

| Feature                                 | Supported | Description                                                                                                                                                                       |
| --------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication                          | ✅        | Provide a way to authenticate the requests.                                                                                                                                       |
| Custom scalar types                     | ✅        | Support for custom scalar types, like Date, so that these scalars are deserialized upon using them in the code. (see https://github.com/liontariai/samarium/pull/3 for more info) |
| Lazy Queries                            | ❌        | Currently queries are sent directly, when the operation function is awaited.                                                                                                      |
| Lazy Mutations                          | ❌        | Currently mutations are sent directly, when the operation function is awaited.                                                                                                    |
| Shortcuts for selections                | ✅        | Provide helper functions to select all or specific fields of a type without writing them all out in the selection.                                                                |
| Combine separatly defined operations    | ❌        | Combine separatly defined operations into one request.                                                                                                                            |
| Combine multiple apis into one request  | ❌        | Combine multiple apis into one request.                                                                                                                                           |
| Resolve dependencies within one request | ❌        | Resolve dependencies within one request. So that the result of one operation can be used in another.                                                                              |

## Support the project

If you like the project, please consider giving it a star on GitHub. This helps to get the word out and to get more contributors on board.
