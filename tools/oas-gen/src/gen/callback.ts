import { jsonPointerEscape } from "../dialects/index.ts";
import type { CallbackIR, ComponentsIR, LinkIR, OpenAPIDocument, PathItemIR, SchemaIR } from "../ast/index.ts";
import { mark, remainingOps, remainingPaths, type GenContext } from "./context.ts";
import {
    addSchema,
    attachOp,
    jsonRequest,
    jsonResponse,
    primitiveSchema,
    schemaRef,
    textPlainResponse,
} from "./helpers.ts";
import { uniqueOperationId } from "./names.ts";
import { pathParam } from "./parameter.ts";

const CALLBACK_EXPR = "{$request.body#/callbackUrl}";

function eventSchema(ctx: GenContext): SchemaIR {
    return {
        kind: "object",
        properties: {
            id: { kind: "inline", value: primitiveSchema(ctx, "string", { format: "uuid" }) },
            callbackUrl: { kind: "inline", value: primitiveSchema(ctx, "string", { format: "uri" }) },
        },
        required: ["id", "callbackUrl"],
    };
}

function callbackPathItem(ctx: GenContext): PathItemIR {
    const item: PathItemIR = {};
    attachOp(
        item,
        "post",
        {
            operationId: uniqueOperationId(ctx, "onEventCallback"),
            requestBody: {
                kind: "inline",
                value: jsonRequest(ctx, { kind: "inline", value: primitiveSchema(ctx, "string") }, true),
            },
            responses: {
                "200": { kind: "inline", value: textPlainResponse(ctx, "acked") },
            },
        },
        ctx,
    );
    return item;
}

export function genCallbackWebhook(ctx: GenContext, doc: OpenAPIDocument): void {
    const components: ComponentsIR = doc.components ?? {};
    doc.components = components;
    addSchema(ctx, components, "Event", eventSchema(ctx));
    const model = schemaRef("Event");
    const idName = "itemId";
    const collection = "/items";
    const member = `${collection}/{${idName}}`;
    const getId = uniqueOperationId(ctx, "getItem");
    const createId = uniqueOperationId(ctx, "createItem");

    const callback: CallbackIR = { [CALLBACK_EXPR]: callbackPathItem(ctx) };
    components.callbacks ??= {};
    components.callbacks.onEvent = callback;
    mark(ctx, "callback.expression");
    mark(ctx, "op.callbacks");
    mark(ctx, "ref.local.components");

    const linkById: LinkIR = {
        operationId: getId,
        parameters: { [idName]: "$request.path.itemId" },
        description: "Follow the created item",
    };
    mark(ctx, "link.operationId");
    mark(ctx, "link.runtime-expression");

    const linkByRef: LinkIR = {
        operationRef: `#/paths/${jsonPointerEscape(collection)}/post`,
        parameters: { [idName]: "$response.body#/id" },
        description: "Create another item from the response id",
    };
    mark(ctx, "link.operationRef");

    components.links ??= {};
    components.links.GetItem = linkById;
    mark(ctx, "response.links");

    doc.paths ??= {};

    const collectionItem: PathItemIR = {};
    attachOp(
        collectionItem,
        "post",
        {
            operationId: createId,
            requestBody: { kind: "inline", value: jsonRequest(ctx, model, true) },
            callbacks: { onEvent: { kind: "ref", target: { table: "callbacks", name: "onEvent" } } },
            responses: {
                "200": {
                    kind: "inline",
                    value: {
                        ...jsonResponse(ctx, model, "Created", "2xx"),
                        links: {
                            getItem: { kind: "ref", target: { table: "links", name: "GetItem" } },
                            selfByRef: { kind: "inline", value: linkByRef },
                        },
                    },
                },
            },
        },
        ctx,
    );
    doc.paths[collection] = collectionItem;
    ctx.pathCount++;
    mark(ctx, "path.static");

    if (remainingPaths(ctx) > 0 && remainingOps(ctx) > 0) {
        const memberItem: PathItemIR = {
            parameters: [{ kind: "inline", value: pathParam(ctx, idName) }],
        };
        attachOp(
            memberItem,
            "get",
            {
                operationId: getId,
                responses: { "200": { kind: "inline", value: jsonResponse(ctx, model, "OK", "2xx") } },
            },
            ctx,
        );
        doc.paths[member] = memberItem;
        ctx.pathCount++;
        mark(ctx, "path.single-param");
        mark(ctx, "path-item.parameters");
        mark(ctx, "op.parameters.inherited");
    }

    const pingItem: PathItemIR = {};
    attachOp(
        pingItem,
        "get",
        {
            operationId: uniqueOperationId(ctx, "health"),
            responses: { "200": { kind: "inline", value: textPlainResponse(ctx, "OK") } },
        },
        ctx,
    );

    if (ctx.dialect === "3.1") {
        components.pathItems ??= {};
        components.pathItems.HealthPing = pingItem;
        mark(ctx, "path-item.ref.components");
        mark(ctx, "path-item.ref");
        mark(ctx, "ref.path-item");
        if (remainingPaths(ctx) > 0) {
            doc.paths["/ping"] = { $ref: { table: "pathItems", name: "HealthPing" } };
            ctx.pathCount++;
        }

        const hook: PathItemIR = {};
        attachOp(
            hook,
            "post",
            {
                operationId: uniqueOperationId(ctx, "webhookNewItem"),
                requestBody: { kind: "inline", value: jsonRequest(ctx, model, true) },
                responses: { "200": { kind: "inline", value: jsonResponse(ctx, model, "accepted", "2xx") } },
            },
            ctx,
        );
        doc.webhooks = { newItem: hook };
        mark(ctx, "webhook.map");
    } else if (remainingPaths(ctx) > 0) {
        doc.paths["/ping"] = pingItem;
        ctx.pathCount++;
        mark(ctx, "path.static");
        if (remainingPaths(ctx) > 0) {
            doc.paths["/pingAlias"] = { pathItemRef: `#/paths/${jsonPointerEscape("/ping")}` };
            ctx.pathCount++;
            mark(ctx, "path-item.ref");
            mark(ctx, "ref.path-item");
        }
    }

    if (ctx.tagNames.length) doc.tags = ctx.tagNames.map((name) => ({ name }));
}
