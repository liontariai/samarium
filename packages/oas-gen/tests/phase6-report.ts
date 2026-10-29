/**
 * Phase 6 report: Samarium compile oracle + shrink.
 * bun tests/phase6-report.ts
 */
import { generate } from "../src/generate.ts";
import { compileSpec, oracle } from "../src/oracle/index.ts";
import { PHASE5_PROFILES } from "../src/catalog/features.ts";
import type { Dialect, Profile } from "../src/types.ts";

const TYPECHECK_PROFILES = new Set<Profile>(["minimal", "core-rest"]);
const CRASHY = new Set<Profile>(["schema-heavy", "ref-graph", "multi-file", "messy"]);

function seedCount(profile: Profile): number {
    if (TYPECHECK_PROFILES.has(profile)) return 50;
    if (CRASHY.has(profile)) return 10;
    return 50;
}

async function main() {
    console.log("Phase 6 Samarium oracle\n");
    console.log("| profile | dialect | n | compile fail | crash | typecheck fail |");
    console.log("|---|---|---|---|---|---|");

    for (const profile of PHASE5_PROFILES) {
        const n = seedCount(profile);
        for (const dialect of ["3.0", "3.1"] as Dialect[]) {
            let compileFail = 0;
            let crash = 0;
            let tcFail = 0;
            const sample: string[] = [];
            for (let seed = 0; seed < n; seed++) {
                const spec = generate({ seed, profile, dialect });
                if (TYPECHECK_PROFILES.has(profile)) {
                    const r = await oracle(spec);
                    if (!r.compile.ok) compileFail++;
                    if (r.compile.crashed) crash++;
                    if (!r.typecheck.ok) tcFail++;
                    if (!r.ok && sample.length < 2) {
                        sample.push(
                            `  seed ${seed}: crash=${r.compile.crashed} ${r.compile.error?.split("\n")[0] ?? r.typecheck.errors[0] ?? ""}`,
                        );
                    }
                } else {
                    const r = await compileSpec(spec);
                    if (!r.ok) compileFail++;
                    if (r.crashed) crash++;
                    if (!r.ok && sample.length < 2) {
                        sample.push(`  seed ${seed}: crash=${r.crashed} ${r.error?.split("\n")[0] ?? ""}`);
                    }
                }
            }
            console.log(`| ${profile} | ${dialect} | ${n} | ${compileFail}/${n} | ${crash}/${n} | ${tcFail}/${n} |`);
            if (sample.length) console.log(sample.join("\n"));
        }
    }
}

await main();
