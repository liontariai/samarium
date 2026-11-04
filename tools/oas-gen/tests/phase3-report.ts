/**
 * Phase 3 report: coverage table + reject-rate for security/callback profiles.
 * bun tests/phase3-report.ts
 */
import { generate } from "../src/generate.ts";
import { validate } from "../src/val/index.ts";
import { coverage } from "../src/cov/index.ts";
import { documentToJson } from "../src/ser/index.ts";
import { FEATURES } from "../src/catalog/features.ts";
import type { Dialect, Profile } from "../src/types.ts";

const SEEDS = 50;
const PROFILES: Profile[] = ["security-matrix", "callback-webhook"];

async function main() {
    const all = [];
    console.log("Phase 3 reject-rate (seeds 0–49)\n");
    console.log("| profile | dialect | rejected | rate |");
    console.log("|---|---|---|---|");
    for (const profile of PROFILES) {
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
    const phase3 = FEATURES.filter((f) => f.implemented && f.phase === 3);
    const missing = phase3.filter((f) => !all.some((d) => d.meta.features.includes(f.id)));
    console.log("\nCoverage (Phase 3 profiles × dialects, seeds 0–49)\n");
    console.log(
        report.byFeature
            .filter((c) => phase3.some((f) => f.id === c.id))
            .map((c) => `${c.observed ? "✓" : "✗"} ${c.id} (${c.observed}, ${c.dialectsObserved.join("/")})`)
            .join("\n"),
    );
    console.log(`\nimplemented phase-3 but never observed: ${missing.map((f) => f.id).join(", ") || "(none)"}`);
}

await main();
