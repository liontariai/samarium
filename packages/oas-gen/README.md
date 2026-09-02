# @samarium.sdk/oas-gen

Seeded generator of **OpenAPI documents** (the specs themselves, not request payloads) so Samarium’s OpenAPI compiler can be coverage-tested instead of fixture-tested.

This is **Phase 3**: security schemes (apiKey/http/oauth2/OIDC/mTLS), requirement OR/AND/optional, links, callbacks, and OAS 3.1 webhooks.

## Validity layers

A document is an accepted fixture only if it passes:

| Layer | What |
|---|---|
| A Syntax | Parseable JSON or YAML |
| B Structural | Official OAS JSON Schema (vendored under `vendor/oas-schemas/`) |
| C Semantic | Path params vs `{templates}`, `$ref` targets, security names, dialect keywords, … |
| D Tool | Internal dereference (+ `@apidevtools/swagger-parser` when it loads; disagreements are kept and tagged) |

The 3.1 official `schema/` document does **not** fully validate Schema Objects. Layer C covers those rules.

## Generate

```ts
import { generate, validate, stream, coverage } from "@samarium.sdk/oas-gen";

const spec = generate({ seed: 42, dialect: "3.1", profile: "core-rest", size: "s" });
const verdict = await validate(spec.files["openapi.yaml"], "3.1");
```

Deterministic given `{ seed, dialect, profile, size }`.

### CLI

```
bun packages/oas-gen/src/cli.ts generate --seed 42 --dialect 3.1 --profile core-rest --out ./out
bun packages/oas-gen/src/cli.ts validate --in ./out/openapi.yaml
bun packages/oas-gen/src/cli.ts coverage --seeds 100 --profile core-rest
```

### Profiles

| Profile | Intent |
|---|---|
| `minimal` | Smallest legal doc: info + one GET + 200 `text/plain` |
| `core-rest` | CRUD, JSON objects, path+query params, 4xx, bearer auth |
| `schema-heavy` | Formats, enum/const, composition, discriminator, cycles, 3.0/3.1 dialect keywords |
| `param-matrix` | All legal `in` × `style` × `explode` cells + header/cookie + content |
| `media-matrix` | multipart (+ encoding), urlencoded, xml, octet-stream, multi-content |
| `security-matrix` | apiKey (header/query/cookie), HTTP basic/bearer/digest, OAuth2 (all flows), OIDC, 3.1 mTLS; OR / AND / optional |
| `callback-webhook` | Response links (`operationId` XOR `operationRef` + runtime expressions), callbacks, 3.1 webhooks + `components.pathItems` |

Identifiers (resources, properties, query/path/header names) are sampled from a seeded lexicon in `src/lexicon/`, not hardcoded `limit`/`q`. Later: `ref-graph`, `multi-file`, `messy`, `full-random`, `invalid-*`.

`mutate()` and `shrink()` throw until Phase 4 / 6.

## Adding a feature atom

1. Add an entry to `src/catalog/features.ts` (`id`, `oas`, `object`, `keywords`, `weight`, `samariumRelevance`).
2. Emit it from a combinator in `src/gen/` and `mark(ctx, id)`.
3. Set `implemented: true` and `phase` when the combinator lands.
4. Unit-test the invariant (e.g. path params always `required: true`).
5. Coverage report should observe the id at least once per supported dialect.

## Repo map (Samarium)

OpenAPI **compile** lives in `packages/make/src/openapi` (`OpenAPIGenerator.Generator`, `openapi-typescript` types). CLI: `packages/new` `generate-openapi`. This package is a standalone toolkit with a thin oracle adapter still to come (Phase 6).

## Tests

```
cd packages/oas-gen && bun test
bun tests/phase1-report.ts
bun tests/phase2-report.ts
bun tests/phase3-report.ts
```
