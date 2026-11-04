import { HTTP_METHODS, type HttpMethod, type OpenAPIDocument, type OperationIR, type PathItemIR, type Ref, type SchemaIR } from "../ast/index.ts";

export type OpSite = {
    path: string;
    method: HttpMethod;
    item: PathItemIR;
    op: OperationIR;
};

export function cloneDoc(doc: OpenAPIDocument): OpenAPIDocument {
    return structuredClone(doc);
}

export function operationsOf(item: PathItemIR): OperationIR[] {
    const out: OperationIR[] = [];
    for (const m of HTTP_METHODS) {
        if (item[m]) out.push(item[m]!);
    }
    return out;
}

export function allOperations(doc: OpenAPIDocument): OpSite[] {
    const out: OpSite[] = [];
    const visit = (path: string, item: PathItemIR) => {
        if (item.$ref || item.pathItemRef) return;
        for (const method of HTTP_METHODS) {
            const op = item[method];
            if (op) out.push({ path, method, item, op });
        }
    };
    for (const [path, item] of Object.entries(doc.paths ?? {})) visit(path, item);
    for (const [name, item] of Object.entries(doc.webhooks ?? {})) visit(name, item);
    return out;
}

export function rewriteRefs(doc: OpenAPIDocument, table: string, from: string, to: string): void {
    const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            for (const x of node) walk(x);
            return;
        }
        const rec = node as Record<string, unknown>;
        if (rec.kind === "ref" && rec.target && typeof rec.target === "object") {
            const t = rec.target as { table?: string; name?: string };
            if (t.table === table && t.name === from) t.name = to;
        }
        if (typeof rec.$ref === "string") {
            const prefix = `#/components/${table}/`;
            if (rec.$ref === prefix + from) rec.$ref = prefix + to;
        }
        for (const [k, v] of Object.entries(rec)) {
            if (typeof v === "string" && v === `#/components/${table}/${from}`) {
                rec[k] = `#/components/${table}/${to}`;
            } else walk(v);
        }
    };
    walk(doc);
}

export function uniqueName(existing: Set<string> | Record<string, unknown> | undefined, base: string): string {
    const have = existing instanceof Set ? existing : new Set(Object.keys(existing ?? {}));
    if (!have.has(base)) return base;
    let i = 2;
    while (have.has(`${base}_${i}`)) i++;
    return `${base}_${i}`;
}

export function inlineSchemaSites(doc: OpenAPIDocument): Array<{ parent: Record<string, unknown>; key: string; schema: SchemaIR }> {
    const out: Array<{ parent: Record<string, unknown>; key: string; schema: SchemaIR }> = [];
    const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            for (const x of node) walk(x);
            return;
        }
        const rec = node as Record<string, unknown>;
        if (rec.kind === "inline" && rec.value && typeof rec.value === "object" && "kind" in (rec.value as object)) {
            out.push({ parent: rec, key: "value", schema: rec.value as SchemaIR });
        }
        for (const v of Object.values(rec)) walk(v);
    };
    walk(doc);
    return out;
}

export function schemaRefSites(doc: OpenAPIDocument): Array<Ref<SchemaIR> & { kind: "ref" }> {
    const out: Array<Ref<SchemaIR> & { kind: "ref" }> = [];
    const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            for (const x of node) walk(x);
            return;
        }
        const rec = node as Record<string, unknown>;
        if (rec.kind === "ref" && rec.target && typeof rec.target === "object") {
            const t = rec.target as { table?: string };
            if (t.table === "schemas") out.push(rec as Ref<SchemaIR> & { kind: "ref" });
        }
        for (const [k, v] of Object.entries(rec)) {
            if (k === "target") continue;
            walk(v);
        }
    };
    walk(doc);
    return out;
}
