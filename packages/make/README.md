<div style="display: flex; flex-direction: column; align-items: center; max-width: 830px; margin: 0 auto;">
<img src="https://github.com/liontariai/samarium/raw/main/docs/images/hero-image.jpg" alt="Samarium Hero Image" style="width: 830px;"/>
<br />
<div align="center"><strong>Samarium</strong></div>
<div align="center"><strong>The universal API to Typescript Compiler</strong></div>
<br />
<div align="center">
Imagine having all APIs at your disposal, as if it was your local code.
<br/>
<br/>
Compile any API to Typescript and then use it as fully typed SDK.
<br/>
It's done in 10s and you'll never bother with GraphQL or clumsy OpenAPI fetch wrappers again.
</div>
<br />
<div align="center">
<a href="https://liontari.ai/#playground">Online Playground</a> 
<span> · </span>
<a href="https://github.com/liontariai/samarium">GitHub</a> 
<span> · </span>
<a href="https://npmjs.com/package/@samarium.sdk/make">NPM</a>
<br />
<br />

[![GitHub last commit](https://img.shields.io/github/last-commit/liontariai/samarium)](https://github.com/liontariai/samarium/commits/main/)
[![NPM Version](https://img.shields.io/npm/v/%40samarium.sdk%2Fmake)](https://www.npmjs.com/package/@samarium.sdk/make)
[![NPM Downloads](https://img.shields.io/npm/dm/%40samarium.sdk%2Fmake)](https://www.npmjs.com/package/@samarium.sdk/make)

<hr/>
</div>

<div align="justify">
<br/>
APIs expose interfaces, so developers don't have to worry about the implementation details.
<br/>
That's great, but you still have to handle the details of the communication. Be it GraphQL or REST.
<br/>
<br/>
We are so used to our Typescript & Copilot autocomplete heaven,
<br/>
that it would be absolute dreamland if we could just use all APIs in the same way, like local code.
<br/>
<br/>
Well, welcome to dreamland. Introducing: <strong>The universal API to Typescript compiler, Samarium</strong>.

## Using the Samarium Compiler programatically

#### 1. Install the compiler package

```bash
bun install @samarium.sdk/make
```

#### 2. Import the compiler

```typescript
import {
    GraphQLGenerator,
    OpenAPIGenerator,
    Flavors,
} from "@samarium.sdk/make";
```

#### 3. Use the compiler

#### GraphQL

```typescript
const sdk = await new GraphQLGenerator.Generator(
    Flavors.GraphQL.default,
).generate({
    schema: gqlSchema,
    options: {},
});

// write the sdk to a file and set the endpoint (manual step right now)
Bun.write(
    Bun.file("sdk.ts"),
    sdk.replace("[ENDPOINT]", "http://localhost:4000"),
);
```

#### OpenAPI

```typescript
const sdk = await new OpenAPIGenerator.Generator(
    Flavors.OpenAPI.default,
).generate({
    schema: schema, // the openapi json schema
    options: {},
});

// write the sdk to a file and set the endpoint (manual step right now)
Bun.write(
    Bun.file("sdk.ts"),
    sdk.replace("[ENDPOINT]", "http://localhost:4000"),
);
```

## Support the project

If you like the project, please consider giving it a star on GitHub. This helps to get the word out and to get more contributors on board.
You can also reach me on [x.com/liontariai](https://x.com/liontariai) for any questions or feedback.

## Feedback

Feedback is highly appreciated. Please open an issue if you have questions or suggestions!
