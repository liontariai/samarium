import { COMPONENT_KEY_RE, dialectTable } from "../dialects/index.ts";
import { HTTP_METHODS, type OpenAPIDocument, type OperationIR, type ParameterIR, type PathItemIR, type Ref } from "../ast/index.ts";
import type { Dialect } from "../types.ts";

export function pathTemplateTokens(path: string): string[] {
    const out: string[] = [];
    const re = /\{([^{}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(path))) {
        out.push(m[1]!);
    }
    return out;
}

function inlineParams(item: PathItemIR, op?: OperationIR): ParameterIR[] {
    const out: ParameterIR[] = [];
    for (const p of item.parameters ?? []) {
        if (p.kind === "inline") out.push(p.value);
    }
    for (const p of op?.parameters ?? []) {
        if (p.kind === "inline") out.push(p.value);
    }
    return out;
}

function ensurePathParam(list: Ref<ParameterIR>[] | undefined, name: string): Ref<ParameterIR>[] {
    const next = list ? list.slice() : [];
    const has = next.some((p) => p.kind === "inline" && p.value.in === "path" && p.value.name === name);
    if (!has) {
        next.push({
            kind: "inline",
            value: {
                name,
                in: "path",
                required: true,
                style: "simple",
                schema: { kind: "inline", value: { kind: "primitive", type: "string" } },
            },
        });
    }
    return next;
}

function operationsOf(item: PathItemIR): OperationIR[] {
    const out: OperationIR[] = [];
    for (const m of HTTP_METHODS) {
        const op = item[m];
        if (op) out.push(op);
    }
    return out;
}

function uniquifyOp(
    op: OperationIR,
    opIds: Map<string, number>,
    schemeNames: Set<string>,
): void {
    if (op.security && op.security.length === 0) {
        // keep optional security
    } else {
        const nextOpSec = cleanReqs(op.security, schemeNames);
        if (nextOpSec) op.security = nextOpSec;
        else delete op.security;
    }
    if (op.operationId) {
        const n = (opIds.get(op.operationId) ?? 0) + 1;
        opIds.set(op.operationId, n);
        if (n > 1) op.operationId = `${op.operationId}_${n}`;
    }
    for (const resp of Object.values(op.responses)) {
        if (resp.kind === "inline" && !resp.value.description) {
            resp.value.description = "Response";
        }
    }
}

function uniquifyPathItem(item: PathItemIR, opIds: Map<string, number>, schemeNames: Set<string>): void {
    for (const op of operationsOf(item)) {
        uniquifyOp(op, opIds, schemeNames);
        if (!op.callbacks) continue;
        for (const cb of Object.values(op.callbacks)) {
            if (cb.kind !== "inline") continue;
            for (const nested of Object.values(cb.value)) uniquifyPathItem(nested, opIds, schemeNames);
        }
    }
}

function sanitizeKey(name: string): string {
    const s = name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    return s.length ? s : "X";
}

function rewriteSchemaRefs(doc: OpenAPIDocument, rename: Map<string, string>): void {
    const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            for (const x of node) walk(x);
            return;
        }
        const rec = node as Record<string, unknown>;
        if (rec.kind === "ref" && rec.target && typeof rec.target === "object") {
            const t = rec.target as { table?: string; name?: string };
            if (t.table === "schemas" && t.name && rename.has(t.name)) {
                t.name = rename.get(t.name)!;
            }
        }
        for (const v of Object.values(rec)) walk(v);
    };
    walk(doc);
}

function cleanReqs(
    reqs: Record<string, string[]>[] | undefined,
    schemeNames: Set<string>,
): Record<string, string[]>[] | undefined {
    if (!reqs) return undefined;
    const result = reqs
        .map((r) => {
            if (Object.keys(r).length === 0) return r;
            const o: Record<string, string[]> = {};
            for (const [k, v] of Object.entries(r)) {
                if (schemeNames.has(k)) o[k] = v;
            }
            return o;
        })
        .filter((r) => Object.keys(r).length === 0 || Object.keys(r).length > 0);
    return result.length ? result : undefined;
}

/**
 * Deterministic consistency pass. Must not use RNG.
 */
