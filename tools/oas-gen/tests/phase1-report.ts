/**
 * Phase 1 report: coverage table + reject-rate for seeds 0–99.
 * bun tests/phase1-report.ts
 */
import { generate } from "../src/generate.ts";
import { validate } from "../src/val/index.ts";
import { coverage } from "../src/cov/index.ts";
import { documentToJson } from "../src/ser/index.ts";
import { implementedFeatures } from "../src/catalog/features.ts";
import type { Dialect, Profile } from "../src/types.ts";

const SEEDS = 100;

async function main() {
    const all = [];
    console.log("Phase 1 reject-rate (seeds 0–99)\n");
    console.log("| profile | dialect | rejected | rate |");
    console.log("|---|---|---|---|");
    for (const profile of ["minimal", "core-rest"] as Profile[]) {
        for (const dialect of ["3.0", "3.1"] as Dialect[]) {
            let rejected = 0;
            const sample: string[] = [];
            for (let seed = 0; seed < SEEDS; seed++) {
                const spec = generate({ seed, profile, dialect });
                all.push(spec);
                const v = await validate(documentToJson(spec.ir), dialect);
                if (!v.acceptedAsValidFixture) {
                    rejected++;
                    if (sample.length < 3) {
                        sample.push(
                            `  seed ${seed}: official=${v.officialSchema.ok} semantic=${v.semantic.ok} deref=${v.dereference.ok}` +
                                (v.semantic.errors[0] ? ` ${v.semantic.errors[0].message}` : "") +
                                (v.officialSchema.errors[0] ? ` ${JSON.stringify(v.officialSchema.errors[0])}` : ""),
                        );
                    }
                }
            }
            console.log(`| ${profile} | ${dialect} | ${rejected}/${SEEDS} | ${((rejected / SEEDS) * 100).toFixed(1)}% |`);
            if (sample.length) console.log(sample.join("\n"));
        }
    }

    const report = coverage(all);
    console.log("\nCoverage (all Phase 1 profiles × dialects, seeds 0–99)\n");
    console.log(report.markdown);
    const missing = implementedFeatures().filter((f) => !all.some((d) => d.meta.features.includes(f.id)));
    console.log(`implemented but never observed: ${missing.map((f) => f.id).join(", ") || "(none)"}`);
}

await main();
