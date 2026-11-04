import { componentRef } from "../dialects/index.ts";
import { pickDescription, pickPathParam, pickProperty, pickQuery, pickResource, pickVerb } from "../lexicon/index.ts";
import type { ComponentsIR, OpenAPIDocument, PrimitiveType, Ref, SchemaIR } from "../ast/index.ts";
import { bumpNodes, mark, remainingOps, remainingPaths, remainingSchemas, type GenContext } from "./context.ts";
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
import { camel, pickPingPath, resourcePath, uniqueOperationId } from "./names.ts";
import type { PathItemIR } from "../ast/index.ts";
import { queryParam, pathParam } from "./parameter.ts";

const STRING_FORMATS = [
    "date-time",
    "date",
    "time",
    "email",
    "uuid",
    "uri",
    "hostname",
    "ipv4",
    "ipv6",
    "byte",
    "binary",
    "password",
] as const;

function hintedPrimitive(ctx: GenContext, type?: PrimitiveType, format?: string): SchemaIR {
    const extra: Partial<Extract<SchemaIR, { kind: "primitive" }>> = {};
    if (format) extra.format = format;
    if (ctx.dialect === "3.0" && type && type !== "null" && ctx.rng.bool(0.12)) extra.nullable = true;
    if (ctx.dialect === "3.1" && type && ctx.rng.bool(0.12)) {
        extra.types = [type, "null"];
    }
    return primitiveSchema(ctx, type ?? "string", extra);
}

export function leafSchema(ctx: GenContext, depth: number): SchemaIR {
    if (depth >= ctx.budget.maxDepth || !bumpNodes(ctx)) {
        return primitiveSchema(ctx);
    }
    if (ctx.finishedSchemas.length && ctx.rng.bool(0.18)) {
        mark(ctx, "schema.recursive-ref");
        mark(ctx, "ref.local.components");
        const name = ctx.rng.pick(ctx.finishedSchemas);
        if (ctx.dialect === "3.1" && ctx.rng.bool(0.3)) {
            mark(ctx, "schema.ref.sibling");
            mark(ctx, "ref.sibling.description");
            return { kind: "ref", target: { table: "schemas", name }, description: pickDescription(ctx) };
        }
        return { kind: "ref", target: { table: "schemas", name } };
    }
    if (ctx.rng.bool(0.22)) {
        mark(ctx, "schema.type.array");
        const arr: Extract<SchemaIR, { kind: "array" }> = {
            kind: "array",
            items: { kind: "inline", value: primitiveSchema(ctx) },
        };
        if (ctx.rng.bool(0.35)) {
            arr.minItems = 0;
            arr.maxItems = ctx.rng.int(1, 8);
            mark(ctx, "schema.array.bounds");
        }
        if (ctx.rng.bool(0.2)) {
            arr.uniqueItems = true;
            mark(ctx, "schema.array.uniqueItems");
        }
        return arr;
    }
    if (depth === 0 || ctx.rng.bool(0.4)) {
        return objectSchema(ctx, depth, false);
    }
    return hintedPrimitive(ctx);
}

export function objectSchema(ctx: GenContext, depth: number, idProp = true): SchemaIR {
    mark(ctx, "schema.type.object");
    mark(ctx, "schema.object.properties");
    const used = new Set<string>();
    const properties: Record<string, Ref<SchemaIR>> = {};
    const required: string[] = [];
    const n = ctx.rng.int(2, 5);
    if (idProp) {
        used.add("id");
        properties.id = { kind: "inline", value: hintedPrimitive(ctx, "string", "uuid") };
        required.push("id");
    }
    for (let i = 0; i < n; i++) {
        const hint = pickProperty(ctx, used);
        properties[hint.name] = { kind: "inline", value: leafSchema(ctx, depth + 1) };
        if (hint.type && properties[hint.name]!.kind === "inline") {
            const leaf = properties[hint.name] as { kind: "inline"; value: SchemaIR };
            if (leaf.value.kind === "primitive") {
                leaf.value = hintedPrimitive(ctx, hint.type, hint.format);
            }
        }
        if (ctx.rng.bool(0.55)) required.push(hint.name);
    }
    if (required.length) mark(ctx, "schema.object.required");
    const obj: Extract<SchemaIR, { kind: "object" }> = {
        kind: "object",
        properties,
        required: required.length ? required : undefined,
    };
    if (ctx.rng.bool(0.15)) {
        obj.additionalProperties = ctx.rng.bool(0.5)
            ? false
            : { kind: "inline", value: primitiveSchema(ctx, "string") };
        mark(ctx, "schema.object.additionalProperties");
    }
    return obj;
}

