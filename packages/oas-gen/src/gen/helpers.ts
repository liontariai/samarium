import type {
    ComponentsIR,
    OperationIR,
    PathItemIR,
    PrimitiveType,
    Ref,
    RequestBodyIR,
    ResponseIR,
    SchemaIR,
    SecuritySchemeIR,
} from "../ast/index.ts";
import type { OpenAPIDocument } from "../ast/index.ts";
import { mark, remainingSchemas, type GenContext } from "./context.ts";
import { uniqueOperationId } from "./names.ts";

export function primitiveSchema(
    ctx: GenContext,
    type?: PrimitiveType,
    extra?: Partial<Extract<SchemaIR, { kind: "primitive" }>>,
): SchemaIR {
    const t = type ?? ctx.rng.pick(["string", "number", "integer", "boolean"] as const);
    mark(ctx, `schema.type.${t}`);
    if (extra?.format) mark(ctx, `schema.format.${extra.format}`);
    if (extra?.enum) mark(ctx, "schema.enum");
    if (extra?.const !== undefined) mark(ctx, "schema.const");
    if (extra?.nullable) mark(ctx, "schema.nullable");
    if (extra?.types) {
        mark(ctx, "schema.type.array-union");
        if (extra.types.includes("null")) mark(ctx, "schema.type.null");
    }
    if (extra?.minLength != null || extra?.maxLength != null) mark(ctx, "schema.string.length");
    if (extra?.pattern) mark(ctx, "schema.string.pattern");
    if (extra?.minimum != null || extra?.maximum != null) mark(ctx, "schema.min-max");
    if (extra?.exclusiveMinimum != null || extra?.exclusiveMaximum != null) mark(ctx, "schema.exclusive");
    if (extra?.multipleOf != null) mark(ctx, "schema.multipleOf");
    if (extra?.default !== undefined) mark(ctx, "schema.default");
    if (extra?.example !== undefined) mark(ctx, "schema.example");
    if (extra?.examples) mark(ctx, "schema.examples");
    if (extra?.readOnly) mark(ctx, "schema.readOnly");
    if (extra?.writeOnly) mark(ctx, "schema.writeOnly");
    if (extra?.deprecated) mark(ctx, "schema.deprecated");
    return { kind: "primitive", type: t, ...extra };
}

export function addSchema(ctx: GenContext, components: ComponentsIR, name: string, schema: SchemaIR): void {
    components.schemas ??= {};
    components.schemas[name] = schema;
    ctx.schemaCount++;
    ctx.finishedSchemas.push(name);
    mark(ctx, "components.schemas");
}

export function textPlainResponse(ctx: GenContext, description: string): ResponseIR {
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

export function jsonResponse(ctx: GenContext, schema: Ref<SchemaIR>, description: string, code: "2xx" | "4xx"): ResponseIR {
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

export function jsonRequest(ctx: GenContext, schema: Ref<SchemaIR>, required: boolean): RequestBodyIR {
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

export function errorSchemaRef(ctx: GenContext, components: ComponentsIR): Ref<SchemaIR> {
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

export function maybeTags(ctx: GenContext, resource: string): string[] | undefined {
    if (ctx.forbid.has("op.tags")) return undefined;
    if (!ctx.force.has("op.tags") && !ctx.rng.bool(0.5)) return undefined;
    mark(ctx, "op.tags");
    if (!ctx.tagNames.includes(resource)) ctx.tagNames.push(resource);
    return [resource];
}

export function attachOp(item: PathItemIR, method: keyof PathItemIR, op: OperationIR, ctx: GenContext): void {
    (item as Record<string, unknown>)[method] = op;
    ctx.opCount++;
    mark(ctx, `op.method.${method}`);
    if (op.operationId) mark(ctx, "op.operationId");
}

export function addBearer(ctx: GenContext, components: ComponentsIR, doc: OpenAPIDocument): void {
    if (ctx.forbid.has("security.http.bearer")) return;
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

export function schemaRef(name: string): Ref<SchemaIR> {
    return { kind: "ref", target: { table: "schemas", name } };
}

export function opId(ctx: GenContext, verb: string, resource: string): string {
    return uniqueOperationId(ctx, verb + resource);
}
