import { createHash } from "node:crypto";
import type { GenerateOptions, GeneratedSpec } from "./types.ts";
import { createContext, generateDocument } from "./gen/index.ts";
import { repair } from "./cons/repair.ts";
import { toJsonString, toYamlString, documentToJson } from "./ser/index.ts";
import { mark } from "./gen/context.ts";

export function hashText(text: string): string {
    return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function generate(opts: GenerateOptions): GeneratedSpec {
    if (opts.multiFile) {
        throw new Error("multiFile is Phase 5; not implemented yet");
    }
    const ctx = createContext(opts);
    const ir = repair(generateDocument(ctx), ctx.dialect);
    const format = opts.format ?? "yaml";
    // JSON is always produced for hashing; YAML is the default on-disk form.
    mark(ctx, "ser.json");
    mark(ctx, "ser.yaml");

    const json = toJsonString(ir);
    const yaml = toYamlString(ir);
    const files: Record<string, string> = {};
    if (format === "json") files["openapi.json"] = json;
    else if (format === "both") {
        files["openapi.json"] = json;
        files["openapi.yaml"] = yaml;
    } else files["openapi.yaml"] = yaml;

    const bytes = Object.values(files).reduce((n, t) => n + t.length, 0);
    const features = [...ctx.features].sort();

    return {
        ir,
        files,
        meta: {
            seed: opts.seed,
            dialect: ctx.dialect,
            profile: ctx.profile,
            size: ctx.size,
            features,
            mutations: [],
            bytes,
            hash: hashText(json),
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

export function mutate(_input: GeneratedSpec | string, _opts: { seed: number; n?: number; allowInvalid?: boolean }): GeneratedSpec {
    throw new Error("mutate() is Phase 4; not implemented yet");
}

export async function shrink(
    _doc: GeneratedSpec,
    _pred: (d: GeneratedSpec) => boolean | Promise<boolean>,
): Promise<GeneratedSpec> {
    throw new Error("shrink() is Phase 6; not implemented yet");
}
