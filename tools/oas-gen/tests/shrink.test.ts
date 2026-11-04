import { describe, expect, it } from "bun:test";
import { generate, shrink, validate } from "../src/index.ts";
import { documentToJson } from "../src/ser/index.ts";

async function stillValid(spec: Parameters<typeof shrink>[0]) {
    const v = await validate(documentToJson(spec.ir), spec.meta.dialect);
    return v.acceptedAsValidFixture;
}

describe("shrink", () => {
    it("shrinking a valid doc stays valid and does not grow", async () => {
        const spec = generate({ seed: 3, dialect: "3.1", profile: "core-rest" });
        const shrunk = await shrink(spec, stillValid);
        const v = await validate(documentToJson(shrunk.ir), "3.1");
        expect(v.acceptedAsValidFixture).toBe(true);
        expect(shrunk.meta.bytes).toBeLessThanOrEqual(spec.meta.bytes);
        expect(shrunk.files["openapi.yaml"]).toBeDefined();
    });

    it("drops unused components while staying valid", async () => {
        const spec = generate({ seed: 1, dialect: "3.1", profile: "ref-graph" });
        expect(spec.ir.components?.schemas?.["Unused.Model"]).toBeDefined();
        const shrunk = await shrink(spec, stillValid);
        expect(await stillValid(shrunk)).toBe(true);
        expect(shrunk.ir.components?.schemas?.["Unused.Model"]).toBeUndefined();
    });

    it("pred false on input returns the (repacked) original", async () => {
        const spec = generate({ seed: 2, dialect: "3.0", profile: "minimal" });
        const shrunk = await shrink(spec, () => false);
        expect(shrunk.meta.hash).toBe(spec.meta.hash);
        expect(shrunk.meta.mutations).toEqual(spec.meta.mutations);
    });
});
