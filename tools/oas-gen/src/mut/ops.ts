import type { Dialect } from "../types.ts";
import type { OpenAPIDocument, ParameterIR, PathItemIR, SchemaIR } from "../ast/index.ts";
import type { Rng } from "../rng.ts";
import { allOperations, operationsOf, rewriteRefs, uniqueName } from "./walk.ts";

export type MutationRecord = {
    id: string;
    validExpected: boolean;
    details: string;
    features: string[];
};

export type MutCtx = {
    rng: Rng;
    dialect: Dialect;
    seq: number;
};

function nextId(ctx: MutCtx, prefix: string): string {
    ctx.seq++;
    return `${prefix}${ctx.seq}`;
}

type Operator = (doc: OpenAPIDocument, ctx: MutCtx) => MutationRecord | null;

function strSchema(): SchemaIR {
    return { kind: "primitive", type: "string" };
}

const renameSchema: Operator = (doc, ctx) => {
    const schemas = doc.components?.schemas;
    if (!schemas) return null;
    const names = Object.keys(schemas);
    if (!names.length) return null;
    const from = ctx.rng.pick(names);
    const to = uniqueName(schemas, `${from}Renamed`);
    schemas[to] = schemas[from]!;
    delete schemas[from];
    rewriteRefs(doc, "schemas", from, to);
    return { id: "rename-schema", validExpected: true, details: `${from} -> ${to}`, features: [] };
};

const addUnusedSchema: Operator = (doc, ctx) => {
    doc.components ??= {};
    doc.components.schemas ??= {};
    const name = uniqueName(doc.components.schemas, nextId(ctx, "UnusedMut"));
    doc.components.schemas[name] = strSchema();
    return { id: "add-unused-schema", validExpected: true, details: name, features: ["components.unused"] };
};

const addQueryParam: Operator = (doc, ctx) => {
    const ops = allOperations(doc);
    if (!ops.length) return null;
    const site = ctx.rng.pick(ops);
    const name = nextId(ctx, "mut_q");
    const param: ParameterIR = {
        name,
        in: "query",
        required: false,
        style: "form",
        explode: true,
        schema: { kind: "inline", value: strSchema() },
    };
    site.op.parameters = [...(site.op.parameters ?? []), { kind: "inline", value: param }];
    return {
        id: "add-query-param",
        validExpected: true,
        details: `${site.method} ${site.path} ${name}`,
        features: ["param.in.query"],
    };
};

const add4xx: Operator = (doc, ctx) => {
    const ops = allOperations(doc).filter((s) => !s.op.responses["400"]);
    if (!ops.length) return null;
    const site = ctx.rng.pick(ops);
    site.op.responses["400"] = {
        kind: "inline",
        value: {
            description: "Bad request",
            content: {
                "application/json": {
                    schema: { kind: "inline", value: strSchema() },
                },
            },
        },
    };
    return {
        id: "add-4xx",
        validExpected: true,
        details: `${site.method} ${site.path}`,
        features: ["op.responses.4xx"],
    };
};

const addDefaultResponse: Operator = (doc, ctx) => {
    const ops = allOperations(doc).filter((s) => !s.op.responses.default);
    if (!ops.length) return null;
    const site = ctx.rng.pick(ops);
    site.op.responses.default = {
        kind: "inline",
        value: { description: "Default" },
    };
    return {
        id: "add-default-response",
        validExpected: true,
        details: `${site.method} ${site.path}`,
        features: ["op.responses.default"],
    };
};

const addExtension: Operator = (doc) => {
    doc.extensions = { ...(doc.extensions ?? {}), "x-oas-gen-mut": true };
    return { id: "add-extension", validExpected: true, details: "x-oas-gen-mut", features: ["doc.extension"] };
};

const toggleDeprecated: Operator = (doc, ctx) => {
    const ops = allOperations(doc);
    if (!ops.length) return null;
    const site = ctx.rng.pick(ops);
    site.op.deprecated = !site.op.deprecated;
    return {
        id: "toggle-deprecated",
        validExpected: true,
        details: `${site.method} ${site.path} -> ${site.op.deprecated}`,
        features: ["op.deprecated"],
    };
};

const addDescription: Operator = (doc, ctx) => {
    if (ctx.rng.bool(0.5) && !doc.info.description) {
        doc.info.description = "Mutated description.";
        return { id: "add-description", validExpected: true, details: "info", features: ["info.description"] };
    }
    const ops = allOperations(doc);
    if (!ops.length) return null;
    const site = ctx.rng.pick(ops);
    site.op.description = site.op.description ?? "Mutated operation.";
    site.op.summary = site.op.summary ?? "mut";
    return { id: "add-description", validExpected: true, details: site.path, features: [] };
};

