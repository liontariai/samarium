import { dialectTable } from "../dialects/index.ts";
import { SIZE_BUDGETS, defaultSizeForProfile } from "../size.ts";
import { Rng } from "../rng.ts";
import { PHASE1_PROFILES } from "../catalog/features.ts";
import type { GenerateOptions, Profile } from "../types.ts";
import type {
    ComponentsIR,
    InfoIR,
    OpenAPIDocument,
    OperationIR,
    ParameterIR,
    PathItemIR,
    PrimitiveType,
    Ref,
    RequestBodyIR,
    ResponseIR,
    SchemaIR,
    SecuritySchemeIR,
    ServerIR,
} from "../ast/index.ts";
import {
    bumpNodes,
    canMark,
    chance,
    mark,
    remainingOps,
    remainingPaths,
    remainingSchemas,
    type GenContext,
} from "./context.ts";
import {
    camel,
    pickPingPath,
    pickPropName,
    pickResource,
    resourcePath,
    uniqueOperationId,
} from "./names.ts";

const PHASE1 = new Set<string>(PHASE1_PROFILES);

export function createContext(opts: GenerateOptions): GenContext {
    const rng = new Rng(opts.seed);
    const profile: Profile = opts.profile ?? "core-rest";
    if (!PHASE1.has(profile)) {
        throw new Error(
            `Profile "${profile}" is not implemented in Phase 1. Use "minimal" or "core-rest".`,
        );
    }
    const dialect = opts.dialect ?? (rng.bool() ? "3.1" : "3.0");
    const size = opts.size ?? defaultSizeForProfile(profile);
    const table = dialectTable(dialect);
    return {
        rng,
        dialect,
        dialectTable: table,
        profile,
        size,
        budget: SIZE_BUDGETS[size],
        codegenSafeIds: opts.codegenSafeIds !== false,
        force: new Set(opts.features ?? []),
        forbid: new Set(opts.forbid ?? []),
        features: new Set(),
        finishedSchemas: [],
        schemaCount: 0,
        pathCount: 0,
        opCount: 0,
        nodeCount: 0,
        operationIds: new Set(),
        securitySchemeNames: [],
        tagNames: [],
    };
}

function primitiveSchema(ctx: GenContext, type?: PrimitiveType): SchemaIR {
    const t = type ?? ctx.rng.pick(["string", "number", "integer", "boolean"] as const);
    mark(ctx, `schema.type.${t}`);
    return { kind: "primitive", type: t };
}

function objectSchema(ctx: GenContext, depth: number, idProp = true): SchemaIR {
    mark(ctx, "schema.type.object");
    mark(ctx, "schema.object.properties");
    const used = new Set<string>();
    const properties: Record<string, Ref<SchemaIR>> = {};
    const required: string[] = [];
    const n = ctx.rng.int(1, 3);
    if (idProp) {
        used.add("id");
        properties.id = { kind: "inline", value: primitiveSchema(ctx, "string") };
        required.push("id");
    }
    for (let i = 0; i < n; i++) {
        const name = pickPropName(ctx, used);
        used.add(name);
        properties[name] = { kind: "inline", value: leafSchema(ctx, depth + 1) };
        if (ctx.rng.bool(0.6)) required.push(name);
    }
    if (required.length) mark(ctx, "schema.object.required");
    return { kind: "object", properties, required: required.length ? required : undefined };
}

function leafSchema(ctx: GenContext, depth: number): SchemaIR {
    if (depth >= ctx.budget.maxDepth || !bumpNodes(ctx)) {
        return primitiveSchema(ctx);
    }
    if (ctx.finishedSchemas.length && ctx.rng.bool(0.2)) {
        mark(ctx, "schema.recursive-ref");
        mark(ctx, "ref.local.components");
        return { kind: "ref", target: { table: "schemas", name: ctx.rng.pick(ctx.finishedSchemas) } };
    }
    if (ctx.rng.bool(0.25)) {
        mark(ctx, "schema.type.array");
        return { kind: "array", items: { kind: "inline", value: primitiveSchema(ctx) } };
    }
    if (depth === 0 || ctx.rng.bool(0.45)) {
        return objectSchema(ctx, depth, false);
    }
    return primitiveSchema(ctx);
}

