import type { GeneratedSpec } from "../types.ts";
import type {
    ComponentTable,
    HttpMethod,
    OpenAPIDocument,
    OperationIR,
    PathItemIR,
    SchemaIR,
} from "../ast/index.ts";
import { HTTP_METHODS } from "../ast/index.ts";
import { repair } from "../cons/repair.ts";
import { toJsonString, toYamlString } from "../ser/index.ts";
import { cloneDoc, operationsOf } from "../mut/walk.ts";
import { hashText } from "../hash.ts";

export type ShrinkPredicate = (d: GeneratedSpec) => boolean | Promise<boolean>;

export type ShrinkOptions = {
    /** Cap on attempted reductions. Default 120. */
    maxSteps?: number;
};

const COMPONENT_TABLES: ComponentTable[] = [
    "schemas",
    "parameters",
    "responses",
    "requestBodies",
    "headers",
    "examples",
    "securitySchemes",
    "links",
    "callbacks",
    "pathItems",
];

const SCHEMA_KINDS = new Set(["primitive", "object", "array", "composition", "not", "opaque", "ref"]);

function isSchema(x: unknown): x is SchemaIR {
    return !!x && typeof x === "object" && SCHEMA_KINDS.has((x as { kind?: string }).kind ?? "");
}

function parseComponentPointer(ref: string): { table: string; name: string } | undefined {
    if (!ref.startsWith("#/components/")) return undefined;
    const rest = ref.slice("#/components/".length);
    const slash = rest.indexOf("/");
    if (slash < 0) return undefined;
    const table = rest.slice(0, slash);
    const name = rest
        .slice(slash + 1)
        .replace(/~1/g, "/")
        .replace(/~0/g, "~");
    return { table, name };
}

function collectComponentRefs(node: unknown, out: Set<string>): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
        for (const x of node) collectComponentRefs(x, out);
        return;
    }
    const rec = node as Record<string, unknown>;
    if (rec.kind === "ref" && rec.target && typeof rec.target === "object") {
        const t = rec.target as { table?: string; name?: string };
        if (t.table && t.name) out.add(`${t.table}/${t.name}`);
    }
    if (rec.$ref && typeof rec.$ref === "object") {
        const t = rec.$ref as { table?: string; name?: string };
        if (t.table && t.name) out.add(`${t.table}/${t.name}`);
    }
    if (typeof rec.$ref === "string") {
        const p = parseComponentPointer(rec.$ref);
        if (p) out.add(`${p.table}/${p.name}`);
    }
    if (typeof rec.pathItemRef === "string") {
        const p = parseComponentPointer(rec.pathItemRef);
        if (p) out.add(`${p.table}/${p.name}`);
    }
    for (const [k, v] of Object.entries(rec)) {
        if (k === "target") continue;
        collectComponentRefs(v, out);
    }
}

function collectSecuritySchemeNames(doc: OpenAPIDocument, out: Set<string>): void {
    const take = (reqs?: Record<string, string[]>[]) => {
        for (const r of reqs ?? []) {
            for (const name of Object.keys(r)) out.add(`securitySchemes/${name}`);
        }
    };
    take(doc.security);
    const visitItem = (item: PathItemIR) => {
        for (const op of operationsOf(item)) take(op.security);
    };
    for (const item of Object.values(doc.paths ?? {})) visitItem(item);
    for (const item of Object.values(doc.webhooks ?? {})) visitItem(item);
    for (const item of Object.values(doc.components?.pathItems ?? {})) visitItem(item);
}

function reachableComponents(doc: OpenAPIDocument): Set<string> {
    const out = new Set<string>();
    collectComponentRefs(doc.paths, out);
    collectComponentRefs(doc.webhooks, out);
    collectComponentRefs(doc.info, out);
    collectComponentRefs(doc.tags, out);
    collectComponentRefs(doc.servers, out);
    collectComponentRefs(doc.externalDocs, out);
    collectSecuritySchemeNames(doc, out);

    const components = doc.components;
    if (!components) return out;

    const pending = [...out];
    const seen = new Set(out);
    for (let i = 0; i < pending.length; i++) {
        const key = pending[i]!;
        const slash = key.indexOf("/");
        const table = key.slice(0, slash) as ComponentTable;
        const name = key.slice(slash + 1);
        const bag = components[table] as Record<string, unknown> | undefined;
        const body = bag?.[name];
        if (body === undefined) continue;
        const found = new Set<string>();
        collectComponentRefs(body, found);
        for (const k of found) {
            out.add(k);
            if (!seen.has(k)) {
                seen.add(k);
                pending.push(k);
            }
        }
    }
    return out;
}