const duplicatePath: Operator = (doc, ctx) => {
    const paths = Object.keys(doc.paths ?? {});
    if (!paths.length) return null;
    const src = ctx.rng.pick(paths);
    const item = doc.paths![src]!;
    if (item.$ref || item.pathItemRef) return null;
    const dest = uniqueName(doc.paths, `/mut-dup/${src.replace(/^\//, "")}`);
    const copy = structuredClone(item) as PathItemIR;
    for (const op of operationsOf(copy)) {
        if (op.operationId) op.operationId = `${op.operationId}Copy${ctx.seq + 1}`;
    }
    ctx.seq++;
    doc.paths![dest] = copy;
    return { id: "duplicate-path", validExpected: true, details: `${src} -> ${dest}`, features: ["path.static"] };
};

const swapMedia: Operator = (doc, ctx) => {
    const sites: Array<{ content: Record<string, unknown> }> = [];
    const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            for (const x of node) walk(x);
            return;
        }
        const rec = node as Record<string, unknown>;
        if (rec.content && typeof rec.content === "object" && !Array.isArray(rec.content)) {
            const c = rec.content as Record<string, unknown>;
            if ("application/json" in c || "application/vnd.api+json" in c) sites.push({ content: c });
        }
        for (const v of Object.values(rec)) walk(v);
    };
    walk(doc);
    if (!sites.length) return null;
    const { content } = ctx.rng.pick(sites);
    if (content["application/json"]) {
        content["application/vnd.api+json"] = content["application/json"];
        delete content["application/json"];
        return { id: "swap-media", validExpected: true, details: "json -> vnd.api+json", features: ["media.application/json"] };
    }
    if (content["application/vnd.api+json"]) {
        content["application/json"] = content["application/vnd.api+json"];
        delete content["application/vnd.api+json"];
        return { id: "swap-media", validExpected: true, details: "vnd.api+json -> json", features: ["media.application/json"] };
    }
    return null;
};

const addParamExample: Operator = (doc, ctx) => {
    const ops = allOperations(doc);
    for (const site of ctx.rng.shuffle(ops)) {
        for (const p of site.op.parameters ?? []) {
            if (p.kind !== "inline" || p.value.content || !p.value.schema) continue;
            if (p.value.example !== undefined || p.value.examples) continue;
            if (ctx.dialect === "3.0") {
                p.value.example = "sample";
                return { id: "add-param-example", validExpected: true, details: p.value.name, features: ["param.example"] };
            }
            p.value.examples = { one: { kind: "inline", value: { value: "sample" } } };
            return { id: "add-param-example", validExpected: true, details: p.value.name, features: ["param.examples"] };
        }
    }
    return null;
};

const extractInlineSchema: Operator = (doc, ctx) => {
    const ops = allOperations(doc);
    for (const site of ctx.rng.shuffle(ops)) {
        for (const p of site.op.parameters ?? []) {
            if (p.kind !== "inline" || p.value.schema?.kind !== "inline") continue;
            doc.components ??= {};
            doc.components.schemas ??= {};
            const name = uniqueName(doc.components.schemas, nextId(ctx, "Extracted"));
            doc.components.schemas[name] = p.value.schema.value;
            p.value.schema = { kind: "ref", target: { table: "schemas", name } };
            return {
                id: "extract-schema",
                validExpected: true,
                details: name,
                features: ["ref.local.components", "components.schemas"],
            };
        }
    }
    return null;
};

const inlineSchemaRef: Operator = (doc, ctx) => {
    const schemas = doc.components?.schemas;
    if (!schemas) return null;
    const ops = allOperations(doc);
    for (const site of ctx.rng.shuffle(ops)) {
        const rb = site.op.requestBody;
        if (rb?.kind === "inline") {
            for (const mt of Object.values(rb.value.content)) {
                if (mt.schema?.kind === "ref" && mt.schema.target.table === "schemas") {
                    const target = schemas[mt.schema.target.name];
                    if (!target || target.kind === "ref") continue;
                    mt.schema = { kind: "inline", value: structuredClone(target) };
                    return { id: "inline-ref", validExpected: true, details: site.path, features: [] };
                }
            }
        }
        for (const resp of Object.values(site.op.responses)) {
            if (resp.kind !== "inline" || !resp.value.content) continue;
            for (const mt of Object.values(resp.value.content)) {
                if (mt.schema?.kind === "ref" && mt.schema.target.table === "schemas") {
                    const target = schemas[mt.schema.target.name];
                    if (!target || target.kind === "ref") continue;
                    mt.schema = { kind: "inline", value: structuredClone(target) };
                    return { id: "inline-ref", validExpected: true, details: site.path, features: [] };
                }
            }
        }
    }
    return null;
};

