# `@samarium.sdk/gql-gen`

Seeded GraphQL **schema** generator for Samarium coverage, soak, and shrink testing.

This tool does **not** generate SDKs. It generates valid GraphQL schemas (SDL) so
`GraphQLGenerator` can be coverage-tested and soak-tested beyond checked-in fixtures.

## Quick start

```bash
bun install
bun tools/gql-gen/src/cli.ts generate --seed 1 --profile core-api --out ./out
bun tools/gql-gen/src/cli.ts validate --in ./out/schema.graphql
bun tools/gql-gen/src/cli.ts soak --minutes 1 --oracle samarium --profile full-random --out ./repro
```

## Profiles

| Profile | Intent |
|---------|--------|
| `minimal` | One Query field → String |
| `core-api` | Objects, lists, args, non-null, enums |
| `type-system-heavy` | Interfaces, unions, inputs, `@oneOf`, cycles, custom scalars |
| `directive-matrix` | Custom + builtin directives |
| `subscription-root` | Subscription operation type |
| `messy` | Safe mutations + repair |
| `cyclic-types` | Explicit object cycles |
| `schema-extensions` | `extend type` / `extend schema` |
| `full-random` | Pick an implemented profile + size |

## Oracle

Compile with Samarium’s live GraphQL generator, then critical TypeScript diagnostics:

```ts
import { generate, oracle } from "@samarium.sdk/gql-gen";

const spec = generate({ seed: 42, profile: "full-random" });
const verdict = await oracle(spec);
```
