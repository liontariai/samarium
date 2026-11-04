import { generate } from "../src/generate.ts";
import { coverage, phaseCoverageGap } from "../src/cov/index.ts";

const docs = [];
for (let seed = 0; seed < 80; seed++) docs.push(generate({ seed, profile: "type-system-heavy" }));
const report = coverage(docs);
console.log(report.markdown);
console.log("phase2 gaps:", phaseCoverageGap(docs, 2));
