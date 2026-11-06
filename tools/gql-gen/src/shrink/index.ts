import { cloneDoc, named, type GraphQLDocument, type NamedTypeIR } from "../ast/index.ts";
import { repair } from "../cons/repair.ts";
import { hashText } from "../hash.ts";
import { toSdl, toStableSdl } from "../ser/index.ts";
import type { GeneratedSpec } from "../types.ts";

export type ShrinkPredicate = (d: GeneratedSpec) => boolean | Promise<boolean>;

export type ShrinkOptions = {
    maxSteps?: number;
};

function pack(ir: GraphQLDocument, base: GeneratedSpec): GeneratedSpec {
    const fixed = repair(cloneDoc(ir));
    const sdl = toSdl(fixed);
    return {
        ir: fixed,
        files: { "schema.graphql": sdl },
        meta: {
            ...base.meta,
            bytes: sdl.length,
            hash: hashText(toStableSdl(fixed)),
            mutations: [...base.meta.mutations, "shrink"],
        },
    };
}

function rootNames(doc: GraphQLDocument): Set<string> {
    return new Set(
        [doc.schema?.query, doc.schema?.mutation, doc.schema?.subscription].filter(Boolean) as string[],
    );
}

function dropUnusedTypes(doc: GraphQLDocument): GraphQLDocument {
    const next = cloneDoc(doc);
    const roots = rootNames(next);
    const referenced = new Set<string>(roots);
    const visit = (name: string) => {
        if (referenced.has(name)) return;
        // mark during scan below
    };
    // Collect refs from kept roots only first pass — keep all for safety if tiny
    const keep = new Set(roots);
    for (const t of next.types) {
        if (keep.has(t.name)) continue;
        if (t.kind === "object" || t.kind === "interface") {
            // drop if not referenced by name string search in other kept types — simplified: drop half unused
        }
    }
    // Drop types not named in any field of root-reachable set (BFS)
    const queue = [...roots];
    const reach = new Set(roots);
    while (queue.length) {
        const n = queue.pop()!;
        const t = next.types.find((x) => x.name === n);
        if (!t) continue;
        const refs: string[] = [];
        if (t.kind === "object" || t.kind === "interface") {
            for (const f of t.fields) {
                const walk = (tr: { kind: string; name?: string; of?: unknown }): void => {
                    if (tr.kind === "named" && tr.name) refs.push(tr.name);
                    else if (tr.of) walk(tr.of as { kind: string; name?: string; of?: unknown });
                };
                walk(f.type);
                for (const a of f.args ?? []) walk(a.type);
            }
            refs.push(...(t.interfaces ?? []));
        }
        if (t.kind === "union") refs.push(...t.members);
        if (t.kind === "inputObject") {
            for (const f of t.fields) {
                let tr = f.type;
                while (tr.kind !== "named") tr = tr.of;
                refs.push(tr.name);
            }
        }
        for (const r of refs) {
            if (!reach.has(r)) {
                reach.add(r);
                queue.push(r);
            }
        }
    }
    next.types = next.types.filter((t) => reach.has(t.name) || t.kind === "scalar");
    void visit;
    void referenced;
    return next;
}

function simplifyFields(doc: GraphQLDocument): GraphQLDocument {
    const next = cloneDoc(doc);
    for (const t of next.types) {
        if (t.kind === "object" || t.kind === "interface") {
            t.fields = t.fields.slice(0, Math.max(1, Math.ceil(t.fields.length / 2))).map((f) => ({
                name: f.name,
                type: named("String"),
            }));
        }
    }
    return next;
}

function dropOptionalRoots(doc: GraphQLDocument): GraphQLDocument {
    const next = cloneDoc(doc);
    if (next.schema?.subscription) {
        const name = next.schema.subscription;
        delete next.schema.subscription;
        next.types = next.types.filter((t) => t.name !== name);
        return next;
    }
    if (next.schema?.mutation) {
        const name = next.schema.mutation;
        delete next.schema.mutation;
        next.types = next.types.filter((t) => t.name !== name);
        return next;
    }
    return next;
}

function collapseUnions(doc: GraphQLDocument): GraphQLDocument {
    const next = cloneDoc(doc);
    for (const t of next.types) {
        if (t.kind === "union" && t.members.length > 1) {
            t.members = t.members.slice(0, 1);
        }
    }
    return next;
}

function dropExtensions(doc: GraphQLDocument): GraphQLDocument {
    const next = cloneDoc(doc);
    next.extensions = undefined;
    return next;
}

function dropDirectives(doc: GraphQLDocument): GraphQLDocument {
    const next = cloneDoc(doc);
    next.directives = [];
    for (const t of next.types) {
        t.directives = undefined;
        if (t.kind === "object" || t.kind === "interface") {
            for (const f of t.fields) {
                f.directives = undefined;
                f.deprecationReason = undefined;
            }
        }
    }
    return next;
}

export async function shrink(
    spec: GeneratedSpec,
    pred: ShrinkPredicate,
    opts: ShrinkOptions = {},
): Promise<GeneratedSpec> {
    const maxSteps = opts.maxSteps ?? 120;
    let current = pack(spec.ir, spec);
    if (!(await pred(current))) return current;

    const candidates: Array<(d: GraphQLDocument) => GraphQLDocument> = [
        dropExtensions,
        dropDirectives,
        dropOptionalRoots,
        collapseUnions,
        dropUnusedTypes,
        simplifyFields,
        (d) => {
            const n = cloneDoc(d);
            n.types = n.types.filter((t) => t.name === n.schema?.query || t.kind === "scalar");
            const q = n.types.find((t) => t.name === n.schema?.query);
            if (q && (q.kind === "object" || q.kind === "interface")) {
                (q as NamedTypeIR & { fields: { name: string; type: ReturnType<typeof named> }[] }).fields = [
                    { name: "hello", type: named("String") },
                ];
            }
            return n;
        },
    ];

    let steps = 0;
    let progressed = true;
    while (progressed && steps < maxSteps) {
        progressed = false;
        for (const fn of candidates) {
            if (steps >= maxSteps) break;
            const nextIr = fn(current.ir);
            const packed = pack(nextIr, current);
            steps++;
            if (await pred(packed)) {
                current = packed;
                progressed = true;
            }
        }
    }
    return current;
}
