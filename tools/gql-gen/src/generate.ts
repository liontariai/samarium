import type { GenerateOptions, GeneratedSpec, Profile } from "./types.ts";
import { createContext, generateDocument } from "./gen/index.ts";
import { repair } from "./cons/repair.ts";
import { toSdl, toStableSdl } from "./ser/index.ts";
import { mark } from "./gen/context.ts";
import { applyMutations, type MutCtx } from "./mut/ops.ts";
import { Rng } from "./rng.ts";
import { PHASE5_PROFILES } from "./catalog/features.ts";
import { hashText } from "./hash.ts";

export { hashText } from "./hash.ts";

const FULL_RANDOM_SIZES = ["xs", "s", "m"] as const;

function resolveGenerateOptions(opts: GenerateOptions): {
    opts: GenerateOptions;
    requested: Profile;
    resolved: Profile;
} {
    const requested = opts.profile ?? "core-api";
    if (requested !== "full-random") {
        return { opts: { ...opts, profile: requested }, requested, resolved: requested };
    }
    const rng = new Rng((opts.seed >>> 0) ^ 0x61a1_d0e5);
    const resolved = rng.pick(PHASE5_PROFILES);
    return {
        requested: "full-random",
        resolved,
        opts: {
            ...opts,
            profile: resolved,
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
        const mctx: MutCtx = { rng: ctx.rng, seq: 0 };
        for (const rec of applyMutations(ir, mctx, 3, false)) {
            mutations.push(rec.id);
            for (const f of rec.features) mark(ctx, f);
        }
    }
    ir = repair(ir);
    mark(ctx, "ser.sdl");

    const sdl = toSdl(ir);
    const files: Record<string, string> = { "schema.graphql": sdl };
    const features = [...ctx.features].sort();

    return {
        ir,
        files,
        meta: {
            seed: opts.seed,
            profile: resolved.requested,
            resolvedProfile: resolved.resolved,
            size: ctx.size,
            features,
            mutations,
            bytes: sdl.length,
            hash: hashText(toStableSdl(ir)),
        },
    };
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
