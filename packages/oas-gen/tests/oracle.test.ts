import { describe, expect, it } from "bun:test";
import { generate, oracle, compileSpec, validate } from "../src/index.ts";
import { documentToJson } from "../src/ser/index.ts";
import { PHASE5_PROFILES } from "../src/catalog/features.ts";
import type { Dialect, Profile } from "../src/types.ts";

const CORE: Profile[] = ["minimal", "core-rest"];
const PREVIOUSLY_CRASHY: Profile[] = ["schema-heavy", "ref-graph", "multi-file", "messy"];

describe("samarium oracle", () => {
    it("minimal + core-rest seeds 0-49 compile and typecheck", async () => {
        for (const profile of CORE) {
            for (const dialect of ["3.0", "3.1"] as Dialect[]) {
                for (let seed = 0; seed < 50; seed++) {
                    const spec = generate({ seed, profile, dialect });
                    const r = await oracle(spec);
                    if (!r.ok) {
                        console.error(
                            profile,
                            dialect,
                            seed,
                            r.compile.error?.split("\n")[0],
                            r.typecheck.errors.slice(0, 3),
                        );
                    }
                    expect(r.compile.crashed).toBe(false);
                    expect(r.ok).toBe(true);
                }
            }
        }
    }, 180_000);

    it("all PHASE5 profiles compile without crash (10 seeds)", async () => {
        for (const profile of PHASE5_PROFILES) {
            for (const dialect of ["3.0", "3.1"] as Dialect[]) {
                for (let seed = 0; seed < 10; seed++) {
                    const spec = generate({ seed, profile, dialect });
                    const r = await compileSpec(spec);
                    if (!r.ok) {
                        console.error(profile, dialect, seed, r.error?.split("\n")[0]);
                    }
                    expect(r.crashed).toBe(false);
                    expect(r.ok).toBe(true);
                }
            }
        }
    }, 300_000);

    it("previously crashy cyclic profiles compile and typecheck (5 seeds)", async () => {
        for (const profile of PREVIOUSLY_CRASHY) {
            for (const dialect of ["3.0", "3.1"] as Dialect[]) {
                for (let seed = 0; seed < 5; seed++) {
                    const spec = generate({ seed, profile, dialect, size: "s" });
                    const r = await oracle(spec);
                    if (!r.ok) {
                        console.error(
                            profile,
                            dialect,
                            seed,
                            r.compile.error?.split("\n")[0],
                            r.typecheck.errors.slice(0, 3),
                        );
                    }
                    expect(r.compile.crashed).toBe(false);
                    expect(r.compile.ok).toBe(true);
                    expect(r.typecheck.ok).toBe(true);
                }
            }
        }
    }, 180_000);

    it("schema-heavy cyclic specs stay valid OAS after generate", async () => {
        const spec = generate({ seed: 0, dialect: "3.0", profile: "schema-heavy", size: "s" });
        const compiled = await compileSpec(spec);
        expect(compiled.crashed).toBe(false);
        expect(compiled.ok).toBe(true);

        const v = await validate(documentToJson(spec.ir), "3.0");
        expect(v.acceptedAsValidFixture).toBe(true);
    }, 30_000);
});