function dropUnusedComponents(doc: OpenAPIDocument): boolean {
    const keep = reachableComponents(doc);
    const c = doc.components;
    if (!c) return false;
    let changed = false;
    for (const table of COMPONENT_TABLES) {
        const bag = c[table] as Record<string, unknown> | undefined;
        if (!bag) continue;
        for (const name of Object.keys(bag)) {
            if (!keep.has(`${table}/${name}`)) {
                delete bag[name];
                changed = true;
            }
        }
        if (Object.keys(bag).length === 0) {
            delete c[table];
            changed = true;
        }
    }
    if (c.extensions && Object.keys(c.extensions).length === 0) delete c.extensions;
    if (Object.keys(c).length === 0) {
        delete doc.components;
        changed = true;
    }
    return changed;
}

function stripDecorations(node: unknown): boolean {
    let changed = false;
    const walk = (n: unknown): void => {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) {
            for (const x of n) walk(x);
            return;
        }
        const rec = n as Record<string, unknown>;
        for (const k of ["description", "summary", "example", "examples", "extensions", "externalDocs", "xml", "deprecated"] as const) {
            if (k in rec && rec[k] !== undefined) {
                delete rec[k];
                changed = true;
            }
        }
        for (const [k, v] of Object.entries(rec)) {
            if (k === "target") continue;
            walk(v);
        }
    };
    walk(node);
    return changed;
}

function stringSchema(): SchemaIR {
    return { kind: "primitive", type: "string" };
}

function schemaIsAlreadyString(s: SchemaIR): boolean {
    return s.kind === "primitive" && s.type === "string" && !s.types && !s.format && !s.enum && s.const === undefined;
}

/** Mutable sites holding a SchemaIR (not a $ref wrapper). */
function schemaAssigners(doc: OpenAPIDocument): Array<{ get: () => SchemaIR; set: (s: SchemaIR) => void }> {
    const out: Array<{ get: () => SchemaIR; set: (s: SchemaIR) => void }> = [];
    const seen = new Set<unknown>();
    const walk = (node: unknown): void => {
        if (!node || typeof node !== "object" || seen.has(node)) return;
        seen.add(node);
        if (Array.isArray(node)) {
            for (const x of node) walk(x);
            return;
        }
        const rec = node as Record<string, unknown>;
        if (rec.kind === "inline" && isSchema(rec.value)) {
            out.push({
                get: () => rec.value as SchemaIR,
                set: (s) => {
                    rec.value = s;
                },
            });
        }
        for (const [k, v] of Object.entries(rec)) {
            if (k === "target") continue;
            walk(v);
        }
    };
    for (const [name, schema] of Object.entries(doc.components?.schemas ?? {})) {
        const bag = doc.components!.schemas!;
        out.push({
            get: () => bag[name]!,
            set: (s) => {
                bag[name] = s;
            },
        });
        walk(schema);
    }
    walk(doc.paths);
    walk(doc.webhooks);
    walk(doc.components);
    return out;
}

function countSchemaRefUses(doc: OpenAPIDocument): Map<string, number> {
    const counts = new Map<string, number>();
    const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            for (const x of node) walk(x);
            return;
        }
        const rec = node as Record<string, unknown>;
        if (rec.kind === "ref" && rec.target && typeof rec.target === "object") {
            const t = rec.target as { table?: string; name?: string };
            if (t.table === "schemas" && t.name) counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
        }
        if (rec.kind === "ref" && rec.target && typeof rec.target === "object") {
            // still walk children except target
        }
        for (const [k, v] of Object.entries(rec)) {
            if (k === "target") continue;
            walk(v);
        }
    };
    walk(doc);
    return counts;
}

