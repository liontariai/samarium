import { dialectTable } from "../dialects/index.ts";
import { SIZE_BUDGETS, defaultSizeForProfile } from "../size.ts";
import { Rng } from "../rng.ts";
import { PHASE5_PROFILES } from "../catalog/features.ts";
import type { GenerateOptions, Profile } from "../types.ts";
import type { ComponentsIR, OpenAPIDocument, PathItemIR, Ref, ResponseIR, SchemaIR } from "../ast/index.ts";
import { chance, mark, remainingOps, remainingPaths, remainingSchemas, type GenContext } from "./context.ts";
import {
    pickNestedSegment,
    pickPathParam,
    pickQuery,
    pickResource,
    pickVerb,
} from "../lexicon/index.ts";
import { camel, pickPingPath, resourcePath, uniqueOperationId } from "./names.ts";
import {
    addBearer,
    addSchema,
    attachOp,
    errorSchemaRef,
    jsonRequest,
    jsonResponse,
    maybeTags,
    primitiveSchema,
    schemaRef,
    textPlainResponse,
} from "./helpers.ts";
import { leafSchema, objectSchema, genSchemaHeavy } from "./schema.ts";
import { pathParam, queryParam, genParamMatrix } from "./parameter.ts";
import { genMediaMatrix } from "./media.ts";
import { genSecurityMatrix } from "./security.ts";
import { genCallbackWebhook } from "./callback.ts";
import { genRefGraph } from "./ref-graph.ts";

const IMPLEMENTED = new Set<string>(PHASE5_PROFILES);

