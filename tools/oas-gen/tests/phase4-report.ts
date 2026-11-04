/**
 * Phase 4 report: safe-mutation soak reject-rate.
 * bun tests/phase4-report.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generate, mutate } from "../src/generate.ts";
import { validate } from "../src/val/index.ts";
import { documentToJson } from "../src/ser/index.ts";
import type { Dialect } from "../src/types.ts";

const SOAK = 2000;
const CORPUS = join(import.meta.dir, "../vendor/corpus");

async function main() {
    let rejected = 0;
    const sample: string[] = [];
    console.log(`Phase 4 safe-mutation soak (${SOAK} mutations of generated core-rest)\n`);
    for (let i = 0; i < SOAK; i++) {
        const dialect: Dialect = i % 2 === 0 ? "3.0" : "3.1";
        const base = generate({ seed: i % 200, dialect, profile: "core-rest" });
        const next = mutate(base, { seed: i + 10_000, n: 1 });
        const v = await validate(documentToJson(next.ir), dialect);
        if (!v.acceptedAsValidFixture) {
            rejected++;
            if (sample.length < 8) {
                sample.push(
                    `  i=${i} ${dialect} ops=${next.meta.mutations.join(",")} official=${v.officialSchema.ok} semantic=${v.semantic.ok}` +
                        (v.semantic.errors[0] ? ` ${v.semantic.errors[0].message}` : "") +
                        (v.officialSchema.errors[0] ? ` ${JSON.stringify(v.officialSchema.errors[0])}` : ""),
                );
            }
        }
    }
    const rate = (rejected / SOAK) * 100;
    console.log(`generated soak: rejected ${rejected}/${SOAK} (${rate.toFixed(2)}%)`);
    if (sample.length) console.log(sample.join("\n"));

    const files = readdirSync(CORPUS).filter((f) => f.endsWith(".yaml"));
    let corpusRejected = 0;
    let corpusN = 0;
    for (const file of files) {
        const text = readFileSync(join(CORPUS, file), "utf8");
        const dialect: Dialect = file.includes("3.1") ? "3.1" : "3.0";
        for (let seed = 0; seed < 20; seed++) {
            corpusN++;
            const next = mutate(text, { seed, n: 2 });
            const v = await validate(documentToJson(next.ir), dialect);
            if (!v.acceptedAsValidFixture) corpusRejected++;
        }
    }
    console.log(`corpus soak: rejected ${corpusRejected}/${corpusN} (${((corpusRejected / corpusN) * 100).toFixed(2)}%)`);
    console.log(`\ntarget: < 5% reject after repair`);
}

await main();
