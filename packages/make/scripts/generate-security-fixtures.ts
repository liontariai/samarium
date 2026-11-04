/**
 * Regenerate static OpenAPI security-matrix fixtures from oas-gen (fixed seed).
 *
 * Usage:
 *   bun scripts/generate-security-fixtures.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "@samarium.sdk/oas-gen";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../tests/openapi/schemas");

const SEED = 42;
const PROFILE = "security-matrix" as const;
const SIZE = "m" as const;

const FIXTURES = [
    { dialect: "3.0" as const, file: "security-matrix-30.json" },
    { dialect: "3.1" as const, file: "security-matrix-31.json" },
];

async function main() {
    await mkdir(OUT_DIR, { recursive: true });

    for (const { dialect, file } of FIXTURES) {
        const spec = generate({
            seed: SEED,
            dialect,
            profile: PROFILE,
            format: "json",
            size: SIZE,
        });
        const json =
            spec.files["openapi.json"] ??
            Object.values(spec.files).find((v) => typeof v === "string" && v.trimStart().startsWith("{"));
        if (!json) {
            throw new Error(`oas-gen produced no JSON for dialect ${dialect}`);
        }
        // Normalize formatting for stable diffs
        const pretty = `${JSON.stringify(JSON.parse(json), null, 4)}\n`;
        const outPath = path.join(OUT_DIR, file);
        await writeFile(outPath, pretty, "utf8");
        console.log(`wrote ${path.relative(process.cwd(), outPath)}`);
    }
}

await main();
