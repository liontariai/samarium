import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generate } from "../src/generate.ts";
import { compileSpec, oracle } from "../src/oracle/index.ts";
import { hashText } from "../src/hash.ts";
import type { GeneratedSpec } from "../src/types.ts";

const CORPUS = join(import.meta.dir, "../vendor/corpus");

function sdlSpec(sdl: string, seed = 0): GeneratedSpec {
    return {
        ir: { types: [], directives: [], schema: { query: "Query" } },
        files: { "schema.graphql": sdl },
        meta: {
            seed,
            profile: "minimal",
            resolvedProfile: "minimal",
            size: "xs",
            features: [],
            mutations: [],
            bytes: sdl.length,
            hash: hashText(sdl),
        },
    };
}

describe("oracle", () => {
    it("compiles minimal generated schema", async () => {
        const spec = generate({ seed: 1, profile: "minimal" });
        const verdict = await oracle(spec, { typecheck: true });
        expect(verdict.compile.ok).toBe(true);
        expect(verdict.compile.crashed).toBe(false);
        expect(verdict.typecheck.ok).toBe(true);
        expect(verdict.ok).toBe(true);
    });

    it("compiles core-api", async () => {
        const spec = generate({ seed: 2, profile: "core-api" });
        const r = await compileSpec(spec);
        expect(r.ok).toBe(true);
    });

    for (const name of ["books", "unions", "directives", "custom-scalars"] as const) {
        it(`compiles vendor corpus ${name}`, async () => {
            const sdl = await readFile(join(CORPUS, `${name}.graphql`), "utf8");
            const r = await compileSpec(sdlSpec(sdl));
            expect(r.ok).toBe(true);
            expect(r.crashed).toBe(false);
        });
    }
});
