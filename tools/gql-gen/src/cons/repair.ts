import {
    BUILTIN_SCALARS,
    named,
    type FieldIR,
    type GraphQLDocument,
    type NamedTypeIR,
    type TypeRef,
    unwrapNamed,
} from "../ast/index.ts";

const BUILTIN = new Set<string>(BUILTIN_SCALARS);

function unwrapNonNull(t: TypeRef): TypeRef {
    return t.kind === "nonNull" ? unwrapNonNull(t.of) : t;
}

/** Collapse illegal `T!!` and normalize list/non-null nesting. */
export function normalizeTypeRef(t: TypeRef): TypeRef {
    if (t.kind === "named") return t;
    if (t.kind === "list") return { kind: "list", of: normalizeTypeRef(t.of) };
    // nonNull
    const inner = normalizeTypeRef(t.of);
    if (inner.kind === "nonNull") return inner; // T!! → T!
    return { kind: "nonNull", of: inner };
}

function typeMap(doc: GraphQLDocument): Map<string, NamedTypeIR> {
    return new Map(doc.types.map((t) => [t.name, t]));
}

function stubScalar(doc: GraphQLDocument, name: string): void {
    if (BUILTIN.has(name)) return;
    if (doc.types.some((t) => t.name === name)) return;
    doc.types.push({ kind: "scalar", name });
}

function fixTypeRef(doc: GraphQLDocument, t: TypeRef): TypeRef {
    if (t.kind === "named") {
        if (!BUILTIN.has(t.name) && !doc.types.some((x) => x.name === t.name)) {
            stubScalar(doc, t.name);
        }
        return t;
    }
    if (t.kind === "list") return { kind: "list", of: fixTypeRef(doc, t.of) };
    return { kind: "nonNull", of: fixTypeRef(doc, t.of) };
}

function dedupeFields(fields: FieldIR[]): FieldIR[] {
    const seen = new Set<string>();
    const out: FieldIR[] = [];
    for (const f of fields) {
        if (seen.has(f.name)) continue;
        seen.add(f.name);
        out.push(f);
    }
    return out.length ? out : [{ name: "id", type: named("ID") }];
}

/**
 * Deterministic repair so Layer B/C can pass after generation or safe mutation.
 */
