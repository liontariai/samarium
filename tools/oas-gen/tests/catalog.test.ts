import { describe, expect, it } from "bun:test";
import { FEATURES, FEATURE_BY_ID } from "../src/catalog/features.ts";

describe("feature catalog", () => {
    it("has unique ids", () => {
        expect(FEATURE_BY_ID.size).toBe(FEATURES.length);
    });

    it("every feature lists at least one dialect", () => {
        for (const f of FEATURES) {
            expect(f.oas.length).toBeGreaterThan(0);
        }
    });

    it("implemented ids are phase 1–5", () => {
        const implemented = FEATURES.filter((f) => f.implemented);
        expect(implemented.length).toBeGreaterThan(20);
        for (const f of implemented) {
            expect(f.phase).toBeLessThanOrEqual(5);
        }
    });
});
