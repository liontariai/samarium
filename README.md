<div style="display: flex; flex-direction: column; align-items: center; max-width: 830px; margin: 0 auto;">
<img src="https://github.com/liontariai/samarium/raw/main/docs/images/hero-image.jpg" alt="Samarium Hero Image" style="width: 830px;"/>
<br />
<div align="center"><strong>Samarium</strong></div>
<div align="center"><strong>The API to Typescript Compiler</strong></div>
<br />
<div align="center">Learning & writing GraphQL, setting up the IDE and managing types is annoying.
<br/>
<br/>
Not needed anymore. Compile the API to Typescript. 
<br/>Continue writing your code.
Done in 10s.</div>
<br />
<div align="center">
<a href="https://liontari.ai/#playground">Online Playground</a> 
<span> · </span>
<a href="https://github.com/liontariai/samarium">GitHub</a> 
<span> · </span>
<a href="https://npmjs.com/package/@liontari.ai/samarium">NPM</a>
<br />
<br />

[![GitHub last commit](https://img.shields.io/github/last-commit/liontariai/samarium)](https://github.com/liontariai/samarium/commits/main/)
[![NPM Version](https://img.shields.io/npm/v/%40liontari.ai%2Fsamarium)](https://www.npmjs.com/package/@liontari.ai/samarium)
[![NPM Downloads](https://img.shields.io/npm/dm/%40liontari.ai%2Fsamarium)](https://www.npmjs.com/package/@liontari.ai/samarium)

<hr/>
</div>

<div align="left">
<br/>
GraphQL is great, but it comes with a steep learning curve and a lot of boilerplate.

Nothing would be more convenient than just importing the API as Typescript SDK. Now you can.

## Quickstart

#### 1. Compile the API to Typescript

```bash
npx @liontari.ai/samarium # this will start the assistant ui
```

#### 2. Import the API as Typescript SDK

```typescript
import sdk from "./spacex"; // the file you created in the previous step
```

#### 3. Use the SDK

```typescript
const { first10Launches } = await sdk((op) =>
    op.query((q) => ({
        first10Launches: q.launches({ limit: 10 })(({ id }) => ({ id })),
    })),
);
```

## Documentation & Examples

**Documentation is available [here](https://github.com/liontariai/samarium/blob/main/docs/readme.md).**
<br/>
Additonally, you can take a look at the **examples in the [examples folder](https://github.com/liontariai/samarium/blob/main/examples)**.

If you are interested in the technical details, you can take a look at the [tests](https://github.com/liontariai/samarium/blob/main/src/lib/codegen/flavors/default/__tests__/features.test.ts).
<br/>
They are commented and cover all the features.

Also, feel free to open an issue if you need more examples or have questions.

## Try it in the browser

In the playground you can compile your own GraphQL API by providing the introspection endpoint.
It will fetch the schema, generate the sdk and load an editor with typescript.

You can execute the code and see console.log outputs, as well as the network requests.

**Note:** Right now the playground does not support authentication or headers.
The CLI will prompt you for the authentication if needed and allows for more customization.

[Online Playground is available here.](https://liontari.ai/#playground)

<a href="https://liontari.ai/#playground">
<img src="https://github.com/liontariai/samarium/raw/main/docs/images/playground.png" alt="Samarium Online Playground" style="width: 830px;"/>
</a>

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
| Directives          | ✅        | (Client) Directives are supported. Use the `$directives` helper functions and wrap your selected field.                                                                                                                                     |

Not yet implemented GraphQL features:

| Feature       | Supported | Description                                                                                                                                                                                                                                                                |
| ------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subscriptions | ❌        | Subscriptions are not supported right now, because no websocket client has been chosen yet. The query text itself could be generated, but executing it would require a websocket client and a nice way to execute it. If you are interested in this, please open an issue. |

### Utility features:

| Feature                  | Supported | Description                                                                                                                                                                                                                        |
| ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication           | ✅        | Provide a way to authenticate the requests.                                                                                                                                                                                        |
| Custom scalar types      | ✅        | Support for custom scalar types, like Date, so that these scalars are deserialized upon using them in the code. (see https://github.com/liontariai/samarium/pull/3 for more info)                                                  |
| Lazy Queries             | ✅        | Queries can be lazified into async functions, so that they are only executed when awaited. Just use the `.$lazy` property. Also, you can pass arguments to the lazy function. See https://github.com/liontariai/samarium/pull/10   |
| Lazy Mutations           | ✅        | Mutations can be lazified into async functions, so that they are only executed when awaited. Just use the `.$lazy` property. Also, you can pass arguments to the lazy function. See https://github.com/liontariai/samarium/pull/10 |
| Shortcuts for selections | ✅        | Provide helper functions to select all or specific fields of a type without writing them all out in the selection.                                                                                                                 |

## Support the project

If you like the project, please consider giving it a star on GitHub. This helps to get the word out and to get more contributors on board.
You can also reach me on [x.com/liontariai](https://x.com/liontariai) for any questions or feedback.

## Feedback

Feedback is highly appreciated. Please open an issue if you have questions or suggestions!
