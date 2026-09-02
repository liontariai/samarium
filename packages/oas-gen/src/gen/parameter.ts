import { PARAM_MATRIX_CELLS, type ParamCell } from "../dialects/index.ts";
import { pickCookie, pickDescription, pickHeader, pickPathParam, pickQuery } from "../lexicon/index.ts";
import type { ComponentsIR, OpenAPIDocument, ParameterIR, PathItemIR, PrimitiveType, Ref, SchemaIR } from "../ast/index.ts";
import { mark, remainingOps, remainingPaths, type GenContext } from "./context.ts";
import {
    addBearer,
    attachOp,
    jsonResponse,
    primitiveSchema,
    textPlainResponse,
} from "./helpers.ts";
import { uniqueOperationId } from "./names.ts";

function arraySchema(ctx: GenContext): SchemaIR {
    mark(ctx, "param.array");
    mark(ctx, "schema.type.array");
    return { kind: "array", items: { kind: "inline", value: primitiveSchema(ctx, "string") } };
}

function objectSchema(ctx: GenContext): SchemaIR {
    mark(ctx, "param.object");
    mark(ctx, "schema.type.object");
    mark(ctx, "schema.object.properties");
    return {
        kind: "object",
        properties: {
            k: { kind: "inline", value: primitiveSchema(ctx, "string") },
            n: { kind: "inline", value: primitiveSchema(ctx, "integer") },
        },
    };
}

function exampleForSchema(schema: Ref<SchemaIR>): unknown {
    if (schema.kind !== "inline") return "sample";
    const s = schema.value;
    if (s.kind === "primitive") {
        if (s.type === "integer" || s.type === "number") return 1;
        if (s.type === "boolean") return true;
        return "sample";
    }
    if (s.kind === "array") return ["a"];
    if (s.kind === "object") return { k: "v" };
    return "sample";
}

function schemaForCell(ctx: GenContext, cell: ParamCell, type: PrimitiveType = "string"): SchemaIR {
    if (cell.schemaKind === "array") return arraySchema(ctx);
    if (cell.schemaKind === "object") return objectSchema(ctx);
    return primitiveSchema(ctx, type);
}

function markStyle(ctx: GenContext, style: string): void {
    mark(ctx, `param.style.${style}`);
}

export function pathParam(ctx: GenContext, name: string, cell?: ParamCell): ParameterIR {
    const style = cell?.style ?? "simple";
    const explode = cell?.explode ?? false;
    mark(ctx, "param.in.path");
    mark(ctx, "param.schema");
    markStyle(ctx, style);
    mark(ctx, "param.explode");
    mark(ctx, "op.parameters.inline");
    return {
        name,
        in: "path",
        required: true,
        style,
        explode,
        schema: { kind: "inline", value: schemaForCell(ctx, cell ?? { inn: "path", style, explode, schemaKind: "primitive" }) },
        description: ctx.rng.bool(0.3) ? pickDescription(ctx) : undefined,
    };
}

export function queryParam(
    ctx: GenContext,
    name: string,
    type: PrimitiveType = "string",
    format?: string,
    cell?: ParamCell,
): ParameterIR {
    const style = cell?.style ?? "form";
    const explode = cell?.explode ?? true;
    mark(ctx, "param.in.query");
    mark(ctx, "op.parameters.inline");
    const p: ParameterIR = {
        name,
        in: "query",
        required: false,
        description: ctx.rng.bool(0.25) ? pickDescription(ctx) : undefined,
    };
    if (cell?.content) {
        mark(ctx, "param.content");
        p.content = {
            "application/json": {
                schema: { kind: "inline", value: primitiveSchema(ctx, type, format ? { format } : undefined) },
            },
        };
        return p;
    }
    markStyle(ctx, style);
    mark(ctx, "param.explode");
    p.style = style;
    p.explode = explode;
    mark(ctx, "param.schema");
    p.schema = { kind: "inline", value: schemaForCell(ctx, cell ?? { inn: "query", style, explode, schemaKind: "primitive" }, type) };
    if (format && p.schema.kind === "inline" && p.schema.value.kind === "primitive") {
        p.schema.value.format = format;
        mark(ctx, `schema.format.${format}`);
    }
    if (cell?.allowEmptyValue) {
        p.allowEmptyValue = true;
        mark(ctx, "param.allowEmptyValue");
    }
    if (cell?.allowReserved) {
        p.allowReserved = true;
        mark(ctx, "param.allowReserved");
    }
    if (ctx.dialect === "3.0" && ctx.rng.bool(0.2)) {
        p.example = type === "integer" ? 10 : type === "boolean" ? true : "sample";
        mark(ctx, "param.example");
    } else if (ctx.dialect === "3.1" && ctx.rng.bool(0.2)) {
        p.examples = {
            one: { kind: "inline", value: { value: type === "integer" ? 10 : "sample" } },
        };
        mark(ctx, "param.examples");
    }
    return p;
}

