#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Command } from "commander";
import { coverage, generate, mutate, validate, type Profile, type SizeClass } from "./index.ts";
import { parseSdl } from "./val/index.ts";
import { compileSpec, oracle, shrinkOracleFailure, writeRepro } from "./oracle/index.ts";

const program = new Command();
program
    .name("gql-gen")
    .description("Seeded GraphQL schema generator for Samarium coverage tests")
    .version("0.1.0");

program
    .command("generate")
    .description("Generate a GraphQL schema (SDL)")
    .requiredOption("--seed <n>", "PRNG seed", Number)
    .option(
        "--profile <p>",
        "minimal | core-api | type-system-heavy | directive-matrix | subscription-root | messy | cyclic-types | schema-extensions | full-random",
        "core-api",
    )
    .option("--size <s>", "xs | s | m | l")
    .option("--out <path>", "output file or directory", ".")
    .action(async (opts: { seed: number; profile: string; size?: string; out: string }) => {
        const spec = generate({
            seed: Number(opts.seed),
            profile: opts.profile as Profile,
            size: opts.size as SizeClass | undefined,
        });
        const out = resolve(opts.out);
        const isDir = !out.endsWith(".graphql") && !out.endsWith(".gql");
        if (isDir) {
            await mkdir(out, { recursive: true });
            for (const [name, text] of Object.entries(spec.files)) {
                await writeFile(join(out, name), text, "utf8");
            }
        } else {
            await mkdir(dirname(out), { recursive: true });
            await writeFile(out, spec.files["schema.graphql"] ?? Object.values(spec.files)[0]!, "utf8");
        }
        console.log(
            JSON.stringify(
                {
                    seed: spec.meta.seed,
                    profile: spec.meta.profile,
                    resolvedProfile: spec.meta.resolvedProfile,
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
    .description("Apply seeded mutations to a schema")
    .requiredOption("--in <path>", "input GraphQL SDL")
    .requiredOption("--seed <n>", "PRNG seed", Number)
    .option("--n <count>", "number of mutations", (v) => Number(v), 3)
    .option("--allow-invalid", "include invalid operators (skips repair)", false)
    .option("--out <path>", "output file or directory", ".")
    .action(async (opts: { in: string; seed: number; n: number; allowInvalid?: boolean; out: string }) => {
        const text = await readFile(resolve(opts.in), "utf8");
        const spec = mutate(text, {
            seed: Number(opts.seed),
            n: Number(opts.n),
            allowInvalid: !!opts.allowInvalid,
        });
        const out = resolve(opts.out);
        const isDir = !out.endsWith(".graphql") && !out.endsWith(".gql");
        if (isDir) {
            await mkdir(out, { recursive: true });
            for (const [name, text] of Object.entries(spec.files)) {
                await writeFile(join(out, name), text, "utf8");
            }
        } else {
            await mkdir(dirname(out), { recursive: true });
            await writeFile(out, spec.files["schema.graphql"]!, "utf8");
        }
        console.log(
            JSON.stringify({ hash: spec.meta.hash, mutations: spec.meta.mutations, files: Object.keys(spec.files) }, null, 2),
        );
    });

program
    .command("validate")
    .description("Validate a GraphQL schema against the gauntlet")
    .requiredOption("--in <path>", "input GraphQL SDL")
    .action(async (opts: { in: string }) => {
        const text = await readFile(resolve(opts.in), "utf8");
        const parsed = parseSdl(text);
        if (!parsed.ok) {
            console.error("parse failed", parsed.error);
            process.exit(1);
        }
        const verdict = await validate(text);
        console.log(JSON.stringify(verdict, null, 2));
        process.exit(verdict.acceptedAsValidFixture ? 0 : 1);
    });

program
    .command("coverage")
    .description("Print feature coverage for generated schemas")
    .option("--seeds <n>", "number of seeds", Number)
    .option("--profile <p>", "profile", "core-api")
    .action(async (opts: { seeds?: number; profile: string }) => {
        const n = opts.seeds ?? 100;
        const docs = [];
        for (let seed = 0; seed < n; seed++) {
            docs.push(generate({ seed, profile: opts.profile as Profile }));
        }
        const report = coverage(docs);
        console.log(report.markdown);
        console.log(`observed ${report.observed}/${report.total} catalog ids (${report.implemented} implemented)`);
    });

program
    .command("soak")
    .description("Generate schemas until the clock runs out and run the Samarium GraphQL oracle")
    .option("--minutes <n>", "how long to run", (v) => Number(v), 5)
    .option("--oracle <name>", "samarium (only adapter in v1)", "samarium")
    .option("--profile <p>", "profile (default full-random)", "full-random")
    .option("--seed <n>", "starting seed", (v) => Number(v), 0)
    .option("--out <path>", "directory for shrunk repros", "./repro")
    .option("--no-typecheck", "compile only; skip tsc")
    .action(async (opts: {
        minutes: number;
        oracle: string;
        profile: string;
        seed: number;
        out: string;
        typecheck?: boolean;
    }) => {
        if (opts.oracle !== "samarium") {
            console.error(`unknown oracle "${opts.oracle}"; only "samarium" is implemented`);
            process.exit(1);
        }
        const deadline = Date.now() + Math.max(0.1, opts.minutes) * 60_000;
        let seed = Number(opts.seed) || 0;
        let ok = 0;
        let fail = 0;
        let crash = 0;
        const repros: string[] = [];
        while (Date.now() < deadline) {
            const spec = generate({
                seed,
                profile: opts.profile as Profile,
            });
            const verdict = await oracle(spec, { typecheck: opts.typecheck !== false });
            if (verdict.ok) ok++;
            else {
                fail++;
                if (verdict.compile.crashed) crash++;
                const shrunk = await shrinkOracleFailure(spec);
                const shrunkVerdict = await compileSpec(shrunk);
                const written = await writeRepro(resolve(opts.out), shrunk, {
                    ok: false,
                    compile: shrunkVerdict,
                    typecheck: verdict.typecheck,
                    durationMs: verdict.durationMs,
                });
                repros.push(written.graphql);
                console.error(
                    JSON.stringify({
                        seed,
                        profile: spec.meta.profile,
                        resolvedProfile: spec.meta.resolvedProfile,
                        hash: spec.meta.hash,
                        shrunk: shrunk.meta.hash,
                        crashed: verdict.compile.crashed,
                        error: verdict.compile.error?.split("\n")[0],
                        typecheck: verdict.typecheck.errors[0],
                        repro: written.graphql,
                    }),
                );
            }
            seed++;
        }
        console.log(
            JSON.stringify(
                {
                    seeds: seed - (Number(opts.seed) || 0),
                    ok,
                    fail,
                    crash,
                    repros,
                },
                null,
                2,
            ),
        );
        process.exit(fail ? 1 : 0);
    });

program.parseAsync(process.argv);
