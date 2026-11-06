import { generate } from "../src/generate.ts";
import { coverage, phaseCoverageGap } from "../src/cov/index.ts";

const docs = [];
for (const profile of ["cyclic-types", "schema-extensions", "messy"] as const) {
    for (let seed = 0; seed < 30; seed++) docs.push(generate({ seed, profile }));
}
console.log(coverage(docs).markdown);
console.log("phase5 gaps:", phaseCoverageGap(docs, 5));
