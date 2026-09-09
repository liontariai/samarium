import { createHash } from "node:crypto";
import type { GeneratedSpec } from "../types.ts";
import { Rng } from "../rng.ts";
import { repair } from "../cons/repair.ts";
import { toJsonString, toYamlString } from "../ser/index.ts";
import { parseDocument } from "../val/index.ts";
import { applyMutations, type MutationRecord, type MutCtx } from "./ops.ts";
import { cloneDoc } from "./walk.ts";
import { inferDialect, jsonToIr } from "./from-json.ts";
import type { OpenAPIDocument } from "../ast/index.ts";
import type { Dialect } from "../types.ts";

function hashText(text: string): string {
    return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export type MutateOptions = {
    seed: number;
    n?: number;
    allowInvalid?: boolean;
    format?: "json" | "yaml" | "both";
};

function pack(ir: OpenAPIDocument, dialect: Dialect, mutations: MutationRecord[], opts: MutateOptions, extraFeatures: string[]): GeneratedSpec {
    const format = opts.format ?? "yaml";
    const json = toJsonString(ir);
    const yaml = toYamlString(ir);
    const files: Record<string, string> = {};
    if (format === "json") files["openapi.json"] = json;
    else if (format === "both") {
        files["openapi.json"] = json;
        files["openapi.yaml"] = yaml;
    } else files["openapi.yaml"] = yaml;
    const features = [...new Set(extraFeatures)].sort();
    return {
        ir,
        files,
        meta: {
            seed: opts.seed,
            dialect,
            profile: "core-rest",
            size: "s",
            features,
            mutations: mutations.map((m) => m.id),
            bytes: Object.values(files).reduce((n, t) => n + t.length, 0),
            hash: hashText(json),
        },
    };
}

export function mutateDocument(ir: OpenAPIDocument, dialect: Dialect, opts: MutateOptions, baseFeatures: string[] = []): GeneratedSpec {
    const doc = cloneDoc(ir);
    const ctx: MutCtx = { rng: new Rng(opts.seed), dialect, seq: 0 };
    const mutations = applyMutations(doc, ctx, opts.n ?? 1, opts.allowInvalid === true);
    const next = opts.allowInvalid ? doc : repair(doc, dialect);
    const features = [...baseFeatures, ...mutations.flatMap((m) => m.features)];
    return pack(next, dialect, mutations, opts, features);
}

export function mutate(input: GeneratedSpec | string, opts: MutateOptions): GeneratedSpec {
    if (typeof input === "string") {
        const parsed = parseDocument(input);
        if (!parsed.ok || !parsed.value) {
            throw new Error(`mutate(): failed to parse input: ${String(parsed.error)}`);
        }
        const ir = jsonToIr(parsed.value);
        const dialect = inferDialect(ir);
        return mutateDocument(ir, dialect, opts);
    }
    return mutateDocument(input.ir, input.meta.dialect, opts, input.meta.features);
}

export type { MutationRecord };
export { applyMutations, SAFE_OPS, INVALID_OPS } from "./ops.ts";
export { jsonToIr } from "./from-json.ts";
