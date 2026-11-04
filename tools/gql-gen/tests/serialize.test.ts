import { describe, expect, it } from "bun:test";
import { parse } from "graphql";
import { generate } from "../src/generate.ts";
import { toSdl } from "../src/ser/index.ts";

describe("serialize", () => {
    it("SDL parses for all phase-1/2 profiles", () => {
        for (const profile of ["minimal", "core-api", "type-system-heavy"] as const) {
            for (let seed = 0; seed < 10; seed++) {
                const spec = generate({ seed, profile });
                expect(() => parse(spec.files["schema.graphql"]!)).not.toThrow();
                expect(toSdl(spec.ir)).toContain("type ");
            }
        }
    });
});
