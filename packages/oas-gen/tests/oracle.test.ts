import { describe, expect, it } from "bun:test";
import { generate, oracle, compileSpec, shrink, validate } from "../src/index.ts";
import { documentToJson } from "../src/ser/index.ts";
import type { Dialect, Profile } from "../src/types.ts";

const CORE: Profile[] = ["minimal", "core-rest"];
const COMPILE_OK: Profile[] = [
    "minimal",
    "core-rest",
    "param-matrix",
    "media-matrix",
    "security-matrix",
    "callback-webhook",
];

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

    it("non-cyclic profiles compile (10 seeds)", async () => {
        for (const profile of COMPILE_OK) {
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
    }, 120_000);

    it("schema-heavy cyclic crash shrinks to a still-valid smaller repro", async () => {
        const spec = generate({ seed: 0, dialect: "3.0", profile: "schema-heavy", size: "s" });
        const before = await compileSpec(spec);
        expect(before.crashed).toBe(true);

        const shrunk = await shrink(
            spec,
            async (d) => !(await compileSpec(d)).ok,
            { maxSteps: 6 },
        );
        const after = await compileSpec(shrunk);
        expect(after.ok).toBe(false);

        const v = await validate(documentToJson(shrunk.ir), "3.0");
        expect(v.acceptedAsValidFixture).toBe(true);
        expect(shrunk.meta.bytes).toBeLessThan(spec.meta.bytes);
        const lines = (shrunk.files["openapi.yaml"] ?? "").split("\n").length;
        expect(lines).toBeLessThan(200);
    }, 30_000);
});
