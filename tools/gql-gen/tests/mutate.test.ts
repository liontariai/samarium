import { describe, expect, it } from "bun:test";
import { generate, mutate } from "../src/generate.ts";
import { validate } from "../src/val/index.ts";

describe("mutate", () => {
    it("safe mutate + repair stays accepted", async () => {
        let rejected = 0;
        for (let seed = 0; seed < 40; seed++) {
            const base = generate({ seed, profile: "core-api" });
            const spec = mutate(base.ir, { seed: seed + 1000, n: 3, allowInvalid: false });
            const v = await validate(spec.ir);
            if (!v.acceptedAsValidFixture) rejected++;
        }
        expect(rejected).toBe(0);
    });

    it("messy profile records mutations", () => {
        const spec = generate({ seed: 4, profile: "messy" });
        expect(spec.meta.mutations.length).toBeGreaterThan(0);
    });

    it("mutation soak reject rate under 5% after repair", async () => {
        let rejected = 0;
        const n = 200;
        for (let seed = 0; seed < n; seed++) {
            const base = generate({ seed, profile: "type-system-heavy" });
            const spec = mutate(base.ir, { seed: seed + 50_000, n: 5, allowInvalid: false });
            const v = await validate(spec.ir);
            if (!v.acceptedAsValidFixture) rejected++;
        }
        expect(rejected / n).toBeLessThan(0.05);
    });
});
