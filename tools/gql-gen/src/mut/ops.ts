import { cloneDoc, listOf, named, type GraphQLDocument, type NamedTypeIR } from "../ast/index.ts";
import type { Rng } from "../rng.ts";

export type MutCtx = {
    rng: Rng;
    seq: number;
};

export type MutRecord = {
    id: string;
    features: string[];
};

type MutOp = {
    id: string;
    features: string[];
    safe: boolean;
    apply: (doc: GraphQLDocument, ctx: MutCtx) => boolean;
};

function objects(doc: GraphQLDocument): Extract<NamedTypeIR, { kind: "object" }>[] {
    return doc.types.filter((t): t is Extract<NamedTypeIR, { kind: "object" }> => t.kind === "object");
}

const SAFE_OPS: MutOp[] = [
    {
        id: "rename.field",
        features: ["mut.rename.field"],
        safe: true,
        apply(doc, ctx) {
            // Avoid renaming fields required by interfaces
            const objs = objects(doc).filter((o) => o.name !== "Query" && !o.interfaces?.length && o.fields.length);
            const o = ctx.rng.maybePick(objs);
            if (!o) return false;
            const f = ctx.rng.pick(o.fields);
            f.name = `${f.name}X${ctx.seq}`;
            return true;
        },
    },
    {
        id: "add.field",
        features: ["mut.add.field"],
        safe: true,
        apply(doc, ctx) {
            const objs = objects(doc);
            const o = ctx.rng.maybePick(objs);
            if (!o) return false;
            const name = `extra${ctx.seq}`;
            if (o.fields.some((f) => f.name === name)) return false;
            o.fields.push({ name, type: named("String") });
            return true;
        },
    },
    {
        id: "wrap.list",
        features: ["mut.wrap.list"],
        safe: true,
        apply(doc, ctx) {
            // Skip implementors — wrapping interface fields breaks covariance
            const objs = objects(doc).filter((o) => !o.interfaces?.length);
            const o = ctx.rng.maybePick(objs);
            if (!o?.fields.length) return false;
            const f = ctx.rng.pick(o.fields);
            f.type = listOf(f.type);
            return true;
        },
    },
    {
        id: "add.unused",
        features: ["mut.add.unused"],
        safe: true,
        apply(doc, ctx) {
            const name = `Unused${ctx.seq}`;
            if (doc.types.some((t) => t.name === name)) return false;
            doc.types.push({ kind: "object", name, fields: [{ name: "n", type: named("Int") }] });
            return true;
        },
    },
    {
        id: "desc",
        features: ["mut.desc"],
        safe: true,
        apply(doc, ctx) {
            const t = ctx.rng.maybePick(doc.types);
            if (!t) return false;
            t.description = `mutated ${ctx.seq}`;
            return true;
        },
    },
];

const INVALID_OPS: MutOp[] = [
    {
        id: "break.ref",
        features: [],
        safe: false,
        apply(doc, ctx) {
            const objs = objects(doc);
            const o = ctx.rng.maybePick(objs);
            if (!o?.fields.length) return false;
            o.fields[0]!.type = named(`Missing${ctx.seq}`);
            return true;
        },
    },
    {
        id: "input.as.output",
        features: [],
        safe: false,
        apply(doc, ctx) {
            const input = doc.types.find((t) => t.kind === "inputObject");
            const o = ctx.rng.maybePick(objects(doc));
            if (!input || !o) return false;
            o.fields.push({ name: `bad${ctx.seq}`, type: named(input.name) });
            return true;
        },
    },
    {
        id: "dup.name",
        features: [],
        safe: false,
        apply(doc, ctx) {
            const o = ctx.rng.maybePick(objects(doc));
            if (!o || o.fields.length < 1) return false;
            o.fields.push({ ...o.fields[0]!, name: o.fields[0]!.name });
            return true;
        },
    },
];

export function applyMutations(
    doc: GraphQLDocument,
    ctx: MutCtx,
    n: number,
    allowInvalid: boolean,
): MutRecord[] {
    const ops = allowInvalid ? [...SAFE_OPS, ...INVALID_OPS] : SAFE_OPS;
    const records: MutRecord[] = [];
    for (let i = 0; i < n; i++) {
        const op = ctx.rng.pick(ops);
        ctx.seq++;
        const before = cloneDoc(doc);
        const ok = op.apply(doc, ctx);
        if (!ok) {
            // restore and skip
            doc.types = before.types;
            doc.directives = before.directives;
            doc.schema = before.schema;
            doc.extensions = before.extensions;
            continue;
        }
        records.push({ id: op.id, features: op.features });
    }
    return records;
}

export { SAFE_OPS, INVALID_OPS };
