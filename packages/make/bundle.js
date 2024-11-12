import { build } from "bun";

// esm output
await build({
    entrypoints: ["./src/index.ts"],
    external: ["graphql", "typescript"],
    outdir: "./dist/esm",
    format: "esm",
    target: "node",
});
// cjs output
await build({
    entrypoints: ["./src/index.ts"],
    external: ["graphql", "typescript"],
    outdir: "./dist/cjs",
    format: "cjs",
    target: "browser",
});
