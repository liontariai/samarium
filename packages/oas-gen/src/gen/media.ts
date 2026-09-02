import { pickProperty, pickResource } from "../lexicon/index.ts";
import type { ComponentsIR, EncodingIR, OpenAPIDocument, PathItemIR, Ref, RequestBodyIR, SchemaIR } from "../ast/index.ts";
import { mark, remainingOps, remainingPaths, type GenContext } from "./context.ts";
import {
    addBearer,
    addSchema,
    attachOp,
    jsonResponse,
    maybeTags,
    primitiveSchema,
    schemaRef,
    textPlainResponse,
} from "./helpers.ts";
import { camel, resourcePath, uniqueOperationId } from "./names.ts";

function objectFromProps(ctx: GenContext, names: string[]): SchemaIR {
    mark(ctx, "schema.type.object");
    mark(ctx, "schema.object.properties");
    const properties: Record<string, Ref<SchemaIR>> = {};
    for (const name of names) {
        properties[name] = { kind: "inline", value: primitiveSchema(ctx, "string") };
    }
    return { kind: "object", properties, required: names.slice(0, 1) };
}

function multipartBody(ctx: GenContext): RequestBodyIR {
    const used = new Set<string>();
    const file = pickProperty(ctx, used).name;
    const note = pickProperty(ctx, used).name;
    const meta = pickProperty(ctx, used).name;
    const schema: SchemaIR = {
        kind: "object",
        properties: {
            [file]: { kind: "inline", value: primitiveSchema(ctx, "string", { format: "binary" }) },
            [note]: { kind: "inline", value: primitiveSchema(ctx, "string") },
            [meta]: { kind: "inline", value: objectFromProps(ctx, ["k"]) },
        },
        required: [file],
    };
    mark(ctx, "schema.type.object");
    mark(ctx, "schema.object.properties");
    const encoding: Record<string, EncodingIR> = {
        [file]: { contentType: "application/octet-stream" },
        [meta]: { contentType: "application/json", style: "form", explode: true },
    };
    mark(ctx, "media.multipart/form-data");
    mark(ctx, "encoding.multipart");
    mark(ctx, "op.requestBody");
    mark(ctx, "op.requestBody.required");
    return {
        required: true,
        content: {
            "multipart/form-data": { schema: { kind: "inline", value: schema }, encoding },
        },
    };
}

function urlencodedBody(ctx: GenContext): RequestBodyIR {
    const used = new Set<string>();
    const a = pickProperty(ctx, used).name;
    const b = pickProperty(ctx, used).name;
    mark(ctx, "media.application/x-www-form-urlencoded");
    mark(ctx, "op.requestBody");
    return {
        required: true,
        content: {
            "application/x-www-form-urlencoded": {
                schema: { kind: "inline", value: objectFromProps(ctx, [a, b]) },
                encoding: {
                    [a]: { style: "form", explode: true },
                },
            },
        },
    };
}

function xmlBody(ctx: GenContext): RequestBodyIR {
    mark(ctx, "media.application/xml");
    mark(ctx, "schema.xml");
    mark(ctx, "op.requestBody");
    return {
        required: true,
        content: {
            "application/xml": {
                schema: {
                    kind: "inline",
                    value: {
                        kind: "object",
                        xml: { name: "Payload", wrapped: true },
                        properties: {
                            id: { kind: "inline", value: primitiveSchema(ctx, "string") },
                        },
                        required: ["id"],
                    },
                },
            },
        },
    };
}

function binaryBody(ctx: GenContext): RequestBodyIR {
    mark(ctx, "media.application/octet-stream");
    mark(ctx, "op.requestBody");
    return {
        required: true,
        content: {
            "application/octet-stream": {
                schema: { kind: "inline", value: primitiveSchema(ctx, "string", { format: "binary" }) },
            },
        },
    };
}

function multiContentBody(ctx: GenContext, model: Ref<SchemaIR>): RequestBodyIR {
    mark(ctx, "media.multi-content");
    mark(ctx, "media.application/json");
    mark(ctx, "media.text/plain");
    mark(ctx, "op.requestBody");
    return {
        required: false,
        content: {
            "application/json": { schema: model },
            "text/plain": { schema: { kind: "inline", value: primitiveSchema(ctx, "string") } },
        },
    };
}

export function genMediaMatrix(ctx: GenContext, doc: OpenAPIDocument): void {
    const components: ComponentsIR = doc.components ?? {};
    doc.components = components;
    addBearer(ctx, components, doc);
    const used = new Set<string>();
    const resource = pickResource(ctx, used);
    addSchema(ctx, components, resource, {
        kind: "object",
        properties: {
            id: { kind: "inline", value: primitiveSchema(ctx, "string") },
            name: { kind: "inline", value: primitiveSchema(ctx, "string") },
        },
        required: ["id"],
    });
    const model = schemaRef(resource);
    const tags = maybeTags(ctx, resource);
    const base = resourcePath(resource);
    doc.paths ??= {};

    const specs: Array<{ path: string; body: RequestBodyIR; op: string }> = [
        { path: `${base}/upload`, body: multipartBody(ctx), op: "upload" },
        { path: `${base}/form`, body: urlencodedBody(ctx), op: "submitForm" },
        { path: `${base}/xml`, body: xmlBody(ctx), op: "putXml" },
        { path: `${base}/bin`, body: binaryBody(ctx), op: "putBin" },
        { path: `${base}/any`, body: multiContentBody(ctx, model), op: "putAny" },
    ];

    for (const spec of specs) {
        if (remainingPaths(ctx) <= 0 || remainingOps(ctx) <= 0) break;
        const item: PathItemIR = {};
        attachOp(
            item,
            "post",
            {
                operationId: uniqueOperationId(ctx, camel(spec.op, resource)),
                tags,
                requestBody: { kind: "inline", value: spec.body },
                responses: {
                    "200": { kind: "inline", value: jsonResponse(ctx, model, "OK", "2xx") },
                },
            },
            ctx,
        );
        doc.paths[spec.path] = item;
        ctx.pathCount++;
        mark(ctx, "path.static");
    }

    if (remainingPaths(ctx) > 0 && remainingOps(ctx) > 0) {
        const ping: PathItemIR = {};
        attachOp(
            ping,
            "get",
            {
                operationId: uniqueOperationId(ctx, "health"),
                responses: { "200": { kind: "inline", value: textPlainResponse(ctx, "OK") } },
            },
            ctx,
        );
        doc.paths["/ping"] = ping;
        ctx.pathCount++;
    }

    if (ctx.tagNames.length) doc.tags = ctx.tagNames.map((name) => ({ name }));
}