function formatBundle(ctx: GenContext): SchemaIR {
    mark(ctx, "schema.type.object");
    mark(ctx, "schema.object.properties");
    const properties: Record<string, Ref<SchemaIR>> = {};
    const used = new Set<string>();
    for (const format of STRING_FORMATS) {
        const hint = pickProperty(ctx, used);
        properties[hint.name] = {
            kind: "inline",
            value: primitiveSchema(ctx, "string", { format }),
        };
    }
    properties.count = { kind: "inline", value: primitiveSchema(ctx, "integer", { format: "int32" }) };
    properties.big = { kind: "inline", value: primitiveSchema(ctx, "integer", { format: "int64" }) };
    properties.ratio = { kind: "inline", value: primitiveSchema(ctx, "number", { format: "float" }) };
    properties.amount = { kind: "inline", value: primitiveSchema(ctx, "number", { format: "double" }) };
    properties.status = {
        kind: "inline",
        value: primitiveSchema(ctx, "string", { enum: ["active", "paused", "closed"] }),
    };
    properties.nickname = {
        kind: "inline",
        value: primitiveSchema(ctx, "string", { minLength: 1, maxLength: 64, pattern: "^[A-Za-z0-9_]+$" }),
    };
    const num: Partial<Extract<SchemaIR, { kind: "primitive" }>> = {
        minimum: 0,
        maximum: 100,
        multipleOf: 0.5,
    };
    if (ctx.dialect === "3.0") {
        num.exclusiveMinimum = true;
    } else {
        num.exclusiveMinimum = 0;
    }
    properties.score = { kind: "inline", value: primitiveSchema(ctx, "number", num) };
    properties.tags = {
        kind: "inline",
        value: {
            kind: "array",
            items: { kind: "inline", value: primitiveSchema(ctx, "string") },
            minItems: 0,
            maxItems: 12,
            uniqueItems: true,
        },
    };
    mark(ctx, "schema.type.array");
    mark(ctx, "schema.array.bounds");
    mark(ctx, "schema.array.uniqueItems");
    properties.createdBy = {
        kind: "inline",
        value: primitiveSchema(ctx, "string", { readOnly: true }),
    };
    properties.password = {
        kind: "inline",
        value: primitiveSchema(ctx, "string", { format: "password", writeOnly: true }),
    };
    properties.legacy = {
        kind: "inline",
        value: primitiveSchema(ctx, "string", { deprecated: true }),
    };
    if (ctx.dialect === "3.0") {
        properties.maybe = {
            kind: "inline",
            value: primitiveSchema(ctx, "string", { nullable: true, example: "ok" }),
        };
    } else {
        properties.maybe = {
            kind: "inline",
            value: primitiveSchema(ctx, "string", { types: ["string", "null"], examples: ["ok"] }),
        };
        properties.flag = {
            kind: "inline",
            value: primitiveSchema(ctx, "string", { const: "on" }),
        };
    }
    properties.region = {
        kind: "inline",
        value: primitiveSchema(ctx, "string", { default: "us-east-1" }),
    };
    mark(ctx, "schema.object.required");
    return {
        kind: "object",
        properties,
        required: ["count", "status"],
        additionalProperties: false,
        xml: { name: "Entity", wrapped: true },
    };
}