export function repair(doc: OpenAPIDocument, dialect: Dialect): OpenAPIDocument {
    const table = dialectTable(dialect);

    if (!doc.info) doc.info = { title: "Generated API", version: "1.0.0" };
    if (!doc.info.title) doc.info.title = "Generated API";
    if (!doc.info.version) doc.info.version = "1.0.0";

    if (dialect === "3.0") {
        delete doc.jsonSchemaDialect;
        delete doc.webhooks;
        if (doc.info.license) delete doc.info.license.identifier;
        delete doc.info.summary;
        if (doc.components) delete doc.components.pathItems;
        doc.paths ??= {};
    } else if (!doc.paths && !doc.webhooks && !doc.components) {
        doc.paths = {};
    }

    doc.openapi = doc.openapi || table.defaultVersion;

    const schemeNames = new Set(Object.keys(doc.components?.securitySchemes ?? {}));
    if (doc.security && doc.security.length === 0) {
        // keep optional document security
    } else {
        const nextSec = cleanReqs(doc.security, schemeNames);
        if (nextSec) doc.security = nextSec;
        else delete doc.security;
    }

    const opIds = new Map<string, number>();

    for (const [path, item] of Object.entries(doc.paths ?? {})) {
        if (!path.startsWith("/") && doc.paths) {
            const fixed = `/${path}`;
            doc.paths[fixed] = item;
            delete doc.paths[path];
        }
        const tokens = pathTemplateTokens(path.startsWith("/") ? path : `/${path}`);
        const ops = operationsOf(item);

        for (const t of tokens) {
            const covered = ops.some((op) => inlineParams(item, op).some((p) => p.in === "path" && p.name === t));
            if (!covered) {
                if (ops.length === 0) item.parameters = ensurePathParam(item.parameters, t);
                else {
                    for (const op of ops) {
                        if (!inlineParams(item, op).some((p) => p.in === "path" && p.name === t)) {
                            op.parameters = ensurePathParam(op.parameters, t);
                        }
                    }
                }
            }
        }

        const dropExtra = (list: Ref<ParameterIR>[] | undefined) =>
            list?.filter((p) => p.kind !== "inline" || p.value.in !== "path" || tokens.includes(p.value.name));
        item.parameters = dropExtra(item.parameters);

        const seenPathItem = new Set<string>();
        item.parameters = item.parameters?.filter((p) => {
            if (p.kind !== "inline") return true;
            const k = `${p.value.name}|${p.value.in}`;
            if (seenPathItem.has(k)) return false;
            seenPathItem.add(k);
            return true;
        });

        for (const op of ops) {
            op.parameters = dropExtra(op.parameters);

            const seen = new Set(seenPathItem);
            op.parameters = op.parameters?.filter((p) => {
                if (p.kind !== "inline") return true;
                const k = `${p.value.name}|${p.value.in}`;
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });

            for (const p of inlineParams(item, op)) {
                if (p.in === "path") {
                    p.required = true;
                    if (!p.style) p.style = "simple";
                }
            }

            uniquifyOp(op, opIds, schemeNames);

            if (op.parameters && op.parameters.length === 0) delete op.parameters;
        }
        if (item.parameters && item.parameters.length === 0) delete item.parameters;
    }

    for (const item of Object.values(doc.webhooks ?? {})) {
        uniquifyPathItem(item, opIds, schemeNames);
    }
    for (const item of Object.values(doc.components?.pathItems ?? {})) {
        uniquifyPathItem(item, opIds, schemeNames);
    }
    for (const cb of Object.values(doc.components?.callbacks ?? {})) {
        for (const nested of Object.values(cb)) uniquifyPathItem(nested, opIds, schemeNames);
    }
    for (const item of Object.values(doc.paths ?? {})) {
        for (const op of operationsOf(item)) {
            if (!op.callbacks) continue;
            for (const cb of Object.values(op.callbacks)) {
                if (cb.kind !== "inline") continue;
                for (const nested of Object.values(cb.value)) uniquifyPathItem(nested, opIds, schemeNames);
            }
        }
    }

    const schemas = doc.components?.schemas;
    if (schemas) {
        const rename = new Map<string, string>();
        const next: typeof schemas = {};
        for (const [k, v] of Object.entries(schemas)) {
            let nk = COMPONENT_KEY_RE.test(k) ? k : sanitizeKey(k);
            if (nk in next) {
                let i = 2;
                while (`${nk}_${i}` in next) i++;
                nk = `${nk}_${i}`;
            }
            if (nk !== k) rename.set(k, nk);
            next[nk] = v;
        }
        doc.components!.schemas = next;
        if (rename.size) rewriteSchemaRefs(doc, rename);
    }

    const known = new Set(Object.keys(doc.components?.schemas ?? {}));
    const dangling: string[] = [];
    const collect = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            for (const x of node) collect(x);
            return;
        }
        const rec = node as Record<string, unknown>;
        if (rec.kind === "ref" && rec.target && typeof rec.target === "object") {
            const t = rec.target as { table?: string; name?: string };
            if (t.table === "schemas" && t.name && !known.has(t.name)) dangling.push(t.name);
        }
        for (const v of Object.values(rec)) collect(v);
    };
    collect(doc);
    if (dangling.length) {
        doc.components ??= {};
        doc.components.schemas ??= {};
        for (const name of dangling) {
            if (!doc.components.schemas[name]) {
                doc.components.schemas[name] = { kind: "primitive", type: "string" };
                known.add(name);
            }
        }
    }

    const usedTags = new Set<string>();
    for (const item of Object.values(doc.paths ?? {})) {
        for (const m of HTTP_METHODS) {
            for (const t of item[m]?.tags ?? []) usedTags.add(t);
        }
    }
    if (usedTags.size) {
        const have = new Set((doc.tags ?? []).map((t) => t.name));
        doc.tags = [...(doc.tags ?? [])];
        for (const name of usedTags) {
            if (!have.has(name)) doc.tags.push({ name });
        }
    }

    if (dialect === "3.0") {
        doc.paths ??= {};
        if (Object.keys(doc.paths).length === 0) {
            doc.paths["/ping"] = {
                get: {
                    operationId: "ping",
                    responses: {
                        "200": {
                            kind: "inline",
                            value: {
                                description: "OK",
                                content: {
                                    "text/plain": {
                                        schema: { kind: "inline", value: { kind: "primitive", type: "string" } },
                                    },
                                },
                            },
                        },
                    },
                },
            };
        }
    }

    return doc;
}