function addSchema(ctx: GenContext, components: ComponentsIR, name: string, schema: SchemaIR): void {
    components.schemas ??= {};
    components.schemas[name] = schema;
    ctx.schemaCount++;
    ctx.finishedSchemas.push(name);
    mark(ctx, "components.schemas");
}

function genInfo(ctx: GenContext): InfoIR {
    mark(ctx, "info.title");
    mark(ctx, "info.version");
    const info: InfoIR = {
        title: `${ctx.profile} API ${ctx.rng.int(1, 99)}`,
        version: `${ctx.rng.int(0, 3)}.${ctx.rng.int(0, 9)}.${ctx.rng.int(0, 9)}`,
    };
    if (chance(ctx, "info.description", 0.7)) {
        info.description = `Generated ${ctx.dialect} fixture (seed-driven).`;
        mark(ctx, "info.description");
    } else {
        mark(ctx, "doc.optional.omitted");
    }
    if (chance(ctx, "info.contact", 0.25)) {
        info.contact = { name: "API Team", email: "api@example.com", url: "https://example.com" };
        mark(ctx, "info.contact");
    }
    if (chance(ctx, "info.license", 0.2)) {
        info.license = { name: "MIT", url: "https://opensource.org/licenses/MIT" };
        mark(ctx, "info.license");
    }
    return info;
}

function genServers(ctx: GenContext): ServerIR[] | undefined {
    if (!chance(ctx, "servers.literal", ctx.profile === "minimal" ? 0.15 : 0.55)) return undefined;
    mark(ctx, "servers.literal");
    mark(ctx, "servers.document");
    return [{ url: ctx.rng.pick(["https://api.example.com", "https://example.com/v1", "http://localhost:8080"]) }];
}

function textPlainResponse(ctx: GenContext, description: string): ResponseIR {
    mark(ctx, "media.text/plain");
    mark(ctx, "response.description");
    mark(ctx, "op.responses.2xx");
    return {
        description,
        content: {
            "text/plain": {
                schema: { kind: "inline", value: primitiveSchema(ctx, "string") },
            },
        },
    };
}

function jsonResponse(ctx: GenContext, schema: Ref<SchemaIR>, description: string, code: "2xx" | "4xx"): ResponseIR {
    mark(ctx, "media.application/json");
    mark(ctx, "response.description");
    mark(ctx, code === "2xx" ? "op.responses.2xx" : "op.responses.4xx");
    return {
        description,
        content: {
            "application/json": { schema },
        },
    };
}

function jsonRequest(ctx: GenContext, schema: Ref<SchemaIR>, required: boolean): RequestBodyIR {
    mark(ctx, "media.application/json");
    mark(ctx, "op.requestBody");
    if (required) mark(ctx, "op.requestBody.required");
    return {
        required,
        content: {
            "application/json": { schema },
        },
    };
}

function pathParam(ctx: GenContext, name: string): ParameterIR {
    mark(ctx, "param.in.path");
    mark(ctx, "param.schema");
    mark(ctx, "param.style.simple");
    mark(ctx, "op.parameters.inline");
    return {
        name,
        in: "path",
        required: true,
        style: "simple",
        explode: false,
        schema: { kind: "inline", value: primitiveSchema(ctx, "string") },
    };
}

function queryParam(ctx: GenContext, name: string, type: PrimitiveType = "string"): ParameterIR {
    mark(ctx, "param.in.query");
    mark(ctx, "param.schema");
    mark(ctx, "param.style.form");
    mark(ctx, "param.explode");
    mark(ctx, "op.parameters.inline");
    return {
        name,
        in: "query",
        required: false,
        style: "form",
        explode: true,
        schema: { kind: "inline", value: primitiveSchema(ctx, type) },
    };
}