export function fillSchemaCatalog(ctx: GenContext, components: ComponentsIR): string {
    const used = new Set<string>(ctx.finishedSchemas);
    const main = pickResource(ctx, used);

    if (remainingSchemas(ctx) > 0) {
        const rich = formatBundle(ctx);
        if (rich.kind === "object") {
            mark(ctx, "schema.object.additionalProperties");
            mark(ctx, "schema.xml");
        }
        addSchema(ctx, components, main, rich);
    }

    if (remainingSchemas(ctx) > 0) {
        addSchema(ctx, components, "AllOfPartA", {
            kind: "object",
            properties: { shared: { kind: "inline", value: primitiveSchema(ctx, "string") } },
            required: ["shared"],
        });
        addSchema(ctx, components, "AllOfPartB", {
            kind: "object",
            properties: { extra: { kind: "inline", value: primitiveSchema(ctx, "integer") } },
        });
        addSchema(ctx, components, "AllOfModel", {
            kind: "composition",
            combiner: "allOf",
            schemas: [schemaRef("AllOfPartA"), schemaRef("AllOfPartB")],
        });
        mark(ctx, "schema.allOf");
        mark(ctx, "ref.local.components");
    }

    if (remainingSchemas(ctx) > 0) {
        addSchema(ctx, components, "AnyOfModel", {
            kind: "composition",
            combiner: "anyOf",
            schemas: [
                { kind: "inline", value: primitiveSchema(ctx, "string") },
                { kind: "inline", value: primitiveSchema(ctx, "integer") },
            ],
        });
        mark(ctx, "schema.anyOf");
    }

    if (remainingSchemas(ctx) > 0) {
        addSchema(ctx, components, "Cat", {
            kind: "object",
            properties: {
                petType: { kind: "inline", value: primitiveSchema(ctx, "string", { enum: ["cat"] }) },
                hunts: { kind: "inline", value: primitiveSchema(ctx, "boolean") },
            },
            required: ["petType"],
        });
        addSchema(ctx, components, "Dog", {
            kind: "object",
            properties: {
                petType: { kind: "inline", value: primitiveSchema(ctx, "string", { enum: ["dog"] }) },
                barks: { kind: "inline", value: primitiveSchema(ctx, "boolean") },
            },
            required: ["petType"],
        });
        addSchema(ctx, components, "Pet", {
            kind: "composition",
            combiner: "oneOf",
            schemas: [schemaRef("Cat"), schemaRef("Dog")],
            discriminator: {
                propertyName: "petType",
                mapping: {
                    cat: componentRef("schemas", "Cat"),
                    dog: componentRef("schemas", "Dog"),
                },
            },
        });
        mark(ctx, "schema.oneOf");
        mark(ctx, "schema.discriminator");
    }

    if (remainingSchemas(ctx) > 0) {
        addSchema(ctx, components, "NotInteger", {
            kind: "not",
            schema: { kind: "inline", value: primitiveSchema(ctx, "integer") },
        });
        mark(ctx, "schema.not");
    }

    if (remainingSchemas(ctx) > 0) {
        const node: SchemaIR = {
            kind: "object",
            properties: {
                id: { kind: "inline", value: primitiveSchema(ctx, "string") },
            },
            required: ["id"],
        };
        addSchema(ctx, components, "CycleNode", node);
        if (node.kind === "object") {
            node.properties.child = schemaRef("CycleNode");
        }
        mark(ctx, "ref.cyclic-schema");
        mark(ctx, "schema.recursive-ref");
        // Sibling keywords next to $ref are OAS 3.1 only (3.0 Reference Object is $ref alone).
        if (ctx.dialect === "3.1" && remainingSchemas(ctx) > 0) {
            addSchema(ctx, components, "NodeAlias", {
                kind: "ref",
                target: { table: "schemas", name: "CycleNode" },
                description: pickDescription(ctx),
            });
            mark(ctx, "schema.ref.sibling");
            mark(ctx, "ref.sibling.description");
        }
    }

    if (ctx.dialect === "3.1" && remainingSchemas(ctx) > 0) {
        addSchema(ctx, components, "Tuple", {
            kind: "array",
            prefixItems: [
                { kind: "inline", value: primitiveSchema(ctx, "string") },
                { kind: "inline", value: primitiveSchema(ctx, "integer") },
            ],
            items: { kind: "inline", value: primitiveSchema(ctx, "boolean") },
        });
        mark(ctx, "schema.array.prefixItems");
        mark(ctx, "schema.type.array");
        addSchema(ctx, components, "Conditional", {
            kind: "object",
            properties: {
                kind: { kind: "inline", value: primitiveSchema(ctx, "string") },
                billingAddress: { kind: "inline", value: primitiveSchema(ctx, "string") },
                creditCard: { kind: "inline", value: primitiveSchema(ctx, "string") },
            },
            if: {
                kind: "inline",
                value: {
                    kind: "object",
                    properties: { kind: { kind: "inline", value: primitiveSchema(ctx, "string", { const: "paid" }) } },
                },
            },
            then: {
                kind: "inline",
                value: { kind: "object", properties: {}, required: ["creditCard"] },
            },
            else: {
                kind: "inline",
                value: { kind: "object", properties: {}, required: ["kind"] },
            },
            dependentRequired: { creditCard: ["billingAddress"] },
            dependentSchemas: {
                creditCard: {
                    kind: "inline",
                    value: {
                        kind: "object",
                        properties: {
                            billingAddress: { kind: "inline", value: primitiveSchema(ctx, "string") },
                        },
                        required: ["billingAddress"],
                    },
                },
            },
            patternProperties: {
                "^x-": { kind: "inline", value: primitiveSchema(ctx, "string") },
            },
            propertyNames: { kind: "inline", value: primitiveSchema(ctx, "string", { minLength: 1 }) },
        });
        mark(ctx, "schema.if-then-else");
        mark(ctx, "schema.dependentRequired");
        mark(ctx, "schema.dependentSchemas");
        mark(ctx, "schema.object.patternProperties");
        mark(ctx, "schema.object.propertyNames");
    }

    return main;
}

