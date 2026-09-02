import { describe, expect, it } from "bun:test";
import { generate } from "../src/generate.ts";
import { validate } from "../src/val/index.ts";
import { coverage } from "../src/cov/index.ts";
import { documentToJson } from "../src/ser/index.ts";
import type { Dialect, Profile } from "../src/types.ts";

const SEEDS = 100;

async function runGauntlet(profile: Profile, dialect: Dialect) {
    let rejected = 0;
    const reasons: string[] = [];
    const docs = [];
    for (let seed = 0; seed < SEEDS; seed++) {
        const spec = generate({ seed, profile, dialect });
        docs.push(spec);
        const verdict = await validate(documentToJson(spec.ir), dialect);
        if (!verdict.acceptedAsValidFixture) {
            rejected++;
            reasons.push(
                `seed=${seed} ${dialect} ${profile} official=${verdict.officialSchema.ok} semantic=${verdict.semantic.ok} deref=${verdict.dereference.ok}` +
                    (verdict.semantic.errors[0] ? ` ${verdict.semantic.errors[0].code}: ${verdict.semantic.errors[0].message}` : "") +
                    (verdict.officialSchema.errors[0] ? ` schema=${JSON.stringify(verdict.officialSchema.errors[0])}` : ""),
            );
        }
    }
    return { rejected, reasons, docs };
}

describe("gauntlet seeds 0-99", () => {
    for (const profile of ["minimal", "core-rest"] as const) {
        for (const dialect of ["3.0", "3.1"] as const) {
            it(`${profile} ${dialect} reject rate < 5%`, async () => {
                const { rejected, reasons } = await runGauntlet(profile, dialect);
                if (rejected) {
                    console.error(reasons.slice(0, 8).join("\n"));
                }
                expect(rejected / SEEDS).toBeLessThan(0.05);
                expect(rejected).toBe(0);
            });
        }
    }

    it("prints Phase 1 coverage for seeds 0-99 core-rest mixed dialects", () => {
        const docs = [];
        for (let seed = 0; seed < SEEDS; seed++) {
            docs.push(generate({ seed, profile: "core-rest" }));
        }
        const report = coverage(docs);
        const implemented = report.byFeature.filter((c) => c.implemented);
        const missing = implemented.filter((c) => c.observed === 0).map((c) => c.id);
        console.log(
            `core-rest seeds 0-99: observed ${implemented.filter((c) => c.observed > 0).length}/${implemented.length} implemented features` +
                (missing.length ? `; missing: ${missing.join(", ")}` : ""),
        );
        expect(report.observed).toBeGreaterThan(15);
    });
});
