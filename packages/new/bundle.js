import { build } from "bun";
import fs from "fs";
// bin output
const { outputs, logs } = await build({
    entrypoints: ["./src/index.ts"],
    outdir: "./bin",
    format: "esm",
    target: "node",
    banner: "#!/usr/bin/env node",
    minify: true,
});
if (!outputs.length) {
    console.error(logs);
    throw new Error("No outputs found");
}
const file = outputs[0].path;
const bin = file.split("/").slice(0, -1).concat("samarium").join("/");
fs.renameSync(file, bin);
fs.chmodSync(bin, "755");
