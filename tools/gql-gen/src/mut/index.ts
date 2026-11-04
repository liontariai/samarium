import { parse } from "graphql";
import { cloneDoc, named, type GraphQLDocument } from "../ast/index.ts";
import { repair } from "../cons/repair.ts";
import { hashText } from "../hash.ts";
import { Rng } from "../rng.ts";
import { toSdl, toStableSdl } from "../ser/index.ts";
import type { GeneratedSpec, SizeClass } from "../types.ts";
import { applyMutations } from "./ops.ts";

export type MutateOptions = {
    seed: number;
    n?: number;
    allowInvalid?: boolean;
};

/**
 * Minimal SDL→IR: rebuild a usable document via graphql-js schema introspection-like walk.
 * For mutate CLI we parse SDL, build a simple IR of types from the AST definitions.
 */
export function sdlToIr(sdl: string): GraphQLDocument {
    const ast = parse(sdl);
    const doc: GraphQLDocument = { types: [], directives: [] };
    for (const def of ast.definitions) {
        if (def.kind === "SchemaDefinition") {
            doc.schema = {};
            for (const op of def.operationTypes ?? []) {
                if (op.operation === "query") doc.schema.query = op.type.name.value;
                if (op.operation === "mutation") doc.schema.mutation = op.type.name.value;
                if (op.operation === "subscription") doc.schema.subscription = op.type.name.value;
            }
        } else if (def.kind === "ObjectTypeDefinition") {
            doc.types.push({
                kind: "object",
                name: def.name.value,
                fields: (def.fields ?? []).map((f) => ({
                    name: f.name.value,
                    type: named("String"), // simplified; repair/oracle use regenerated SDL from full path usually
                })),
                interfaces: def.interfaces?.map((i) => i.name.value),
            });
        } else if (def.kind === "DirectiveDefinition") {
            doc.directives.push({
                name: def.name.value,
                locations: def.locations.map((l) => l.value),
            });
        }
    }
    if (!doc.schema?.query && doc.types.some((t) => t.name === "Query")) {
        doc.schema = { query: "Query" };
    }
    // Prefer keeping original SDL round-trip by storing as opaque: for mutate from files,
    // we re-parse after ops on a better IR. For CLI mutate of generated specs, callers pass IR via generate path.
    if (!doc.types.length) {
        doc.types.push({ kind: "object", name: "Query", fields: [{ name: "hello", type: named("String") }] });
        doc.schema = { query: "Query" };
    }
    return doc;
}

export function mutate(input: string | GraphQLDocument, opts: MutateOptions): GeneratedSpec {
    let ir = typeof input === "string" ? sdlToIr(input) : cloneDoc(input);
    const rng = new Rng(opts.seed);
    const mctx = { rng, seq: 0 };
    const records = applyMutations(ir, mctx, opts.n ?? 3, !!opts.allowInvalid);
    if (!opts.allowInvalid) ir = repair(ir);
    const sdl = toSdl(ir);
    const features = [...new Set(records.flatMap((r) => r.features))].sort();
    return {
        ir,
        files: { "schema.graphql": sdl },
        meta: {
            seed: opts.seed,
            profile: "messy",
            resolvedProfile: "messy",
            size: "s" satisfies SizeClass,
            features,
            mutations: records.map((r) => r.id),
            bytes: sdl.length,
            hash: hashText(toStableSdl(ir)),
        },
    };
}
