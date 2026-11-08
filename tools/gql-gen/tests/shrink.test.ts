import { describe, expect, it } from "bun:test";
import { generate, shrink } from "../src/generate.ts";
import { validate } from "../src/val/index.ts";

describe("shrink", () => {
    it("shrink while remaining valid yields accepted fixture", async () => {
        const spec = generate({ seed: 12, profile: "type-system-heavy" });
        const shrunk = await shrink(spec, async (d) => {
            const v = await validate(d.ir);
            return v.acceptedAsValidFixture;
        }, { maxSteps: 20 });
        const v = await validate(shrunk.ir);
        expect(v.acceptedAsValidFixture).toBe(true);
        expect(shrunk.files["schema.graphql"]!.length).toBeGreaterThan(10);
    });
});