function errorSchemaRef(ctx: GenContext, components: ComponentsIR): Ref<SchemaIR> {
    if (!components.schemas?.Error && remainingSchemas(ctx) > 0) {
        addSchema(ctx, components, "Error", {
            kind: "object",
            properties: {
                message: { kind: "inline", value: primitiveSchema(ctx, "string") },
                code: { kind: "inline", value: primitiveSchema(ctx, "integer") },
            },
            required: ["message"],
        });
        mark(ctx, "schema.object.required");
    }
    if (components.schemas?.Error) {
        mark(ctx, "ref.local.components");
        return { kind: "ref", target: { table: "schemas", name: "Error" } };
    }
    return { kind: "inline", value: primitiveSchema(ctx, "string") };
}

function maybeTags(ctx: GenContext, resource: string): string[] | undefined {
    if (!chance(ctx, "op.tags", 0.5)) return undefined;
    mark(ctx, "op.tags");
    const tag = resource;
    if (!ctx.tagNames.includes(tag)) ctx.tagNames.push(tag);
    return [tag];
}

function attachOp(item: PathItemIR, method: keyof PathItemIR, op: OperationIR, ctx: GenContext): void {
    (item as Record<string, unknown>)[method] = op;
    ctx.opCount++;
    mark(ctx, `op.method.${method}`);
    if (op.operationId) mark(ctx, "op.operationId");
}

function genMinimal(ctx: GenContext, doc: OpenAPIDocument): void {
    const dotted = chance(ctx, "path.segment.dot-dash", 0.2);
    if (dotted) mark(ctx, "path.segment.dot-dash");
    const path = pickPingPath(ctx, dotted);
    if (path.includes("{")) {
        mark(ctx, "path.single-param");
    } else {
        mark(ctx, "path.static");
    }
    const item: PathItemIR = {};
    const op: OperationIR = {
        operationId: uniqueOperationId(ctx, "ping"),
        tags: maybeTags(ctx, "Meta"),
        responses: {
            "200": { kind: "inline", value: textPlainResponse(ctx, "OK") },
        },
    };
    attachOp(item, "get", op, ctx);
    doc.paths ??= {};
    doc.paths[path] = item;
    ctx.pathCount++;
}

function addBearer(ctx: GenContext, components: ComponentsIR, doc: OpenAPIDocument): void {
    if (!canMark(ctx, "security.http.bearer")) return;
    components.securitySchemes ??= {};
    const name = "bearerAuth";
    const scheme: SecuritySchemeIR = {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
    };
    components.securitySchemes[name] = scheme;
    ctx.securitySchemeNames.push(name);
    doc.security = [{ [name]: [] }];
    mark(ctx, "security.http.bearer");
    mark(ctx, "security.requirement.or");
}