function inlineSchemaRef(doc: OpenAPIDocument, name: string): boolean {
    const schema = doc.components?.schemas?.[name];
    if (!schema) return false;
    const body = structuredClone(schema);
    let changed = false;
    const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            for (const x of node) walk(x);
            return;
        }
        const rec = node as Record<string, unknown>;
        if (rec.kind === "ref" && rec.target && typeof rec.target === "object") {
            const t = rec.target as { table?: string; name?: string };
            if (t.table === "schemas" && t.name === name) {
                rec.kind = "inline";
                rec.value = structuredClone(body);
                delete rec.target;
                changed = true;
                return;
            }
        }
        if (isSchema(rec) && rec.kind === "ref" && rec.target?.table === "schemas" && rec.target.name === name) {
            const clone = structuredClone(body) as unknown as Record<string, unknown>;
            for (const k of Object.keys(rec)) delete rec[k];
            Object.assign(rec, clone);
            changed = true;
            return;
        }
        for (const [k, v] of Object.entries(rec)) {
            if (k === "target") continue;
            walk(v);
        }
    };
    walk(doc);
    return changed;
}

function dropPath(doc: OpenAPIDocument, path: string): boolean {
    if (!doc.paths || !(path in doc.paths)) return false;
    delete doc.paths[path];
    if (Object.keys(doc.paths).length === 0 && !doc.webhooks) {
        // keep empty map for 3.0
        doc.paths = {};
    }
    return true;
}

function dropWebhook(doc: OpenAPIDocument, name: string): boolean {
    if (!doc.webhooks || !(name in doc.webhooks)) return false;
    delete doc.webhooks[name];
    if (Object.keys(doc.webhooks).length === 0) delete doc.webhooks;
    return true;
}

function dropMethod(item: PathItemIR, method: HttpMethod): boolean {
    if (!item[method]) return false;
    delete item[method];
    return true;
}

function slimOperation(op: OperationIR): boolean {
    let changed = false;
    if (op.callbacks) {
        delete op.callbacks;
        changed = true;
    }
    if (op.servers) {
        delete op.servers;
        changed = true;
    }
    if (op.tags) {
        delete op.tags;
        changed = true;
    }
    if (op.security) {
        delete op.security;
        changed = true;
    }
    if (op.externalDocs) {
        delete op.externalDocs;
        changed = true;
    }
    for (const resp of Object.values(op.responses)) {
        if (resp.kind === "inline" && resp.value.links) {
            delete resp.value.links;
            changed = true;
        }
    }
    const codes = Object.keys(op.responses);
    const keep =
        codes.find((c) => c.startsWith("2")) ??
        codes.find((c) => c === "default") ??
        codes[0];
    if (keep && codes.length > 1) {
        for (const c of codes) {
            if (c !== keep) {
                delete op.responses[c];
                changed = true;
            }
        }
    }
    return changed;
}

/**
 * Re-serialize a (possibly mutated) IR as a single stable-key YAML document.
 * Shrinks always use stable key order so repros stay readable.
 */
export function packShrunk(base: GeneratedSpec, ir: OpenAPIDocument): GeneratedSpec {
    const repaired = repair(ir, base.meta.dialect);
    const yaml = toYamlString(repaired);
    const json = toJsonString(repaired);
    return {
        ir: repaired,
        files: { "openapi.yaml": yaml },
        meta: {
            ...base.meta,
            bytes: yaml.length,
            hash: hashText(json),
            mutations: base.meta.mutations,
        },
    };
}

/** One-shot cut: keep a single path/method, strip, drop unused. Cheap for oracle shrink. */
function aggressiveMin(doc: OpenAPIDocument): OpenAPIDocument | null {
    const next = cloneDoc(doc);
    const paths = Object.keys(next.paths ?? {});
    for (const p of paths.slice(1)) delete next.paths![p];
    const hooks = Object.keys(next.webhooks ?? {});
    for (const w of hooks.slice(1)) delete next.webhooks![w];
    for (const item of [...Object.values(next.paths ?? {}), ...Object.values(next.webhooks ?? {})]) {
        const methods = HTTP_METHODS.filter((m) => item[m]);
        for (const m of methods.slice(1)) delete item[m];
        for (const m of HTTP_METHODS) {
            if (item[m]) slimOperation(item[m]!);
        }
    }
    stripDecorations(next);
    dropUnusedComponents(next);
    if (toJsonString(next) === toJsonString(doc)) return null;
    return next;
}

