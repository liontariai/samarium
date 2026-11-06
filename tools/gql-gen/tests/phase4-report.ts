import { generate, mutate } from "../src/generate.ts";
import { validate } from "../src/val/index.ts";

let rejected = 0;
const n = 200;
for (let seed = 0; seed < n; seed++) {
    const base = generate({ seed, profile: "type-system-heavy" });
    const spec = mutate(base.ir, { seed: seed + 1, n: 5 });
    const v = await validate(spec.ir);
    if (!v.acceptedAsValidFixture) rejected++;
}
console.log(JSON.stringify({ n, rejected, rate: rejected / n }, null, 2));
