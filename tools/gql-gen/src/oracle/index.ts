/**
 * In-repo Samarium GraphQL compile oracle. Imports the generator from source
 * (`packages/make/src`) so coverage tests the current compiler, not a stale dist.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSchema } from "graphql";
import { GraphQLGenerator, Flavors } from "@samarium.sdk/make";
import type { GeneratedSpec } from "../types.ts";
import { toSdl } from "../ser/index.ts";
import { typecheckSdk } from "./typecheck.ts";
import { shrink } from "../shrink/index.ts";

export type OracleCompile = {
    ok: boolean;
    crashed: boolean;
    error?: string;
    sdk?: string;
};

export type OracleTypecheck = {
    ok: boolean;
    errors: string[];
};

export type OracleVerdict = {
    ok: boolean;
    compile: OracleCompile;
    typecheck: OracleTypecheck;
    durationMs: number;
};

export type OracleOptions = {
    /** Default true. Skip to compile-only (used while shrinking). */
    typecheck?: boolean;
};

function errorMessage(e: unknown): string {
    if (e instanceof Error) {
        const stack = e.stack ? `\n${e.stack.split("\n").slice(0, 6).join("\n")}` : "";
        return `${e.name}: ${e.message}${stack}`;
    }
    return String(e);
}

let generator: InstanceType<typeof GraphQLGenerator.Generator> | undefined;

function getGenerator(): InstanceType<typeof GraphQLGenerator.Generator> {
    generator ??= new GraphQLGenerator.Generator(Flavors.GraphQL.default);
    return generator;
}

export async function compileSpec(spec: GeneratedSpec): Promise<OracleCompile> {
    const warn = console.warn;
    console.warn = () => {};
    try {
        const sdl = spec.files["schema.graphql"] ?? toSdl(spec.ir);
        const schema = buildSchema(sdl);
        const sdk = await getGenerator().generate({
            schema,
            options: {},
        });
        if (!sdk || sdk.trim().length < 20) {
            return { ok: false, crashed: false, error: "compiler returned empty SDK", sdk };
        }
        return { ok: true, crashed: false, sdk };
    } catch (e) {
        return { ok: false, crashed: true, error: errorMessage(e) };
    } finally {
        console.warn = warn;
    }
}

export async function oracle(spec: GeneratedSpec, opts: OracleOptions = {}): Promise<OracleVerdict> {
    const t0 = performance.now();
    const compile = await compileSpec(spec);
    let typecheck: OracleTypecheck = { ok: true, errors: [] };
    if (compile.ok && compile.sdk && opts.typecheck !== false) {
        const errors = typecheckSdk(compile.sdk);
        typecheck = { ok: errors.length === 0, errors };
    }
    return {
        ok: compile.ok && typecheck.ok,
        compile,
        typecheck,
        durationMs: performance.now() - t0,
    };
}

export type ReproFiles = {
    graphql: string;
    meta: string;
};

export async function writeRepro(dir: string, spec: GeneratedSpec, verdict: OracleVerdict): Promise<ReproFiles> {
    await mkdir(dir, { recursive: true });
    const gqlPath = join(dir, `${spec.meta.hash}.graphql`);
    const metaPath = join(dir, `${spec.meta.hash}.json`);
    const sdl = spec.files["schema.graphql"] ?? toSdl(spec.ir);
    const sidecar = {
        seed: spec.meta.seed,
        profile: spec.meta.profile,
        resolvedProfile: spec.meta.resolvedProfile,
        size: spec.meta.size,
        hash: spec.meta.hash,
        features: spec.meta.features,
        mutations: spec.meta.mutations,
        bytes: spec.meta.bytes,
        lines: sdl.split("\n").length,
        compile: { ok: verdict.compile.ok, crashed: verdict.compile.crashed, error: verdict.compile.error },
        typecheck: verdict.typecheck,
    };
    await writeFile(gqlPath, sdl, "utf8");
    await writeFile(metaPath, JSON.stringify(sidecar, null, 2) + "\n", "utf8");
    return { graphql: gqlPath, meta: metaPath };
}

/**
 * Shrink while the oracle still fails (crash or typecheck). Compile-only during
 * the search so a stack-overflow stays cheap; typecheck the local minimum after.
 */
export async function shrinkOracleFailure(
    spec: GeneratedSpec,
    opts: { maxSteps?: number } = {},
): Promise<GeneratedSpec> {
    return shrink(
        spec,
        async (d) => {
            const r = await compileSpec(d);
            return !r.ok;
        },
        { maxSteps: opts.maxSteps ?? 12 },
    );
}

export { typecheckSdk };
