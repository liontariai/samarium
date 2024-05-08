[<img src="./docs/images/logo-round-shadow.png" style="display: block; margin: auto; " width="250"/>](./docs/images/logo-round-shadow.png)

# Samarium

No dependencies. No codegen steps. No graphql files. No IDE setup. No config files. No client boilerplate.

Just the contents of your apis. **Fully typesafe**.

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

## Usage

```bash
npx @liontari.ai/samarium generate <url> <output>
```

```bash
bunx @liontari.ai/samarium generate <url> <output>
```

```bash
yarn dlx @liontari.ai/samarium generate <url> <output>
```

```bash
pnpm dlx @liontari.ai/samarium generate <url> <output>
```