function* candidates(doc: OpenAPIDocument): Generator<OpenAPIDocument> {
    const coarse = aggressiveMin(doc);
    if (coarse) yield coarse;
    {
        // Crash oracles that walk every component schema still fail with empty paths.
        const next = cloneDoc(doc);
        let changed = false;
        if (next.paths && Object.keys(next.paths).length) {
            next.paths = {};
            changed = true;
        }
        if (next.webhooks) {
            delete next.webhooks;
            changed = true;
        }
        if (next.components) {
            for (const table of COMPONENT_TABLES) {
                if (table === "schemas") continue;
                if (next.components[table]) {
                    delete next.components[table];
                    changed = true;
                }
            }
        }
        if (changed) yield next;
    }
    {
        const next = cloneDoc(doc);
        if (dropUnusedComponents(next)) yield next;
    }
    {
        const next = cloneDoc(doc);
        if (stripDecorations(next)) yield next;
    }
    for (const path of Object.keys(doc.paths ?? {})) {
        const next = cloneDoc(doc);
        if (dropPath(next, path)) yield next;
    }
    for (const name of Object.keys(doc.webhooks ?? {})) {
        const next = cloneDoc(doc);
        if (dropWebhook(next, name)) yield next;
    }
    for (const path of Object.keys(doc.paths ?? {})) {
        const item = doc.paths![path]!;
        for (const method of HTTP_METHODS) {
            if (!item[method]) continue;
            const next = cloneDoc(doc);
            if (dropMethod(next.paths![path]!, method)) yield next;
        }
    }
    for (const path of Object.keys(doc.paths ?? {})) {
        const item = doc.paths![path]!;
        for (const method of HTTP_METHODS) {
            if (!item[method]) continue;
            const next = cloneDoc(doc);
            if (slimOperation(next.paths![path]![method]!)) yield next;
        }
    }
    {
        const sites = schemaAssigners(doc);
        let yielded = 0;
        for (let i = 0; i < sites.length && yielded < 8; i++) {
            if (schemaIsAlreadyString(sites[i]!.get()) || sites[i]!.get().kind === "ref") continue;
            const next = cloneDoc(doc);
            const nextSites = schemaAssigners(next);
            const site = nextSites[i];
            if (!site) continue;
            if (schemaIsAlreadyString(site.get()) || site.get().kind === "ref") continue;
            site.set(stringSchema());
            yielded++;
            yield next;
        }
    }
    {
        const uses = countSchemaRefUses(doc);
        for (const [name, n] of uses) {
            if (n !== 1) continue;
            const next = cloneDoc(doc);
            if (inlineSchemaRef(next, name)) {
                dropUnusedComponents(next);
                yield next;
            }
        }
    }
    if (doc.tags && doc.tags.length) {
        const next = cloneDoc(doc);
        delete next.tags;
        yield next;
    }
    if (doc.servers && doc.servers.length > 1) {
        const next = cloneDoc(doc);
        next.servers = next.servers!.slice(0, 1);
        yield next;
    }
    if (doc.security) {
        const next = cloneDoc(doc);
        delete next.security;
        yield next;
    }
}

/**
 * Classic local-minimum shrink. Keeps a reduction only when `pred` stays true.
 * Always `repair`s so a valid input stays a valid document.
 */
export async function shrink(doc: GeneratedSpec, pred: ShrinkPredicate, opts: ShrinkOptions = {}): Promise<GeneratedSpec> {
    const maxSteps = opts.maxSteps ?? 120;
    let current = packShrunk(doc, cloneDoc(doc.ir));
    if (!(await pred(current))) return current;

    let steps = 0;
    let improved = true;
    while (improved && steps < maxSteps) {
        improved = false;
        for (const cand of candidates(current.ir)) {
            steps++;
            const packed = packShrunk(current, cand);
            if (packed.meta.hash !== current.meta.hash && (await pred(packed))) {
                current = packed;
                improved = true;
                break;
            }
            if (steps >= maxSteps) break;
        }
    }
    if (current.meta.hash !== doc.meta.hash) {
        current = {
            ...current,
            meta: { ...current.meta, mutations: [...doc.meta.mutations, "shrink"] },
        };
    }
    return current;
}
