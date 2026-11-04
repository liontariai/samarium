/**
 * Phase 5 report: ref-graph + multi-file reject-rate and coverage.
 * bun tests/phase5-report.ts
 */
import { generate } from "../src/generate.ts";
import { validate } from "../src/val/index.ts";
import { coverage } from "../src/cov/index.ts";
import { bundleFiles } from "../src/ser/index.ts";
import { FEATURES } from "../src/catalog/features.ts";
import type { Dialect } from "../src/types.ts";

const SEEDS = 50;

async function main() {
    const all = [];
    console.log("Phase 5 reject-rate (seeds 0–49)\n");
    console.log("| profile | dialect | rejected | rate |");
    console.log("|---|---|---|---|");

    for (const dialect of ["3.0", "3.1"] as Dialect[]) {
        let rejected = 0;
        const sample: string[] = [];
        for (let seed = 0; seed < SEEDS; seed++) {
            const spec = generate({ seed, profile: "ref-graph", dialect });
            all.push(spec);
            const text = spec.files["openapi.yaml"] ?? spec.files["openapi.json"]!;
            const v = await validate(text, dialect);
            if (!v.acceptedAsValidFixture) {
                rejected++;
                if (sample.length < 3) {
                    sample.push(
                        `  seed ${seed}: official=${v.officialSchema.ok} semantic=${v.semantic.ok} deref=${v.dereference.ok}` +
                            (v.semantic.errors[0] ? ` ${v.semantic.errors[0].message}` : ""),
                    );
                }
            }
        }
        console.log(`| ref-graph | ${dialect} | ${rejected}/${SEEDS} | ${((rejected / SEEDS) * 100).toFixed(1)}% |`);
        if (sample.length) console.log(sample.join("\n"));
    }

    for (const dialect of ["3.0", "3.1"] as Dialect[]) {
        let rejected = 0;
        const sample: string[] = [];
        for (let seed = 0; seed < SEEDS; seed++) {
            const spec = generate({ seed, profile: "multi-file", dialect });
            all.push(spec);
            const v = await validate(bundleFiles(spec.files), dialect);
            if (!v.acceptedAsValidFixture) {
                rejected++;
                if (sample.length < 3) {
                    sample.push(
                        `  seed ${seed}: official=${v.officialSchema.ok} semantic=${v.semantic.ok} deref=${v.dereference.ok}` +
                            (v.semantic.errors[0] ? ` ${v.semantic.errors[0].message}` : ""),
                    );
                }
            }
        }
        console.log(`| multi-file | ${dialect} | ${rejected}/${SEEDS} | ${((rejected / SEEDS) * 100).toFixed(1)}% |`);
        if (sample.length) console.log(sample.join("\n"));
    }

    const report = coverage(all);
    const implemented = report.byFeature.filter((c) => FEATURES.find((f) => f.id === c.id)?.phase === 5 && c.implemented);
    const missing = implemented.filter((c) => c.observed === 0).map((c) => c.id);
    console.log(
        `\nphase5 catalog: observed ${implemented.filter((c) => c.observed > 0).length}/${implemented.length}` +
            (missing.length ? `; missing: ${missing.join(", ")}` : ""),
    );
}

await main();
