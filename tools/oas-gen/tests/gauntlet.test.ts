import { describe, expect, it } from "bun:test";
import { generate, mutate } from "../src/generate.ts";
import { validate } from "../src/val/index.ts";
import { coverage } from "../src/cov/index.ts";
import { documentToJson, bundleFiles } from "../src/ser/index.ts";
import { FEATURES } from "../src/catalog/features.ts";
import type { Dialect, Profile } from "../src/types.ts";

async function runGauntlet(profile: Profile, dialect: Dialect, seeds: number) {
    let rejected = 0;
    const reasons: string[] = [];
    for (let seed = 0; seed < seeds; seed++) {
        const spec = generate({ seed, profile, dialect });
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
    return { rejected, reasons };
}

describe("gauntlet", () => {
    for (const profile of ["minimal", "core-rest"] as const) {
        for (const dialect of ["3.0", "3.1"] as const) {
            it(`${profile} ${dialect} seeds 0-99 reject rate 0`, async () => {
                const { rejected, reasons } = await runGauntlet(profile, dialect, 100);
                if (rejected) console.error(reasons.slice(0, 8).join("\n"));
                expect(rejected).toBe(0);
            });
        }
    }

    for (const profile of ["schema-heavy", "param-matrix", "media-matrix"] as const) {
        for (const dialect of ["3.0", "3.1"] as const) {
            it(`${profile} ${dialect} seeds 0-49 reject rate 0`, async () => {
                const { rejected, reasons } = await runGauntlet(profile, dialect, 50);
                if (rejected) console.error(reasons.slice(0, 8).join("\n"));
                expect(rejected).toBe(0);
            });
        }
    }

    for (const profile of ["security-matrix", "callback-webhook"] as const) {
        for (const dialect of ["3.0", "3.1"] as const) {
            it(`${profile} ${dialect} seeds 0-49 reject rate 0`, async () => {
                const { rejected, reasons } = await runGauntlet(profile, dialect, 50);
                if (rejected) console.error(reasons.slice(0, 8).join("\n"));
                expect(rejected).toBe(0);
            });
        }
    }

    it("Phase 2 catalog features are observed across profiles", () => {
        const docs = [];
        for (const profile of ["schema-heavy", "param-matrix", "media-matrix"] as const) {
            for (const dialect of ["3.0", "3.1"] as const) {
                for (let seed = 0; seed < 15; seed++) {
                    docs.push(generate({ seed, profile, dialect }));
                }
            }
        }
        const report = coverage(docs);
        const implementedIds = new Set(FEATURES.filter((f) => f.implemented && f.phase === 2).map((f) => f.id));
        const implemented = report.byFeature.filter((c) => implementedIds.has(c.id));
        const missing = implemented.filter((c) => c.observed === 0).map((c) => c.id);
        console.log(
            `phase2 mix: observed ${implemented.filter((c) => c.observed > 0).length}/${implemented.length}` +
                (missing.length ? `; missing: ${missing.join(", ")}` : ""),
        );
        expect(missing).toEqual([]);
    });

    it("Phase 3 catalog features are observed across profiles", () => {
        const docs = [];
        for (const profile of ["security-matrix", "callback-webhook"] as const) {
            for (const dialect of ["3.0", "3.1"] as const) {
                for (let seed = 0; seed < 10; seed++) {
                    docs.push(generate({ seed, profile, dialect }));
                }
            }
        }
        const report = coverage(docs);
        const implementedIds = new Set(FEATURES.filter((f) => f.implemented && f.phase === 3).map((f) => f.id));
        const implemented = report.byFeature.filter((c) => implementedIds.has(c.id));
        const missing = implemented.filter((c) => c.observed === 0).map((c) => c.id);
        console.log(
            `phase3 mix: observed ${implemented.filter((c) => c.observed > 0).length}/${implemented.length}` +
                (missing.length ? `; missing: ${missing.join(", ")}` : ""),
        );
        expect(missing).toEqual([]);
    });

    for (const dialect of ["3.0", "3.1"] as const) {
        it(`messy ${dialect} seeds 0-49 reject rate 0`, async () => {
            const { rejected, reasons } = await runGauntlet("messy", dialect, 50);
            if (rejected) console.error(reasons.slice(0, 8).join("\n"));
            expect(rejected).toBe(0);
        });
    }

    it("Phase 4 catalog features are observed via mutate", () => {
        const docs = [];
        for (const dialect of ["3.0", "3.1"] as const) {
            for (let seed = 0; seed < 20; seed++) {
                const base = generate({ seed, dialect, profile: "core-rest" });
                docs.push(mutate(base, { seed: seed + 50, n: 8 }));
                docs.push(generate({ seed, dialect, profile: "messy" }));
            }
        }
        const report = coverage(docs);
        const implementedIds = new Set(FEATURES.filter((f) => f.implemented && f.phase === 4).map((f) => f.id));
        const implemented = report.byFeature.filter((c) => implementedIds.has(c.id));
        const missing = implemented.filter((c) => c.observed === 0).map((c) => c.id);
        console.log(
            `phase4 mix: observed ${implemented.filter((c) => c.observed > 0).length}/${implemented.length}` +
                (missing.length ? `; missing: ${missing.join(", ")}` : ""),
        );
        expect(missing).toEqual([]);
    });

    for (const dialect of ["3.0", "3.1"] as const) {
        it(`ref-graph ${dialect} seeds 0-49 reject rate 0`, async () => {
            let rejected = 0;
            const reasons: string[] = [];
            for (let seed = 0; seed < 50; seed++) {
                const spec = generate({ seed, profile: "ref-graph", dialect });
                const text = spec.files["openapi.yaml"] ?? spec.files["openapi.json"]!;
                const verdict = await validate(text, dialect);
                if (!verdict.acceptedAsValidFixture) {
                    rejected++;
                    reasons.push(
                        `seed=${seed} ${dialect} official=${verdict.officialSchema.ok} semantic=${verdict.semantic.ok} deref=${verdict.dereference.ok}` +
                            (verdict.semantic.errors[0] ? ` ${verdict.semantic.errors[0].code}: ${verdict.semantic.errors[0].message}` : "") +
                            (verdict.officialSchema.errors[0] ? ` schema=${JSON.stringify(verdict.officialSchema.errors[0])}` : ""),
                    );
                }
            }
            if (rejected) console.error(reasons.slice(0, 8).join("\n"));
            expect(rejected).toBe(0);
        });
    }

    for (const dialect of ["3.0", "3.1"] as const) {
        it(`multi-file ${dialect} seeds 0-49 reject rate 0`, async () => {
            let rejected = 0;
            const reasons: string[] = [];
            for (let seed = 0; seed < 50; seed++) {
                const spec = generate({ seed, profile: "multi-file", dialect, keyOrder: "stable" });
                const bundled = bundleFiles(spec.files);
                const verdict = await validate(bundled, dialect);
                if (!verdict.acceptedAsValidFixture) {
                    rejected++;
                    reasons.push(
                        `seed=${seed} ${dialect} official=${verdict.officialSchema.ok} semantic=${verdict.semantic.ok} deref=${verdict.dereference.ok}` +
                            (verdict.semantic.errors[0] ? ` ${verdict.semantic.errors[0].code}: ${verdict.semantic.errors[0].message}` : "") +
                            (verdict.officialSchema.errors[0] ? ` schema=${JSON.stringify(verdict.officialSchema.errors[0])}` : ""),
                    );
                }
            }
            if (rejected) console.error(reasons.slice(0, 8).join("\n"));
            expect(rejected).toBe(0);
        });
    }

    it("Phase 5 catalog features are observed across ref-graph and multi-file", () => {
        const docs = [];
        for (const dialect of ["3.0", "3.1"] as const) {
            for (let seed = 0; seed < 12; seed++) {
                docs.push(generate({ seed, dialect, profile: "ref-graph" }));
                docs.push(generate({ seed, dialect, profile: "multi-file" }));
            }
        }
        const report = coverage(docs);
        const implementedIds = new Set(FEATURES.filter((f) => f.implemented && f.phase === 5).map((f) => f.id));
        const implemented = report.byFeature.filter((c) => implementedIds.has(c.id));
        const missing = implemented.filter((c) => c.observed === 0).map((c) => c.id);
        console.log(
            `phase5 mix: observed ${implemented.filter((c) => c.observed > 0).length}/${implemented.length}` +
                (missing.length ? `; missing: ${missing.join(", ")}` : ""),
        );
        expect(missing).toEqual([]);
    });
});
