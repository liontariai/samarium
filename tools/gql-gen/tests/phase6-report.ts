import { generate } from "../src/generate.ts";
import { oracle } from "../src/oracle/index.ts";

let ok = 0;
let fail = 0;
for (let seed = 0; seed < 20; seed++) {
    const spec = generate({ seed, profile: "full-random" });
    const v = await oracle(spec);
    if (v.ok) ok++;
    else {
        fail++;
        console.error(seed, spec.meta.resolvedProfile, v.compile.error?.split("\n")[0], v.typecheck.errors[0]);
    }
}
console.log(JSON.stringify({ ok, fail }, null, 2));