export function genSchemaHeavy(ctx: GenContext, doc: OpenAPIDocument): void {
    const components: ComponentsIR = doc.components ?? {};
    doc.components = components;
    addBearer(ctx, components, doc);
    const resource = fillSchemaCatalog(ctx, components);
    const modelRef = schemaRef(resource);
    mark(ctx, "ref.local.components");
    const err = errorSchemaRef(ctx, components);
    const tags = maybeTags(ctx, resource);
    const idName = pickPathParam(ctx, new Set());
    const collection = resourcePath(resource, chanceDotted(ctx));
    const itemPath = `${collection}/{${idName}}`;

    const collectionItem: PathItemIR = {};
    const memberItem: PathItemIR = {
        parameters: [{ kind: "inline", value: pathParam(ctx, idName) }],
    };
    mark(ctx, "path-item.parameters");
    mark(ctx, "op.parameters.inherited");
    mark(ctx, "path.single-param");
    mark(ctx, "path.static");

    const qUsed = new Set<string>();
    const queries = [pickQuery(ctx, qUsed), pickQuery(ctx, qUsed)].map((q) => ({
        kind: "inline" as const,
        value: queryParam(ctx, q.name, q.type ?? "string", q.format),
    }));

    if (remainingOps(ctx) > 0) {
        attachOp(
            collectionItem,
            "get",
            {
                operationId: uniqueOperationId(ctx, camel(pickVerb(ctx), resource)),
                tags,
                parameters: queries,
                responses: {
                    "200": {
                        kind: "inline",
                        value: jsonResponse(
                            ctx,
                            { kind: "inline", value: { kind: "array", items: modelRef } },
                            "List",
                            "2xx",
                        ),
                    },
                    "400": { kind: "inline", value: jsonResponse(ctx, err, "Bad request", "4xx") },
                },
            },
            ctx,
        );
        mark(ctx, "schema.type.array");
    }
    if (remainingOps(ctx) > 0) {
        attachOp(
            collectionItem,
            "post",
            {
                operationId: uniqueOperationId(ctx, camel("create", resource)),
                tags,
                requestBody: { kind: "inline", value: jsonRequest(ctx, modelRef, true) },
                responses: {
                    "200": { kind: "inline", value: jsonResponse(ctx, modelRef, "Created", "2xx") },
                },
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
                responses: {
                    "200": { kind: "inline", value: jsonResponse(ctx, modelRef, "OK", "2xx") },
                    "404": { kind: "inline", value: jsonResponse(ctx, err, "Not found", "4xx") },
                },
            },
            ctx,
        );
        doc.paths[itemPath] = memberItem;
        ctx.pathCount++;
    }

    if (remainingPaths(ctx) > 0 && remainingOps(ctx) > 0) {
        const ping = pickPingPath(ctx, false);
        if (!doc.paths[ping]) {
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
            doc.paths[ping] = item;
            ctx.pathCount++;
            mark(ctx, "path.static");
        }
    }

    if (ctx.tagNames.length) doc.tags = ctx.tagNames.map((name) => ({ name }));
}

function chanceDotted(ctx: GenContext): boolean {
    if (ctx.forbid.has("path.segment.dot-dash")) return false;
    const yes = ctx.force.has("path.segment.dot-dash") || ctx.rng.bool(0.15);
    if (yes) mark(ctx, "path.segment.dot-dash");
    return yes;
}

