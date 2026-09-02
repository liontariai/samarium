# @samarium.sdk/oas-gen

Seeded generator of **OpenAPI documents** (the specs themselves, not request payloads) so Samarium’s OpenAPI compiler can be coverage-tested instead of fixture-tested.

This is **Phase 1**: catalog, typed IR, `minimal` / `core-rest` profiles, repair, official JSON Schema + semantic validation, CLI `generate` / `validate`.

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

### Profiles (Phase 1)

| Profile | Intent |
|---|---|
| `minimal` | Smallest legal doc: info + one GET + 200 `text/plain` |
| `core-rest` | CRUD, JSON objects, path+query params, 4xx, bearer auth |

Later: `schema-heavy`, `param-matrix`, `media-matrix`, `security-matrix`, `callback-webhook`, `ref-graph`, `multi-file`, `messy`, `full-random`, `invalid-*`.

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
```
