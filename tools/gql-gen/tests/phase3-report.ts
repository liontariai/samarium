import { generate } from "../src/generate.ts";
import { coverage, phaseCoverageGap } from "../src/cov/index.ts";

const docs = [];
for (const profile of ["directive-matrix", "subscription-root"] as const) {
    for (let seed = 0; seed < 40; seed++) docs.push(generate({ seed, profile }));
}
console.log(coverage(docs).markdown);
console.log("phase3 gaps:", phaseCoverageGap(docs, 3));
