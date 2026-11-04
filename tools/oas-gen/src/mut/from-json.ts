import { HTTP_METHODS, type OpenAPIDocument, type OperationIR, type ParameterIR, type PathItemIR, type Ref, type RequestBodyIR, type ResponseIR, type SchemaIR, type SecuritySchemeIR } from "../ast/index.ts";

function isObj(x: unknown): x is Record<string, unknown> {
    return !!x && typeof x === "object" && !Array.isArray(x);
}

function parseComponentRef(ref: string): { table: SchemaIR extends never ? never : "schemas"; name: string } | undefined {
    const m = ref.match(/^#\/components\/([^/]+)\/(.+)$/);
    if (!m) return undefined;
    return { table: m[1] as "schemas", name: m[2]!.replace(/~1/g, "/").replace(/~0/g, "~") };
}

export function jsonToSchema(node: unknown): SchemaIR {
    if (!isObj(node)) return { kind: "opaque", value: {} };
    if (typeof node.$ref === "string") {
        const t = parseComponentRef(node.$ref);
        if (t?.table === "schemas") {
            return {
                kind: "ref",
                target: { table: "schemas", name: t.name },
                description: typeof node.description === "string" ? node.description : undefined,
            };
        }
    }
    return { kind: "opaque", value: node };
}

function jsonToParam(node: Record<string, unknown>): ParameterIR {
    const schema = isObj(node.schema) ? jsonToSchema(node.schema) : undefined;
    return {
        name: String(node.name ?? "p"),
        in: (node.in as ParameterIR["in"]) ?? "query",
        required: node.required === true,
        description: typeof node.description === "string" ? node.description : undefined,
        deprecated: node.deprecated === true ? true : undefined,
        style: typeof node.style === "string" ? node.style : undefined,
        explode: typeof node.explode === "boolean" ? node.explode : undefined,
        schema: schema ? { kind: "inline", value: schema } : undefined,
        example: node.example,
    };
}

function jsonToResponse(node: Record<string, unknown>): ResponseIR {
    const content = isObj(node.content)
        ? Object.fromEntries(
              Object.entries(node.content).map(([mt, media]) => [
                  mt,
                  {
                      schema: isObj(media) && media.schema !== undefined ? { kind: "inline" as const, value: jsonToSchema(media.schema) } : undefined,
                  },
              ]),
          )
        : undefined;
    return {
        description: typeof node.description === "string" ? node.description : "Response",
        content,
    };
}

function jsonToRequestBody(node: Record<string, unknown>): RequestBodyIR {
    const content: RequestBodyIR["content"] = {};
    if (isObj(node.content)) {
        for (const [mt, media] of Object.entries(node.content)) {
            content[mt] = {
                schema: isObj(media) && media.schema !== undefined ? { kind: "inline", value: jsonToSchema(media.schema) } : undefined,
            };
        }
    }
    return { required: node.required === true, content, description: typeof node.description === "string" ? node.description : undefined };
}

function jsonToOp(node: Record<string, unknown>): OperationIR {
    const parameters: Ref<ParameterIR>[] | undefined = Array.isArray(node.parameters)
        ? node.parameters.filter(isObj).map((p) =>
              typeof p.$ref === "string"
                  ? { kind: "ref" as const, target: { table: "parameters" as const, name: parseComponentRef(p.$ref)?.name ?? "P" } }
                  : { kind: "inline" as const, value: jsonToParam(p) },
          )
        : undefined;
    const responses: Record<string, Ref<ResponseIR>> = {};
    if (isObj(node.responses)) {
        for (const [code, resp] of Object.entries(node.responses)) {
            if (!isObj(resp)) continue;
            if (typeof resp.$ref === "string") {
                responses[code] = { kind: "ref", target: { table: "responses", name: parseComponentRef(resp.$ref)?.name ?? code } };
            } else {
                responses[code] = { kind: "inline", value: jsonToResponse(resp) };
            }
        }
    }
    const requestBody = isObj(node.requestBody)
        ? typeof node.requestBody.$ref === "string"
            ? { kind: "ref" as const, target: { table: "requestBodies" as const, name: parseComponentRef(node.requestBody.$ref)?.name ?? "Body" } }
            : { kind: "inline" as const, value: jsonToRequestBody(node.requestBody) }
        : undefined;
    return {
        operationId: typeof node.operationId === "string" ? node.operationId : undefined,
        summary: typeof node.summary === "string" ? node.summary : undefined,
        description: typeof node.description === "string" ? node.description : undefined,
        tags: Array.isArray(node.tags) ? node.tags.filter((t): t is string => typeof t === "string") : undefined,
        deprecated: node.deprecated === true ? true : undefined,
        parameters,
        requestBody,
        responses,
        security: Array.isArray(node.security) ? (node.security as OperationIR["security"]) : undefined,
    };
}

function jsonToPathItem(node: Record<string, unknown>): PathItemIR {
    if (typeof node.$ref === "string") {
        const t = parseComponentRef(node.$ref);
        if (t?.table === "pathItems") return { $ref: { table: "pathItems", name: t.name } };
        return { pathItemRef: node.$ref };
    }
    const item: PathItemIR = {
        summary: typeof node.summary === "string" ? node.summary : undefined,
        description: typeof node.description === "string" ? node.description : undefined,
        parameters: Array.isArray(node.parameters)
            ? node.parameters.filter(isObj).map((p) =>
                  typeof p.$ref === "string"
                      ? { kind: "ref" as const, target: { table: "parameters" as const, name: parseComponentRef(p.$ref)?.name ?? "P" } }
                      : { kind: "inline" as const, value: jsonToParam(p) },
              )
            : undefined,
    };
    for (const m of HTTP_METHODS) {
        if (isObj(node[m])) item[m] = jsonToOp(node[m] as Record<string, unknown>);
    }
    return item;
}

function jsonToScheme(node: Record<string, unknown>): SecuritySchemeIR {
    return {
        type: (node.type as SecuritySchemeIR["type"]) ?? "http",
        description: typeof node.description === "string" ? node.description : undefined,
        name: typeof node.name === "string" ? node.name : undefined,
        in: node.in as SecuritySchemeIR["in"],
        scheme: typeof node.scheme === "string" ? node.scheme : undefined,
        bearerFormat: typeof node.bearerFormat === "string" ? node.bearerFormat : undefined,
        flows: isObj(node.flows) ? (node.flows as SecuritySchemeIR["flows"]) : undefined,
        openIdConnectUrl: typeof node.openIdConnectUrl === "string" ? node.openIdConnectUrl : undefined,
    };
}

/** Best-effort JSON → IR. Schema Objects become `opaque` unless they are a local `$ref`. */
export function jsonToIr(doc: unknown): OpenAPIDocument {
    if (!isObj(doc)) {
        return { openapi: "3.0.3", info: { title: "Imported", version: "0" }, paths: {} };
    }
    const info = isObj(doc.info) ? doc.info : {};
    const paths: Record<string, PathItemIR> = {};
    if (isObj(doc.paths)) {
        for (const [p, item] of Object.entries(doc.paths)) {
            if (isObj(item)) paths[p] = jsonToPathItem(item);
        }
    }
    const webhooks: Record<string, PathItemIR> = {};
    if (isObj(doc.webhooks)) {
        for (const [p, item] of Object.entries(doc.webhooks)) {
            if (isObj(item)) webhooks[p] = jsonToPathItem(item);
        }
    }
    const components = isObj(doc.components) ? doc.components : undefined;
    const ir: OpenAPIDocument = {
        openapi: typeof doc.openapi === "string" ? doc.openapi : "3.0.3",
        info: {
            title: typeof info.title === "string" ? info.title : "Imported",
            version: typeof info.version === "string" ? info.version : "0",
            description: typeof info.description === "string" ? info.description : undefined,
        },
        paths: Object.keys(paths).length ? paths : undefined,
        webhooks: Object.keys(webhooks).length ? webhooks : undefined,
        security: Array.isArray(doc.security) ? (doc.security as OpenAPIDocument["security"]) : undefined,
        servers: Array.isArray(doc.servers) ? (doc.servers as OpenAPIDocument["servers"]) : undefined,
        tags: Array.isArray(doc.tags) ? (doc.tags as OpenAPIDocument["tags"]) : undefined,
    };
    if (components) {
        ir.components = {};
        if (isObj(components.schemas)) {
            ir.components.schemas = Object.fromEntries(
                Object.entries(components.schemas).map(([k, v]) => [k, jsonToSchema(v)]),
            );
        }
        if (isObj(components.securitySchemes)) {
            ir.components.securitySchemes = Object.fromEntries(
                Object.entries(components.securitySchemes)
                    .filter(([, v]) => isObj(v))
                    .map(([k, v]) => [k, jsonToScheme(v as Record<string, unknown>)]),
            );
        }
        if (isObj(components.parameters)) {
            ir.components.parameters = Object.fromEntries(
                Object.entries(components.parameters)
                    .filter(([, v]) => isObj(v))
                    .map(([k, v]) => [k, jsonToParam(v as Record<string, unknown>)]),
            );
        }
    }
    return ir;
}

export function inferDialect(doc: OpenAPIDocument | Record<string, unknown>): "3.0" | "3.1" {
    const v = typeof (doc as { openapi?: string }).openapi === "string" ? (doc as { openapi: string }).openapi : "3.0.3";
    return v.startsWith("3.1") ? "3.1" : "3.0";
}
