import type { GenerateOptions, GeneratedSpec, Profile } from "./types.ts";
import { createContext, generateDocument } from "./gen/index.ts";
import { repair } from "./cons/repair.ts";
import {
    toJsonString,
    documentToJson,
    stringifyJson,
    stringifyYaml,
    shuffleKeys,
    splitToFiles,
} from "./ser/index.ts";
import { mark } from "./gen/context.ts";
import { applyMutations, type MutCtx } from "./mut/ops.ts";
import { Rng } from "./rng.ts";
import { PHASE5_PROFILES } from "./catalog/features.ts";
import { hashText } from "./hash.ts";

export { hashText } from "./hash.ts";

const FULL_RANDOM_SIZES = ["xs", "s", "m"] as const;

function resolveGenerateOptions(opts: GenerateOptions): { opts: GenerateOptions; requested: Profile | undefined } {
    if (opts.profile !== "full-random") return { opts, requested: opts.profile };
    const rng = new Rng((opts.seed >>> 0) ^ 0x61a1_d0e5);
    return {
        requested: "full-random",
        opts: {
            ...opts,
            profile: rng.pick(PHASE5_PROFILES),
            dialect: opts.dialect ?? (rng.bool() ? "3.1" : "3.0"),
            size: opts.size ?? rng.pick(FULL_RANDOM_SIZES),
        },
    };
}

export function generate(opts: GenerateOptions): GeneratedSpec {
    const resolved = resolveGenerateOptions(opts);
    const ctx = createContext(resolved.opts);
    let ir = generateDocument(ctx);
    const mutations: string[] = [];
    if (ctx.profile === "messy") {
        const mctx: MutCtx = { rng: ctx.rng, dialect: ctx.dialect, seq: 0 };
        for (const rec of applyMutations(ir, mctx, 3, false)) {
            mutations.push(rec.id);
            for (const f of rec.features) mark(ctx, f);
        }
    }
    ir = repair(ir, ctx.dialect);
    const format = opts.format ?? "yaml";
    mark(ctx, "ser.json");
    mark(ctx, "ser.yaml");

    const chaotic = ctx.profile === "ref-graph" || ctx.profile === "multi-file";
    const shuffle = opts.keyOrder === "shuffle" || (opts.keyOrder !== "stable" && chaotic);
    const flow = opts.yamlStyle === "flow" || (opts.yamlStyle !== "block" && ctx.profile === "ref-graph" && (opts.seed & 1) === 1);
    const multi = opts.multiFile === true || ctx.profile === "multi-file";
    const serRng = new Rng((opts.seed >>> 0) ^ 0x51ed_c0de);

    if (shuffle) mark(ctx, "ser.key-order.shuffle");
    if (flow && (format === "yaml" || format === "both")) mark(ctx, "ser.yaml.flow");

    const raw = documentToJson(ir);
    const jsonObj = shuffle ? (shuffleKeys(raw, serRng) as Record<string, unknown>) : raw;

    const files: Record<string, string> = {};
    if (multi) {
        const yamlSplit = splitToFiles(raw, {
            ext: "yaml",
            yamlFlow: flow,
            shuffle,
            rng: serRng,
        });
        const jsonSplit = splitToFiles(raw, {
            ext: "json",
            shuffle,
            rng: serRng,
        });
        for (const f of [...yamlSplit.features, ...jsonSplit.features]) mark(ctx, f);
        if (format === "json") Object.assign(files, jsonSplit.files);
        else if (format === "both") Object.assign(files, yamlSplit.files, jsonSplit.files);
        else Object.assign(files, yamlSplit.files);
    } else {
        const jsonText = stringifyJson(jsonObj);
        const yamlText = stringifyYaml(jsonObj, flow);
        if (format === "json") files["openapi.json"] = jsonText;
        else if (format === "both") {
            files["openapi.json"] = jsonText;
            files["openapi.yaml"] = yamlText;
        } else files["openapi.yaml"] = yamlText;
    }

    const stableJson = toJsonString(ir);
    const bytes = Object.values(files).reduce((n, t) => n + t.length, 0);
    const features = [...ctx.features].sort();

    return {
        ir,
        files,
        meta: {
            seed: opts.seed,
            dialect: ctx.dialect,
            profile: resolved.requested ?? ctx.profile,
            size: ctx.size,
            features,
            mutations,
            bytes,
            hash: hashText(stableJson),
        },
    };
}

export function generatedJson(spec: GeneratedSpec): Record<string, unknown> {
    return documentToJson(spec.ir) as Record<string, unknown>;
}

export async function* stream(
    opts: GenerateOptions & { limit?: number },
): AsyncGenerator<GeneratedSpec> {
    let seed = opts.seed;
    let n = 0;
    while (opts.limit == null || n < opts.limit) {
        yield generate({ ...opts, seed });
        seed++;
        n++;
    }
}

export { mutate } from "./mut/index.ts";
export { shrink } from "./shrink/index.ts";
