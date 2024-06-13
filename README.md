![](https://samarium.liontari.ai/assets/demo-CavLQwfh.gif)

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
