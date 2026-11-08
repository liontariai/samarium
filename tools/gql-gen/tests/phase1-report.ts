import { generate } from "../src/generate.ts";
import { coverage, phaseCoverageGap } from "../src/cov/index.ts";

const docs = [];
for (const profile of ["minimal", "core-api"] as const) {
    for (let seed = 0; seed < 50; seed++) docs.push(generate({ seed, profile }));
}
const report = coverage(docs);
console.log(report.markdown);
console.log("phase1 gaps:", phaseCoverageGap(docs, 1));