function genCoreRest(ctx: GenContext, doc: OpenAPIDocument): void {
    const components: ComponentsIR = doc.components ?? {};
    doc.components = components;

    if (ctx.profile === "core-rest") {
        addBearer(ctx, components, doc);
    }

    const usedResources = new Set<string>();
    const resourceCount = Math.max(1, Math.min(remainingPaths(ctx) >= 2 ? ctx.rng.int(1, 2) : 1, remainingPaths(ctx)));

    for (let r = 0; r < resourceCount && remainingPaths(ctx) > 0 && remainingOps(ctx) > 0; r++) {
        const resource = pickResource(ctx, usedResources);
        usedResources.add(resource);
        const dotted = chance(ctx, "path.segment.dot-dash", 0.15);
        if (dotted) mark(ctx, "path.segment.dot-dash");
        const collection = dotted ? `/${resource.toLowerCase()}-list` : resourcePath(resource);
        const idName = "id";
        const itemPath = `${collection}/{${idName}}`;

        if (remainingSchemas(ctx) > 0) {
            addSchema(ctx, components, resource, objectSchema(ctx, 0, true));
        } else if (!components.schemas?.[resource]) {
            addSchema(ctx, components, resource, primitiveSchema(ctx, "string"));
        }
        const modelRef: Ref<SchemaIR> = {
            kind: "ref",
            target: { table: "schemas", name: resource },
        };
        mark(ctx, "ref.local.components");
        const listSchema: SchemaIR = {
            kind: "array",
            items: modelRef,
        };
        mark(ctx, "schema.type.array");
        const err = errorSchemaRef(ctx, components);

        const tags = maybeTags(ctx, resource);
        const collectionItem: PathItemIR = {};
        const memberItem: PathItemIR = {
            parameters: [{ kind: "inline", value: pathParam(ctx, idName) }],
        };
        mark(ctx, "path-item.parameters");
        mark(ctx, "op.parameters.inherited");
        mark(ctx, "path.single-param");

        const with4xx = (ok: ResponseIR, extra?: Record<string, Ref<ResponseIR>>): Record<string, Ref<ResponseIR>> => {
            const responses: Record<string, Ref<ResponseIR>> = {
                "200": { kind: "inline", value: ok },
                ...extra,
            };
            if (chance(ctx, "op.responses.4xx", 0.85)) {
                responses["400"] = { kind: "inline", value: jsonResponse(ctx, err, "Bad request", "4xx") };
            }
            return responses;
        };

        const crud = remainingOps(ctx) >= 4 && remainingPaths(ctx) >= 2 && ctx.size !== "xs";

        if (crud) {
            mark(ctx, "path.static");
            if (remainingOps(ctx) > 0) {
                attachOp(
                    collectionItem,
                    "get",
                    {
                        operationId: uniqueOperationId(ctx, camel("list", resource)),
                        tags,
                        parameters: [
                            { kind: "inline", value: queryParam(ctx, "limit", "integer") },
                            { kind: "inline", value: queryParam(ctx, "q", "string") },
                        ],
                        responses: with4xx(jsonResponse(ctx, { kind: "inline", value: listSchema }, "List", "2xx")),
                    },
                    ctx,
                );
            }
            if (remainingOps(ctx) > 0) {
                attachOp(
                    collectionItem,
                    "post",
                    {
                        operationId: uniqueOperationId(ctx, camel("create", resource)),
                        tags,
                        requestBody: { kind: "inline", value: jsonRequest(ctx, modelRef, true) },
                        responses: with4xx(jsonResponse(ctx, modelRef, "Created", "2xx")),
                    },
                    ctx,
                );
            }
            doc.paths ??= {};
            doc.paths[collection] = collectionItem;
            ctx.pathCount++;

            if (remainingOps(ctx) > 0 && remainingPaths(ctx) > 0) {
                attachOp(
                    memberItem,
                    "get",
                    {
                        operationId: uniqueOperationId(ctx, camel("get", resource)),
                        tags,
                        responses: with4xx(
                            jsonResponse(ctx, modelRef, "OK", "2xx"),
                            { "404": { kind: "inline", value: jsonResponse(ctx, err, "Not found", "4xx") } },
                        ),
                    },
                    ctx,
                );
            }
            if (remainingOps(ctx) > 0) {
                const method = chance(ctx, "op.method.patch", 0.4) ? "patch" : "put";
                attachOp(
                    memberItem,
                    method,
                    {
                        operationId: uniqueOperationId(ctx, camel(method === "patch" ? "patch" : "update", resource)),
                        tags,
                        requestBody: { kind: "inline", value: jsonRequest(ctx, modelRef, true) },
                        responses: with4xx(jsonResponse(ctx, modelRef, "Updated", "2xx")),
                    },
                    ctx,
                );
            }
            if (remainingOps(ctx) > 0 && chance(ctx, "response.204", 0.5)) {
                mark(ctx, "response.204");
                mark(ctx, "response.description");
                attachOp(
                    memberItem,
                    "delete",
                    {
                        operationId: uniqueOperationId(ctx, camel("delete", resource)),
                        tags,
                        responses: {
                            "204": { kind: "inline", value: { description: "Deleted" } },
                            "404": { kind: "inline", value: jsonResponse(ctx, err, "Not found", "4xx") },
                        },
                    },
                    ctx,
                );
            } else if (remainingOps(ctx) > 0) {
                attachOp(
                    memberItem,
                    "delete",
                    {
                        operationId: uniqueOperationId(ctx, camel("delete", resource)),
                        tags,
                        responses: with4xx(jsonResponse(ctx, modelRef, "Deleted", "2xx")),
                    },
                    ctx,
                );
            }
            doc.paths[itemPath] = memberItem;
            ctx.pathCount++;
        } else {
            // xs / tight budget: single GET with path param
            const item: PathItemIR = {};
            attachOp(
                item,
                "get",
                {
                    operationId: uniqueOperationId(ctx, camel("get", resource)),
                    tags,
                    parameters: [
                        { kind: "inline", value: pathParam(ctx, idName) },
                        ...(chance(ctx, "param.in.query", 0.7)
                            ? [{ kind: "inline" as const, value: queryParam(ctx, "locale", "string") }]
                            : []),
                    ],
                    responses: with4xx(jsonResponse(ctx, modelRef, "OK", "2xx")),
                },
                ctx,
            );
            doc.paths ??= {};
            doc.paths[itemPath] = item;
            ctx.pathCount++;
            mark(ctx, "path.single-param");
        }

        // Optional nested multi-param path when budget remains
        if (remainingPaths(ctx) > 0 && remainingOps(ctx) > 0 && chance(ctx, "path.multi-param", 0.35)) {
            mark(ctx, "path.multi-param");
            const nested = `${itemPath}/tags/{tagId}`;
            const nestedItem: PathItemIR = {};
            attachOp(
                nestedItem,
                "get",
                {
                    operationId: uniqueOperationId(ctx, camel("get", `${resource}Tag`)),
                    tags,
                    parameters: [
                        { kind: "inline", value: pathParam(ctx, idName) },
                        { kind: "inline", value: pathParam(ctx, "tagId") },
                    ],
                    responses: with4xx(jsonResponse(ctx, { kind: "inline", value: primitiveSchema(ctx, "string") }, "OK", "2xx")),
                },
                ctx,
            );
            doc.paths![nested] = nestedItem;
            ctx.pathCount++;
        }
    }

    if (remainingPaths(ctx) > 0 && remainingOps(ctx) > 0) {
        const ping = "/_health";
        if (!doc.paths?.[ping]) {
            const item: PathItemIR = {};
            attachOp(
                item,
                "get",
                {
                    operationId: uniqueOperationId(ctx, "health"),
                    responses: { "200": { kind: "inline", value: textPlainResponse(ctx, "OK") } },
                },
                ctx,
            );
            doc.paths ??= {};
            doc.paths[ping] = item;
            ctx.pathCount++;
            mark(ctx, "path.static");
        }
    }

    if (chance(ctx, "components.unused", 0.2) && remainingSchemas(ctx) > 0) {
        const extra = ctx.codegenSafeIds ? "UnusedModel" : "Unused.Model-1";
        addSchema(ctx, components, extra, primitiveSchema(ctx, "string"));
        mark(ctx, "components.unused");
        if (!ctx.codegenSafeIds && (extra.includes(".") || extra.includes("-"))) {
            mark(ctx, "components.name.dot-dash");
        }
    }

    if (ctx.tagNames.length) {
        doc.tags = ctx.tagNames.map((name) => ({ name }));
    }

    if (doc.security && chance(ctx, "op.security.override", 0.15) && doc.paths) {
        const firstPath = Object.values(doc.paths)[0];
        const op = firstPath && (firstPath.get ?? firstPath.post ?? firstPath.put);
        if (op) {
            op.security = [{ bearerAuth: [] }];
            mark(ctx, "op.security.override");
        }
    }
}

export function generateDocument(ctx: GenContext): OpenAPIDocument {
    mark(ctx, ctx.dialect === "3.0" ? "doc.openapi.3.0" : "doc.openapi.3.1");
    const doc: OpenAPIDocument = {
        openapi: ctx.dialectTable.defaultVersion,
        info: genInfo(ctx),
        paths: {},
        components: { schemas: {} },
    };
    const servers = genServers(ctx);
    if (servers) doc.servers = servers;

    if (ctx.profile === "minimal") {
        genMinimal(ctx, doc);
    } else {
        genCoreRest(ctx, doc);
    }

    if (!doc.paths || Object.keys(doc.paths).length === 0) {
        genMinimal(ctx, doc);
    }

    if (doc.components && Object.keys(doc.components.schemas ?? {}).length === 0 && !doc.components.securitySchemes) {
        delete doc.components;
    }

    return doc;
}
