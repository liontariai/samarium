import { jsonPointerEscape } from "../dialects/index.ts";
import type { ComponentsIR, OpenAPIDocument, ParameterIR, PathItemIR, SchemaIR } from "../ast/index.ts";
import { mark, remainingOps, remainingPaths, type GenContext } from "./context.ts";
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
import { uniqueOperationId } from "./names.ts";
import { pathParam } from "./parameter.ts";
import { objectSchema } from "./schema.ts";

/** Descriptions that stay legal identifiers-adjacent but exercise unicode in free text. */
const UNICODE_BLURB = "Generated fixture — café, 文档, naïve.";

/**
 * Reuse, cycles, path-item `$ref` with escaped JSON Pointers, unused components,
 * extracted parameters / requestBodies, unicode descriptions.
 */
export function genRefGraph(ctx: GenContext, doc: OpenAPIDocument): void {
    const components: ComponentsIR = doc.components ?? {};
    doc.components = components;
    addBearer(ctx, components, doc);

    doc.info.description = UNICODE_BLURB;
    mark(ctx, "info.description");
    mark(ctx, "ser.unicode");

    addSchema(ctx, components, "Item", objectSchema(ctx, 0, true));
    const model = schemaRef("Item");
    mark(ctx, "ref.local.components");

    const cycle: SchemaIR = {
        kind: "object",
        properties: {
            id: { kind: "inline", value: primitiveSchema(ctx, "string") },
        },
        required: ["id"],
    };
    addSchema(ctx, components, "CycleNode", cycle);
    if (cycle.kind === "object") cycle.properties.child = schemaRef("CycleNode");
    mark(ctx, "ref.cyclic-schema");
    mark(ctx, "schema.recursive-ref");

    if (ctx.dialect === "3.1") {
        addSchema(ctx, components, "NodeAlias", {
            kind: "ref",
            target: { table: "schemas", name: "CycleNode" },
            description: UNICODE_BLURB,
        });
        mark(ctx, "schema.ref.sibling");
        mark(ctx, "ref.sibling.description");
    }

    addSchema(ctx, components, "Unused.Model", primitiveSchema(ctx, "string"));
    mark(ctx, "components.unused");
    mark(ctx, "components.schemas");

    const err = errorSchemaRef(ctx, components);

    const pageLimit: ParameterIR = {
        name: "limit",
        in: "query",
        required: false,
        style: "form",
        explode: true,
        schema: { kind: "inline", value: primitiveSchema(ctx, "integer") },
        description: UNICODE_BLURB,
    };
    components.parameters ??= {};
    components.parameters.PageLimit = pageLimit;
    mark(ctx, "param.in.query");
    mark(ctx, "param.style.form");
    mark(ctx, "param.schema");

    components.requestBodies ??= {};
    components.requestBodies.ItemBody = jsonRequest(ctx, model, true);
    mark(ctx, "op.requestBody.ref");

    components.responses ??= {};
    components.responses.UnusedNotFound = jsonResponse(ctx, err, "Unused 404", "4xx");
    mark(ctx, "components.unused");

    const tags = maybeTags(ctx, "Item");
    doc.paths ??= {};

    const collection: PathItemIR = {};
    if (remainingOps(ctx) > 0) {
        attachOp(
            collection,
            "get",
            {
                operationId: uniqueOperationId(ctx, "listItems"),
                tags,
                description: UNICODE_BLURB,
                parameters: [{ kind: "ref", target: { table: "parameters", name: "PageLimit" } }],
                responses: {
                    "200": {
                        kind: "inline",
                        value: jsonResponse(
                            ctx,
                            { kind: "inline", value: { kind: "array", items: model } },
                            "List",
                            "2xx",
                        ),
                    },
                },
            },
            ctx,
        );
        mark(ctx, "op.parameters.ref");
        mark(ctx, "schema.type.array");
    }
    if (remainingOps(ctx) > 0) {
        attachOp(
            collection,
            "post",
            {
                operationId: uniqueOperationId(ctx, "createItem"),
                tags,
                description: UNICODE_BLURB,
                requestBody: { kind: "ref", target: { table: "requestBodies", name: "ItemBody" } },
                responses: {
                    "200": { kind: "inline", value: jsonResponse(ctx, model, "Created", "2xx") },
                },
            },
            ctx,
        );
        mark(ctx, "op.requestBody.ref");
        mark(ctx, "op.requestBody");
    }
    doc.paths["/items"] = collection;
    ctx.pathCount++;
    mark(ctx, "path.static");

    if (remainingPaths(ctx) > 0 && remainingOps(ctx) > 0) {
        const idName = "itemId";
        const member: PathItemIR = {
            parameters: [{ kind: "inline", value: pathParam(ctx, idName) }],
        };
        attachOp(
            member,
            "get",
            {
                operationId: uniqueOperationId(ctx, "getItem"),
                tags,
                description: UNICODE_BLURB,
                responses: {
                    "200": { kind: "inline", value: jsonResponse(ctx, model, "OK", "2xx") },
                    "404": { kind: "inline", value: jsonResponse(ctx, err, "Not found", "4xx") },
                },
            },
            ctx,
        );
        doc.paths[`/items/{${idName}}`] = member;
        ctx.pathCount++;
        mark(ctx, "path.single-param");
        mark(ctx, "path-item.parameters");
        mark(ctx, "op.parameters.inherited");
    }

    // Path key contains both `/`-adjacent segments and `~` so a Path Item $ref must JSON-Pointer-escape.
    const escapedPath = "/foo~bar";
    if (remainingPaths(ctx) > 0 && remainingOps(ctx) > 0) {
        const target: PathItemIR = {};
        attachOp(
            target,
            "get",
            {
                operationId: uniqueOperationId(ctx, "getFooTilde"),
                responses: { "200": { kind: "inline", value: textPlainResponse(ctx, UNICODE_BLURB) } },
            },
            ctx,
        );
        doc.paths[escapedPath] = target;
        ctx.pathCount++;
        mark(ctx, "path.static");

        if (remainingPaths(ctx) > 0) {
            const pointer = `#/paths/${jsonPointerEscape(escapedPath)}`;
            doc.paths["/foo~bar-alias"] = { pathItemRef: pointer };
            ctx.pathCount++;
            mark(ctx, "ref.json-pointer.escaped");
            mark(ctx, "ref.path-item");
            mark(ctx, "path-item.ref");
        }
    }

    if (ctx.dialect === "3.1" && remainingPaths(ctx) > 0 && remainingOps(ctx) > 0) {
        const health: PathItemIR = {};
        attachOp(
            health,
            "get",
            {
                operationId: uniqueOperationId(ctx, "health"),
                responses: { "200": { kind: "inline", value: textPlainResponse(ctx, "OK") } },
            },
            ctx,
        );
        components.pathItems ??= {};
        components.pathItems.Health = health;
        doc.paths["/health"] = { $ref: { table: "pathItems", name: "Health" } };
        ctx.pathCount++;
        mark(ctx, "path-item.ref.components");
        mark(ctx, "path-item.ref");
        mark(ctx, "path.static");
    }

    if (ctx.tagNames.length) doc.tags = ctx.tagNames.map((name) => ({ name }));
}