function headerParam(ctx: GenContext, name: string, cell: ParamCell): ParameterIR {
    mark(ctx, "param.in.header");
    mark(ctx, "param.schema");
    markStyle(ctx, cell.style);
    mark(ctx, "param.explode");
    mark(ctx, "op.parameters.inline");
    return {
        name,
        in: "header",
        required: false,
        style: cell.style,
        explode: cell.explode,
        schema: { kind: "inline", value: schemaForCell(ctx, cell) },
    };
}

function cookieParam(ctx: GenContext, name: string, cell: ParamCell): ParameterIR {
    mark(ctx, "param.in.cookie");
    mark(ctx, "param.schema");
    markStyle(ctx, cell.style);
    mark(ctx, "param.explode");
    mark(ctx, "op.parameters.inline");
    return {
        name,
        in: "cookie",
        required: false,
        style: cell.style,
        explode: cell.explode,
        schema: { kind: "inline", value: schemaForCell(ctx, cell) },
    };
}

export function genParamMatrix(ctx: GenContext, doc: OpenAPIDocument): void {
    const components: ComponentsIR = doc.components ?? {};
    doc.components = components;
    addBearer(ctx, components, doc);

    const pathCells = PARAM_MATRIX_CELLS.filter((c) => c.inn === "path");
    const otherCells = PARAM_MATRIX_CELLS.filter((c) => c.inn !== "path");
    const usedPath = new Set<string>();
    const pathNames = pathCells.map(() => pickPathParam(ctx, usedPath));
    const template = "/probe/" + pathNames.map((n) => `{${n}}`).join("/");
    mark(ctx, pathNames.length > 1 ? "path.multi-param" : "path.single-param");

    const parameters: Ref<ParameterIR>[] = [];
    pathCells.forEach((cell, i) => {
        parameters.push({ kind: "inline", value: pathParam(ctx, pathNames[i]!, cell) });
    });

    const usedQ = new Set<string>();
    const usedH = new Set<string>();
    const usedC = new Set<string>();
    for (const cell of otherCells) {
        if (cell.inn === "query") {
            const q = pickQuery(ctx, usedQ);
            parameters.push({ kind: "inline", value: queryParam(ctx, q.name, q.type ?? "string", q.format, cell) });
        } else if (cell.inn === "header") {
            const name = pickHeader(ctx, usedH);
            parameters.push({ kind: "inline", value: headerParam(ctx, name, cell) });
        } else {
            const name = pickCookie(ctx, usedC);
            parameters.push({ kind: "inline", value: cookieParam(ctx, name, cell) });
        }
    }
    for (const p of parameters) {
        if (p.kind !== "inline" || p.value.in !== "query" || !p.value.schema || p.value.content) continue;
        const sample = exampleForSchema(p.value.schema);
        if (ctx.dialect === "3.0") {
            p.value.example = sample;
            mark(ctx, "param.example");
        } else {
            p.value.examples = { one: { kind: "inline", value: { value: sample } } };
            mark(ctx, "param.examples");
        }
        break;
    }

    const item: PathItemIR = {};
    const headers: Record<string, Ref<import("../ast/index.ts").HeaderIR>> = {
        [pickHeader(ctx, new Set(usedH))]: {
            kind: "inline",
            value: { schema: { kind: "inline", value: primitiveSchema(ctx, "integer") } },
        },
    };
    mark(ctx, "response.headers");

    attachOp(
        item,
        "get",
        {
            operationId: uniqueOperationId(ctx, "probeParams"),
            parameters,
            responses: {
                "200": {
                    kind: "inline",
                    value: {
                        description: "OK",
                        headers,
                        content: {
                            "application/json": {
                                schema: { kind: "inline", value: primitiveSchema(ctx, "string") },
                            },
                        },
                    },
                },
            },
        },
        ctx,
    );
    mark(ctx, "media.application/json");
    mark(ctx, "response.description");
    mark(ctx, "op.responses.2xx");

    doc.paths ??= {};
    doc.paths[template] = item;
    ctx.pathCount++;

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
        mark(ctx, "path.static");
    }

    if (ctx.tagNames.length) doc.tags = ctx.tagNames.map((name) => ({ name }));
}
