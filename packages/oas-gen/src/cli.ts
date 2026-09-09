#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Command } from "commander";
import { coverage, generate, mutate, validate, type Dialect, type Profile, type SizeClass } from "./index.ts";
import { parseDocument } from "./val/index.ts";

const program = new Command();
program.name("oas-gen").description("Seeded OpenAPI document generator for Samarium coverage tests").version("0.1.0");

program
    .command("generate")
    .description("Generate an OpenAPI document")
    .requiredOption("--seed <n>", "PRNG seed", Number)
    .option("--dialect <d>", "3.0 or 3.1")
    .option("--profile <p>", "minimal | core-rest | schema-heavy | param-matrix | media-matrix | security-matrix | callback-webhook | messy | ref-graph | multi-file", "core-rest")
    .option("--size <s>", "xs | s | m | l")
    .option("--format <f>", "json | yaml | both", "yaml")
    .option("--multi-file", "split components into sidecar $ref files", false)
    .option("--key-order <k>", "stable | shuffle")
    .option("--yaml-style <s>", "block | flow")
    .option("--out <path>", "output file or directory", ".")
    .action(async (opts: {
        seed: number;
        dialect?: string;
        profile: string;
        size?: string;
        format: "json" | "yaml" | "both";
        multiFile?: boolean;
        keyOrder?: "stable" | "shuffle";
        yamlStyle?: "block" | "flow";
        out: string;
    }) => {
        const spec = generate({
            seed: Number(opts.seed),
            dialect: opts.dialect as Dialect | undefined,
            profile: opts.profile as Profile,
            size: opts.size as SizeClass | undefined,
            format: opts.format,
            multiFile: !!opts.multiFile,
            keyOrder: opts.keyOrder,
            yamlStyle: opts.yamlStyle,
        });
        const out = resolve(opts.out);
        const many = Object.keys(spec.files).length > 1;
        const isDir = many || (!out.endsWith(".yaml") && !out.endsWith(".yml") && !out.endsWith(".json"));
        if (isDir) {
            await mkdir(out, { recursive: true });
            for (const [name, text] of Object.entries(spec.files)) {
                const dest = join(out, name);
                await mkdir(dirname(dest), { recursive: true });
                await writeFile(dest, text, "utf8");
            }
        } else {
            await mkdir(dirname(out), { recursive: true });
            const text = spec.files["openapi.yaml"] ?? spec.files["openapi.json"] ?? Object.values(spec.files)[0]!;
            await writeFile(out, text, "utf8");
        }
        console.log(
            JSON.stringify(
                {
                    seed: spec.meta.seed,
                    dialect: spec.meta.dialect,
                    profile: spec.meta.profile,
                    hash: spec.meta.hash,
                    features: spec.meta.features,
                    files: Object.keys(spec.files),
                },
                null,
                2,
            ),
        );
    });

program
    .command("mutate")
    .description("Apply seeded mutations to a spec")
    .requiredOption("--in <path>", "input JSON or YAML (or omit and pipe)")
    .requiredOption("--seed <n>", "PRNG seed", Number)
    .option("--n <count>", "number of mutations", (v) => Number(v), 3)
    .option("--allow-invalid", "include invalid operators (skips repair)", false)
    .option("--format <f>", "json | yaml | both", "yaml")
    .option("--out <path>", "output file or directory", ".")
    .action(async (opts: {
        in: string;
        seed: number;
        n: number;
        allowInvalid?: boolean;
        format: "json" | "yaml" | "both";
        out: string;
    }) => {
        const text = await readFile(resolve(opts.in), "utf8");
        const spec = mutate(text, {
            seed: Number(opts.seed),
            n: Number(opts.n),
            allowInvalid: !!opts.allowInvalid,
            format: opts.format,
        });
        const out = resolve(opts.out);
        const isDir = !out.endsWith(".yaml") && !out.endsWith(".yml") && !out.endsWith(".json");
        if (isDir) {
            await mkdir(out, { recursive: true });
            for (const [name, text] of Object.entries(spec.files)) {
                await writeFile(join(out, name), text, "utf8");
            }
        } else {
            await mkdir(dirname(out), { recursive: true });
            const body = spec.files["openapi.yaml"] ?? spec.files["openapi.json"] ?? Object.values(spec.files)[0]!;
            await writeFile(out, body, "utf8");
        }
        console.log(JSON.stringify({ hash: spec.meta.hash, mutations: spec.meta.mutations, files: Object.keys(spec.files) }, null, 2));
    });

program
    .command("validate")
    .description("Validate a document against the gauntlet")
    .requiredOption("--in <path>", "input JSON or YAML")
    .option("--dialect <d>", "3.0 or 3.1 (inferred from openapi field if omitted)")
    .action(async (opts: { in: string; dialect?: string }) => {
        const text = await readFile(resolve(opts.in), "utf8");
        const parsed = parseDocument(text);
        if (!parsed.ok) {
            console.error("parse failed", parsed.error);
            process.exit(1);
        }
        const openapi = (parsed.value as { openapi?: string })?.openapi ?? "";
        const dialect: Dialect = (opts.dialect as Dialect | undefined) ?? (openapi.startsWith("3.1") ? "3.1" : "3.0");
        const verdict = await validate(parsed.value, dialect);
        console.log(JSON.stringify(verdict, null, 2));
        process.exit(verdict.acceptedAsValidFixture ? 0 : 1);
    });

program
    .command("coverage")
    .description("Print coverage for a directory of generated specs (JSON sidecar not required)")
    .option("--seeds <n>", "generate this many seeds instead of reading --dir", Number)
    .option("--profile <p>", "profile used when --seeds is set", "core-rest")
    .option("--dialect <d>", "3.0 or 3.1 (omit to mix)")
    .action(async (opts: { seeds?: number; profile: string; dialect?: string }) => {
        const n = opts.seeds ?? 100;
        const docs = [];
        for (let seed = 0; seed < n; seed++) {
            docs.push(
                generate({
                    seed,
                    dialect: opts.dialect as Dialect | undefined,
                    profile: opts.profile as Profile,
                }),
            );
        }
        const report = coverage(docs);
        console.log(report.markdown);
        console.log(`observed ${report.observed}/${report.total} catalog ids (${report.implemented} implemented)`);
    });

program.parseAsync(process.argv);