const extractParam: Operator = (doc, ctx) => {
    const ops = allOperations(doc);
    for (const site of ctx.rng.shuffle(ops)) {
        const idx = (site.op.parameters ?? []).findIndex((p) => p.kind === "inline" && p.value.in !== "path");
        if (idx < 0) continue;
        const p = site.op.parameters![idx]!;
        if (p.kind !== "inline") continue;
        doc.components ??= {};
        doc.components.parameters ??= {};
        const name = uniqueName(doc.components.parameters, nextId(ctx, "Param"));
        doc.components.parameters[name] = p.value;
        site.op.parameters![idx] = { kind: "ref", target: { table: "parameters", name } };
        return { id: "extract-param", validExpected: true, details: name, features: ["op.parameters.ref"] };
    }
    return null;
};

const addServerVars: Operator = (doc) => {
    doc.servers = [
        ...(doc.servers ?? []),
        {
            url: "https://{env}.example.com",
            variables: { env: { default: "api", enum: ["api", "staging"] } },
        },
    ];
    return {
        id: "add-server-vars",
        validExpected: true,
        details: "{env}",
        features: ["servers.templated", "servers.document"],
    };
};

const oneOfWrap: Operator = (doc, ctx) => {
    const schemas = doc.components?.schemas;
    if (!schemas) return null;
    const names = Object.keys(schemas).filter((n) => schemas[n]!.kind !== "composition");
    if (!names.length) return null;
    const name = ctx.rng.pick(names);
    const original = schemas[name]!;
    schemas[name] = {
        kind: "composition",
        combiner: "oneOf",
        schemas: [
            { kind: "inline", value: original },
            { kind: "inline", value: strSchema() },
        ],
    };
    return { id: "oneof-wrap", validExpected: true, details: name, features: ["schema.oneOf"] };
};

const cyclicSchemas: Operator = (doc, ctx) => {
    doc.components ??= {};
    doc.components.schemas ??= {};
    const a = uniqueName(doc.components.schemas, nextId(ctx, "CycleA"));
    const b = uniqueName(doc.components.schemas, `${a}B`);
    doc.components.schemas[a] = {
        kind: "object",
        properties: { next: { kind: "ref", target: { table: "schemas", name: b } } },
    };
    doc.components.schemas[b] = {
        kind: "object",
        properties: { next: { kind: "ref", target: { table: "schemas", name: a } } },
    };
    return {
        id: "cyclic-schema",
        validExpected: true,
        details: `${a}<->${b}`,
        features: ["ref.cyclic-schema", "schema.recursive-ref"],
    };
};

const siblingRef: Operator = (doc, ctx) => {
    if (ctx.dialect !== "3.1") return null;
    const schemas = doc.components?.schemas;
    if (!schemas) return null;
    const names = Object.keys(schemas);
    if (!names.length) return null;
    const src = ctx.rng.pick(names);
    const alias = uniqueName(schemas, `${src}Alias`);
    schemas[alias] = {
        kind: "ref",
        target: { table: "schemas", name: src },
        description: "Sibling description beside $ref",
    };
    return {
        id: "sibling-ref",
        validExpected: true,
        details: alias,
        features: ["schema.ref.sibling", "ref.sibling.description"],
    };
};

const addCallback: Operator = (doc, ctx) => {
    const ops = allOperations(doc).filter((s) => !s.op.callbacks);
    if (!ops.length) return null;
    const site = ctx.rng.pick(ops);
    const cbItem: PathItemIR = {
        post: {
            operationId: nextId(ctx, "mutCb"),
            responses: { "200": { kind: "inline", value: { description: "ok" } } },
        },
    };
    site.op.callbacks = {
        onMut: { kind: "inline", value: { "{$request.body#/url}": cbItem } },
    };
    return {
        id: "add-callback",
        validExpected: true,
        details: site.path,
        features: ["op.callbacks", "callback.expression"],
    };
};

const addExternalDocs: Operator = (doc, ctx) => {
    const ops = allOperations(doc);
    if (!ops.length) return null;
    const site = ctx.rng.pick(ops);
    site.op.externalDocs = { url: "https://example.com/docs", description: "More" };
    return { id: "add-external-docs", validExpected: true, details: site.path, features: ["op.externalDocs"] };
};

const dropPathParam: Operator = (doc, ctx) => {
    const ops = allOperations(doc).filter((s) => s.path.includes("{"));
    for (const site of ctx.rng.shuffle(ops)) {
        const params = site.op.parameters ?? [];
        const idx = params.findIndex((p) => p.kind === "inline" && p.value.in === "path");
        if (idx < 0) continue;
        params.splice(idx, 1);
        site.op.parameters = params;
        return { id: "drop-path-param", validExpected: false, details: site.path, features: [] };
    }
    return null;
};

