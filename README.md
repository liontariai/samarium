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
<a href="https://liontari.ai/samarium/#playground">Online Playground</a> 
<span> · </span>
<a href="https://github.com/liontariai/samarium">GitHub</a> 
<span> · </span>
<a href="https://npmjs.com/package/@samarium.sdk/new">NPM</a>
<br />
<br />

[![GitHub last commit](https://img.shields.io/github/last-commit/liontariai/samarium)](https://github.com/liontariai/samarium/commits/main/)
[![NPM Version](https://img.shields.io/npm/v/%40samarium.sdk%2Fnew)](https://www.npmjs.com/package/@samarium.sdk/new)
[![NPM Downloads](https://img.shields.io/npm/dm/%40samarium.sdk%2Fnew)](https://www.npmjs.com/package/@samarium.sdk/new)

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

## Quickstart

#### 1. Compile the API to Typescript

```bash
npx @samarium.sdk/new # this will start the assistant ui
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

## Support the project

If you like the project, please consider giving it a star on GitHub. This helps to get the word out and to get more contributors on board.
You can also reach me on [x.com/liontariai](https://x.com/liontariai) for any questions or feedback.

## Feedback

Feedback is highly appreciated. Please open an issue if you have questions or suggestions!
