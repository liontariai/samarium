import { describe, expect, it } from "bun:test";
import { FEATURES, FEATURE_BY_ID, implementedFeatures } from "../src/catalog/index.ts";

describe("catalog", () => {
    it("has unique feature ids", () => {
        const ids = FEATURES.map((f) => f.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("FEATURE_BY_ID covers all", () => {
        for (const f of FEATURES) {
            expect(FEATURE_BY_ID.get(f.id)).toBe(f);
        }
    });

    it("most features are implemented", () => {
        expect(implementedFeatures().length).toBeGreaterThan(30);
    });
});