export function createContext(opts: GenerateOptions): GenContext {
    const rng = new Rng(opts.seed);
    const profile: Profile = opts.profile ?? "core-rest";
    if (!IMPLEMENTED.has(profile)) {
        throw new Error(
            `Profile "${profile}" is not implemented yet. Use: ${[...IMPLEMENTED].join(", ")}.`,
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

function genMinimal(ctx: GenContext, doc: OpenAPIDocument): void {
    const dotted = chance(ctx, "path.segment.dot-dash", 0.2);
    if (dotted) mark(ctx, "path.segment.dot-dash");
    const path = pickPingPath(ctx, dotted);
    if (path.includes("{")) mark(ctx, "path.single-param");
    else mark(ctx, "path.static");
    const item: PathItemIR = {};
    attachOp(
        item,
        "get",
        {
            operationId: uniqueOperationId(ctx, "ping"),
            tags: maybeTags(ctx, "Meta"),
            responses: { "200": { kind: "inline", value: textPlainResponse(ctx, "OK") } },
        },
        ctx,
    );
    doc.paths ??= {};
    doc.paths[path] = item;
    ctx.pathCount++;
}

function genCoreRest(ctx: GenContext, doc: OpenAPIDocument): void {
    const components: ComponentsIR = doc.components ?? {};
    doc.components = components;
    if (ctx.profile === "core-rest" || ctx.profile === "schema-heavy") {
        addBearer(ctx, components, doc);
    }

    const usedResources = new Set<string>();
    const resourceCount = Math.max(
        1,
        Math.min(remainingPaths(ctx) >= 2 ? ctx.rng.int(1, 2) : 1, remainingPaths(ctx)),
    );

    for (let r = 0; r < resourceCount && remainingPaths(ctx) > 0 && remainingOps(ctx) > 0; r++) {
        const resource = pickResource(ctx, usedResources);
        const dotted = chance(ctx, "path.segment.dot-dash", 0.15);
        if (dotted) mark(ctx, "path.segment.dot-dash");
        const collection = resourcePath(resource, dotted);
        const idName = pickPathParam(ctx, new Set());
        const itemPath = `${collection}/{${idName}}`;

        if (remainingSchemas(ctx) > 0) {
            addSchema(ctx, components, resource, objectSchema(ctx, 0, true));
        } else if (!components.schemas?.[resource]) {
            addSchema(ctx, components, resource, primitiveSchema(ctx, "string"));
        }
        const modelRef = schemaRef(resource);
        mark(ctx, "ref.local.components");
        const listSchema: SchemaIR = { kind: "array", items: modelRef };
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
        const qUsed = new Set<string>();
        const listParams = [pickQuery(ctx, qUsed), pickQuery(ctx, qUsed)].map((q) => ({
            kind: "inline" as const,
            value: queryParam(ctx, q.name, q.type ?? "string", q.format),
        }));

        if (crud) {
            mark(ctx, "path.static");
            if (remainingOps(ctx) > 0) {
                attachOp(
                    collectionItem,
                    "get",
                    {
                        operationId: uniqueOperationId(ctx, camel(pickVerb(ctx), resource)),
                        tags,
                        parameters: listParams,
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
                        responses: with4xx(jsonResponse(ctx, modelRef, "OK", "2xx"), {
                            "404": { kind: "inline", value: jsonResponse(ctx, err, "Not found", "4xx") },
                        }),
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
            const item: PathItemIR = {};
            const extraQ = chance(ctx, "param.in.query", 0.7)
                ? [{ kind: "inline" as const, value: queryParam(ctx, pickQuery(ctx, new Set()).name, "string") }]
                : [];
            attachOp(
                item,
                "get",
                {
                    operationId: uniqueOperationId(ctx, camel("get", resource)),
                    tags,
                    parameters: [{ kind: "inline", value: pathParam(ctx, idName) }, ...extraQ],
                    responses: with4xx(jsonResponse(ctx, modelRef, "OK", "2xx")),
                },
                ctx,
            );
            doc.paths ??= {};
            doc.paths[itemPath] = item;
            ctx.pathCount++;
            mark(ctx, "path.single-param");
        }

        if (remainingPaths(ctx) > 0 && remainingOps(ctx) > 0 && chance(ctx, "path.multi-param", 0.35)) {
            mark(ctx, "path.multi-param");
            const nestedSeg = pickNestedSegment(ctx, new Set());
            const nestedId = pickPathParam(ctx, new Set([idName]));
            const nested = `${itemPath}/${nestedSeg}/{${nestedId}}`;
            const nestedItem: PathItemIR = {};
            attachOp(
                nestedItem,
                "get",
                {
                    operationId: uniqueOperationId(ctx, camel("get", `${resource}Child`)),
                    tags,
                    parameters: [
                        { kind: "inline", value: pathParam(ctx, idName) },
                        { kind: "inline", value: pathParam(ctx, nestedId) },
                    ],
                    responses: with4xx(
                        jsonResponse(ctx, { kind: "inline", value: primitiveSchema(ctx, "string") }, "OK", "2xx"),
                    ),
                },
                ctx,
            );
            doc.paths![nested] = nestedItem;
            ctx.pathCount++;
        }
    }

    if (remainingPaths(ctx) > 0 && remainingOps(ctx) > 0) {
        const ping = pickPingPath(ctx, false);
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
        addSchema(ctx, components, "UnusedModel", leafSchema(ctx, 1));
        mark(ctx, "components.unused");
    }

    if (ctx.tagNames.length) doc.tags = ctx.tagNames.map((name) => ({ name }));

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
        info: {
            title: `${ctx.profile} API ${ctx.rng.int(1, 99)}`,
            version: `${ctx.rng.int(0, 3)}.${ctx.rng.int(0, 9)}.${ctx.rng.int(0, 9)}`,
        },
        paths: {},
        components: { schemas: {} },
    };
    mark(ctx, "info.title");
    mark(ctx, "info.version");
    if (chance(ctx, "info.description", 0.7)) {
        doc.info.description = `Generated ${ctx.dialect} fixture (seed-driven).`;
        mark(ctx, "info.description");
    } else mark(ctx, "doc.optional.omitted");
    if (chance(ctx, "info.contact", 0.25)) {
        doc.info.contact = { name: "API Team", email: "api@example.com", url: "https://example.com" };
        mark(ctx, "info.contact");
    }
    if (chance(ctx, "info.license", 0.2)) {
        doc.info.license = { name: "MIT", url: "https://opensource.org/licenses/MIT" };
        mark(ctx, "info.license");
    }
    if (chance(ctx, "servers.literal", ctx.profile === "minimal" ? 0.15 : 0.55)) {
        mark(ctx, "servers.literal");
        mark(ctx, "servers.document");
        doc.servers = [
            { url: ctx.rng.pick(["https://api.example.com", "https://example.com/v1", "http://localhost:8080"]) },
        ];
    }

    if (ctx.profile === "minimal") genMinimal(ctx, doc);
    else if (ctx.profile === "schema-heavy") genSchemaHeavy(ctx, doc);
    else if (ctx.profile === "param-matrix") genParamMatrix(ctx, doc);
    else if (ctx.profile === "media-matrix") genMediaMatrix(ctx, doc);
    else if (ctx.profile === "security-matrix") genSecurityMatrix(ctx, doc);
    else if (ctx.profile === "callback-webhook") genCallbackWebhook(ctx, doc);
    else if (ctx.profile === "ref-graph" || ctx.profile === "multi-file") genRefGraph(ctx, doc);
    else genCoreRest(ctx, doc);

    if ((!doc.paths || Object.keys(doc.paths).length === 0) && !doc.webhooks) genMinimal(ctx, doc);

    if (doc.components) {
        const nonempty = Object.values(doc.components).some(
            (v) => v && typeof v === "object" && Object.keys(v as object).length > 0,
        );
        if (!nonempty) delete doc.components;
    }

    return doc;
}