const danglingRef: Operator = (doc) => {
    doc.components ??= {};
    doc.components.schemas ??= {};
    doc.components.schemas.Broken = { kind: "ref", target: { table: "schemas", name: "DoesNotExist" } };
    return { id: "dangling-ref", validExpected: false, details: "DoesNotExist", features: [] };
};

const dialectKeyword: Operator = (doc, ctx) => {
    if (ctx.dialect === "3.0") {
        doc.webhooks = {
            illegal: {
                post: { responses: { "200": { kind: "inline", value: { description: "no" } } } },
            },
        };
        return { id: "dialect-keyword", validExpected: false, details: "webhooks on 3.0", features: [] };
    }
    const schemas = doc.components?.schemas;
    const name = schemas ? Object.keys(schemas)[0] : undefined;
    if (name && schemas![name]!.kind === "primitive") {
        (schemas![name] as { nullable?: boolean }).nullable = true;
        return { id: "dialect-keyword", validExpected: false, details: "nullable on 3.1", features: [] };
    }
    return null;
};

const duplicateParam: Operator = (doc, ctx) => {
    const ops = allOperations(doc);
    for (const site of ctx.rng.shuffle(ops)) {
        const first = (site.op.parameters ?? []).find((p) => p.kind === "inline" && p.value.in === "query");
        if (!first || first.kind !== "inline") continue;
        site.op.parameters = [...(site.op.parameters ?? []), structuredClone(first)];
        return { id: "duplicate-param", validExpected: false, details: first.value.name, features: [] };
    }
    return null;
};

const unknownSecurity: Operator = (doc) => {
    const ops = allOperations(doc);
    if (!ops.length) return null;
    ops[0]!.op.security = [{ definitelyMissingScheme: [] }];
    return { id: "unknown-security", validExpected: false, details: "definitelyMissingScheme", features: [] };
};

const dropResponseDescription: Operator = (doc, ctx) => {
    const ops = allOperations(doc);
    for (const site of ctx.rng.shuffle(ops)) {
        for (const resp of Object.values(site.op.responses)) {
            if (resp.kind === "inline" && resp.value.description) {
                resp.value.description = "";
                return { id: "drop-description", validExpected: false, details: site.path, features: [] };
            }
        }
    }
    return null;
};

const badPathKey: Operator = (doc) => {
    doc.paths ??= {};
    doc.paths["noleading-slash"] = {
        get: { responses: { "200": { kind: "inline", value: { description: "x" } } } },
    };
    return { id: "bad-path-key", validExpected: false, details: "noleading-slash", features: [] };
};

const illegalPathStyle: Operator = (doc, ctx) => {
    const ops = allOperations(doc);
    for (const site of ctx.rng.shuffle(ops)) {
        for (const p of [...(site.item.parameters ?? []), ...(site.op.parameters ?? [])]) {
            if (p.kind === "inline" && p.value.in === "path") {
                p.value.style = "form";
                return { id: "illegal-path-style", validExpected: false, details: p.value.name, features: [] };
            }
        }
    }
    return null;
};

export const SAFE_OPS: Operator[] = [
    renameSchema,
    addUnusedSchema,
    addQueryParam,
    add4xx,
    addDefaultResponse,
    addExtension,
    toggleDeprecated,
    addDescription,
    duplicatePath,
    swapMedia,
    addParamExample,
    extractInlineSchema,
    inlineSchemaRef,
    extractParam,
    addServerVars,
    oneOfWrap,
    cyclicSchemas,
    siblingRef,
    addCallback,
    addExternalDocs,
];

export const INVALID_OPS: Operator[] = [
    dropPathParam,
    danglingRef,
    dialectKeyword,
    duplicateParam,
    unknownSecurity,
    dropResponseDescription,
    badPathKey,
    illegalPathStyle,
];

export function applyMutations(
    doc: OpenAPIDocument,
    ctx: MutCtx,
    n: number,
    allowInvalid: boolean,
): MutationRecord[] {
    const pool = allowInvalid ? [...SAFE_OPS, ...INVALID_OPS] : SAFE_OPS;
    const applied: MutationRecord[] = [];
    for (let i = 0; i < n; i++) {
        const order = ctx.rng.shuffle(pool);
        let hit: MutationRecord | null = null;
        for (const op of order) {
            hit = op(doc, ctx);
            if (hit) break;
        }
        if (!hit) break;
        applied.push(hit);
        if (allowInvalid && !hit.validExpected) break;
    }
    return applied;
}
