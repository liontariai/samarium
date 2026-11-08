import { describe, expect, it } from "bun:test";
import { generate } from "../src/generate.ts";
import { validate } from "../src/val/index.ts";
import { coverage } from "../src/cov/index.ts";
import { FEATURES } from "../src/catalog/features.ts";
import type { Profile } from "../src/types.ts";

async function runGauntlet(profile: Profile, seeds: number) {
    let rejected = 0;
    const reasons: string[] = [];
    for (let seed = 0; seed < seeds; seed++) {
        const spec = generate({ seed, profile });
        const verdict = await validate(spec.ir);
        if (!verdict.acceptedAsValidFixture) {
            rejected++;
            reasons.push(
                `seed=${seed} ${profile} structural=${verdict.structural.ok} semantic=${verdict.semantic.ok}` +
                    (verdict.semantic.errors[0]
                        ? ` ${verdict.semantic.errors[0].code}: ${verdict.semantic.errors[0].message}`
                        : "") +
                    (verdict.structural.errors[0] ? ` struct=${JSON.stringify(verdict.structural.errors[0])}` : ""),
            );
        }
    }
    return { rejected, reasons };
}

describe("gauntlet", () => {
    for (const profile of ["minimal", "core-api"] as const) {
        it(`${profile} seeds 0-99 reject rate 0`, async () => {
            const { rejected, reasons } = await runGauntlet(profile, 100);
            if (rejected) console.error(reasons.slice(0, 8).join("\n"));
            expect(rejected).toBe(0);
        });
    }

    for (const profile of ["type-system-heavy", "directive-matrix", "subscription-root"] as const) {
        it(`${profile} seeds 0-49 reject rate 0`, async () => {
            const { rejected, reasons } = await runGauntlet(profile, 50);
            if (rejected) console.error(reasons.slice(0, 8).join("\n"));
            expect(rejected).toBe(0);
        });
    }

    for (const profile of ["cyclic-types", "schema-extensions", "messy"] as const) {
        it(`${profile} seeds 0-49 reject rate 0`, async () => {
            const { rejected, reasons } = await runGauntlet(profile, 50);
            if (rejected) console.error(reasons.slice(0, 8).join("\n"));
            expect(rejected).toBe(0);
        });
    }

    it("Phase 1 catalog features are observed", () => {
        const docs = [];
        for (const profile of ["minimal", "core-api"] as const) {
            for (let seed = 0; seed < 30; seed++) docs.push(generate({ seed, profile }));
        }
        const report = coverage(docs);
        const ids = new Set(FEATURES.filter((f) => f.implemented && f.phase === 1).map((f) => f.id));
        const missing = report.byFeature.filter((c) => ids.has(c.id) && c.observed === 0).map((c) => c.id);
        expect(missing).toEqual([]);
    });

    it("Phase 2 catalog features are observed", () => {
        const docs = [];
        for (let seed = 0; seed < 40; seed++) docs.push(generate({ seed, profile: "type-system-heavy" }));
        const report = coverage(docs);
        const ids = new Set(FEATURES.filter((f) => f.implemented && f.phase === 2).map((f) => f.id));
        const missing = report.byFeature.filter((c) => ids.has(c.id) && c.observed === 0).map((c) => c.id);
        if (missing.length) console.error("phase2 missing", missing);
        expect(missing).toEqual([]);
    });

    it("Phase 3 catalog features are observed", () => {
        const docs = [];
        for (const profile of ["directive-matrix", "subscription-root"] as const) {
            for (let seed = 0; seed < 30; seed++) docs.push(generate({ seed, profile }));
        }
        const report = coverage(docs);
        const ids = new Set(FEATURES.filter((f) => f.implemented && f.phase === 3).map((f) => f.id));
        const missing = report.byFeature.filter((c) => ids.has(c.id) && c.observed === 0).map((c) => c.id);
        if (missing.length) console.error("phase3 missing", missing);
        expect(missing).toEqual([]);
    });
});