export function repair(doc: GraphQLDocument): GraphQLDocument {
    // Unique type names
    const used = new Set<string>();
    for (const t of doc.types) {
        let name = t.name.startsWith("__") ? t.name.slice(2) || "Type" : t.name;
        if (!name) name = "Type";
        let i = 1;
        const base = name;
        while (used.has(name)) name = `${base}${i++}`;
        t.name = name;
        used.add(name);
    }

    // Unique directive names
    const dUsed = new Set<string>();
    for (const d of doc.directives) {
        let name = d.name;
        let i = 1;
        const base = name;
        while (dUsed.has(name) || ["skip", "include", "deprecated", "specifiedBy", "oneOf"].includes(name)) {
            // allow redefining only custom; if clash with builtin, rename
            if (["skip", "include", "deprecated", "specifiedBy", "oneOf"].includes(base) && !dUsed.has(base)) break;
            if (dUsed.has(name)) name = `${base}${i++}`;
            else if (["skip", "include", "deprecated", "specifiedBy", "oneOf"].includes(name)) name = `${base}Custom${i++}`;
            else break;
        }
        d.name = name;
        dUsed.add(name);
        if (!d.locations.length) d.locations = ["FIELD"];
    }

    // Fix dangling refs by stubbing scalars
    for (const t of doc.types) {
        if (t.kind === "object" || t.kind === "interface") {
            t.fields = dedupeFields(t.fields).map((f) => ({
                ...f,
                type: normalizeTypeRef(fixTypeRef(doc, f.type)),
                args: f.args?.map((a) => ({
                    ...a,
                    type: normalizeTypeRef(fixTypeRef(doc, a.type)),
                    defaultValue: a.type.kind === "nonNull" ? undefined : a.defaultValue,
                })),
            }));
            // Drop bad implements
            if (t.interfaces) {
                t.interfaces = t.interfaces.filter((i) => doc.types.some((x) => x.kind === "interface" && x.name === i));
            }
        }
        if (t.kind === "inputObject") {
            const seen = new Set<string>();
            t.fields = t.fields
                .filter((f) => {
                    if (seen.has(f.name)) return false;
                    seen.add(f.name);
                    return true;
                })
                .map((f) => ({ ...f, type: normalizeTypeRef(fixTypeRef(doc, f.type)) }));
            if (!t.fields.length) t.fields = [{ name: "value", type: named("String") }];
            if (t.isOneOf) {
                t.fields = t.fields.map((f) => ({
                    name: f.name,
                    type: unwrapNonNull(f.type),
                    description: f.description,
                    directives: f.directives,
                }));
            }
        }
        if (t.kind === "union") {
            t.members = t.members.filter((m) => doc.types.some((x) => x.kind === "object" && x.name === m));
            if (t.members.length < 1) {
                // create a stub object member
                const stub = `${t.name}Member`;
                if (!doc.types.some((x) => x.name === stub)) {
                    doc.types.push({ kind: "object", name: stub, fields: [{ name: "id", type: named("ID") }] });
                }
                t.members = [stub];
            }
        }
        if (t.kind === "enum") {
            const vs = new Set<string>();
            t.values = t.values.filter((v) => {
                if (vs.has(v.name)) return false;
                vs.add(v.name);
                return true;
            });
            if (!t.values.length) t.values = [{ name: "VALUE" }];
        }
    }

    // Ensure interface fields present on implementors with exact types (covariance-safe)
    const map = typeMap(doc);
    for (const t of doc.types) {
        if (t.kind !== "object" && t.kind !== "interface") continue;
        for (const ifaceName of t.interfaces ?? []) {
            const iface = map.get(ifaceName);
            if (!iface || iface.kind !== "interface") continue;
            for (const req of iface.fields) {
                const existing = t.fields.find((f) => f.name === req.name);
                if (!existing) {
                    t.fields.push({
                        name: req.name,
                        type: structuredClone(req.type),
                        args: req.args ? structuredClone(req.args) : undefined,
                        description: req.description,
                    });
                } else {
                    existing.type = structuredClone(req.type);
                    existing.args = req.args ? structuredClone(req.args) : existing.args;
                }
            }
        }
    }

    // Coerce input-as-output / output-as-input by stubbing or renaming misuse is hard;
    // replace illegal field types with String
    const refresh = typeMap(doc);
    const isInput = (name: string) =>
        BUILTIN.has(name) ||
        refresh.get(name)?.kind === "inputObject" ||
        refresh.get(name)?.kind === "enum" ||
        refresh.get(name)?.kind === "scalar";
    const isOutput = (name: string) =>
        BUILTIN.has(name) ||
        refresh.get(name)?.kind === "object" ||
        refresh.get(name)?.kind === "interface" ||
        refresh.get(name)?.kind === "union" ||
        refresh.get(name)?.kind === "enum" ||
        refresh.get(name)?.kind === "scalar";

    for (const t of doc.types) {
        if (t.kind === "object" || t.kind === "interface") {
            for (const f of t.fields) {
                const n = unwrapNamed(f.type);
                if (!isOutput(n)) f.type = named("String");
                for (const a of f.args ?? []) {
                    const an = unwrapNamed(a.type);
                    if (!isInput(an)) a.type = named("String");
                }
            }
        }
        if (t.kind === "inputObject") {
            for (const f of t.fields) {
                const n = unwrapNamed(f.type);
                if (!isInput(n)) f.type = named("String");
            }
        }
    }

    // Ensure Query root
    let queryName = doc.schema?.query ?? "Query";
    let q = doc.types.find((t) => t.name === queryName);
    if (!q || q.kind !== "object") {
        queryName = "Query";
        q = doc.types.find((t) => t.name === "Query");
        if (!q || q.kind !== "object") {
            doc.types.push({
                kind: "object",
                name: "Query",
                fields: [{ name: "hello", type: named("String") }],
            });
        }
        queryName = "Query";
    }
    doc.schema = { ...(doc.schema ?? {}), query: queryName };

    if (doc.schema.mutation) {
        const m = doc.types.find((t) => t.name === doc.schema!.mutation);
        if (!m || m.kind !== "object") {
            delete doc.schema.mutation;
        }
    }
    if (doc.schema.subscription) {
        const s = doc.types.find((t) => t.name === doc.schema!.subscription);
        if (!s || s.kind !== "object") {
            delete doc.schema.subscription;
        }
    }

    // Fix extensions targeting missing types — drop them
    if (doc.extensions) {
        doc.extensions = doc.extensions.filter((e) => {
            if (e.kind === "schema") return true;
            return doc.types.some((t) => t.name === e.name);
        });
    }

    return doc;
}
