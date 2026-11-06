import { describe, expect, it } from "bun:test";
import { generate } from "../src/generate.ts";
import { validate } from "../src/val/index.ts";

describe("combinators", () => {
    it("minimal is deterministic", () => {
        const a = generate({ seed: 7, profile: "minimal" });
        const b = generate({ seed: 7, profile: "minimal" });
        expect(a.files["schema.graphql"]).toBe(b.files["schema.graphql"]);
        expect(a.meta.hash).toBe(b.meta.hash);
    });

    it("core-api has Query and an enum", async () => {
        const spec = generate({ seed: 3, profile: "core-api" });
        expect(spec.ir.schema?.query).toBe("Query");
        expect(spec.ir.types.some((t) => t.kind === "enum")).toBe(true);
        const v = await validate(spec.ir);
        expect(v.acceptedAsValidFixture).toBe(true);
    });

    it("type-system-heavy has interface, union, input, mutation", () => {
        const spec = generate({ seed: 11, profile: "type-system-heavy" });
        expect(spec.ir.types.some((t) => t.kind === "interface")).toBe(true);
        expect(spec.ir.types.some((t) => t.kind === "union")).toBe(true);
        expect(spec.ir.types.some((t) => t.kind === "inputObject")).toBe(true);
        expect(spec.ir.schema?.mutation).toBeTruthy();
    });

    it("full-random records resolvedProfile", () => {
        const spec = generate({ seed: 99, profile: "full-random" });
        expect(spec.meta.profile).toBe("full-random");
        expect(spec.meta.resolvedProfile).not.toBe("full-random");
    });

    it("subscription-root sets subscription", () => {
        const spec = generate({ seed: 5, profile: "subscription-root" });
        expect(spec.meta.features).toContain("root.subscription");
        expect(spec.ir.schema?.subscription).toBeTruthy();
    });
});
