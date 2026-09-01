/*
 * Normalize OAS 3.0 / 3.1 JSON Schema nodes into a narrower shape that
 * `gatherMetaForType` can classify without falling back to `any`.
 *
 * Does not mutate the input document.
 */
import type { OpenAPI3, ReferenceObject, SchemaObject } from "openapi-typescript";

export type OpenAPISchemaNode = SchemaObject & {
    prefixItems?: (SchemaObject | ReferenceObject)[];
    const?: unknown;
    nullable?: boolean;
    content?: Record<string, { schema?: SchemaObject | ReferenceObject }>;
    "x-typescript-type"?: string;
    "x-ts-type"?: string;
};

export type NormalizedOpenAPISchema = {
    schema: OpenAPISchemaNode | ReferenceObject;
    isNullable: boolean;
};

const JSON_SCHEMA_TYPE_TO_SCALAR: Record<string, string> = {
    string: "String",
    String: "String",
    number: "Float",
    Number: "Float",
    integer: "Int",
    Integer: "Int",
    boolean: "Boolean",
    Boolean: "Boolean",
    float: "Float",
    Float: "Float",
    int: "Int",
    Int: "Int",
    Date: "Date",
    DateTime: "DateTime",
    Time: "Time",
    JSON: "JSON",
};

const FORMAT_TO_SCALAR: Record<string, string> = {
    double: "Float",
    float: "Float",
    integer: "Int",
    long: "Int",
    int32: "Int",
    int64: "Int",
    number: "Float",
    byte: "Int",
    "date-time": "DateTime",
    datetime: "DateTime",
    date: "Date",
    time: "Time",
};

const TYPEDEF_RE = /@typedef\s*{(.*)}/;
const TYPE_RE = /@type\s*{(.*)}/;

export function parseTypescriptTypeFromDescription(description: string | undefined): string | undefined {
    if (!description) return undefined;
    const typedef = description.match(TYPEDEF_RE)?.[1];
    if (typedef) return typedef.trim();
    const atType = description.match(TYPE_RE)?.[1];
    if (atType) return atType.trim();
    return undefined;
}

export function parseTypescriptTypeFromSchema(schema: OpenAPISchemaNode | undefined): string | undefined {
    if (!schema) return undefined;
    const ext = schema["x-typescript-type"] ?? schema["x-ts-type"];
    if (typeof ext === "string" && ext.trim()) return ext.trim();
    return parseTypescriptTypeFromDescription(schema.description);
}

export function mapJsonSchemaTypeToSamariumScalar(schema: {
    type?: unknown;
    format?: string;
}): string | undefined {
    const format = typeof schema.format === "string" ? schema.format.toLowerCase() : undefined;
    if (format && format in FORMAT_TO_SCALAR) {
        return FORMAT_TO_SCALAR[format];
    }
    if (typeof schema.type !== "string") return undefined;
    return JSON_SCHEMA_TYPE_TO_SCALAR[schema.type] ?? JSON_SCHEMA_TYPE_TO_SCALAR[capitalize(schema.type)];
}

function capitalize(s: string): string {
    return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function pickContentSchema(
    content: Record<string, { schema?: SchemaObject | ReferenceObject } | ReferenceObject> | undefined,
): SchemaObject | ReferenceObject | undefined {
    if (!content) return undefined;
    const preferred = content["application/json"] ?? content["application/json; charset=utf-8"];
    const media = preferred ?? Object.values(content).find(Boolean);
    if (!media) return undefined;
    if (typeof media === "object" && "$ref" in media && !("schema" in media)) {
        return media as ReferenceObject;
    }
    return (media as { schema?: SchemaObject | ReferenceObject }).schema;
}

export function isTupleSchema(schema: OpenAPISchemaNode | undefined): boolean {
    return !!schema && Array.isArray(schema.prefixItems);
}

function shallowClone<T extends object>(node: T): T {
    const copy = { ...node } as T & {
        type?: unknown;
        enum?: unknown[];
        allOf?: unknown[];
        anyOf?: unknown[];
        oneOf?: unknown[];
        required?: string[];
        properties?: Record<string, unknown>;
        prefixItems?: unknown[];
    };
    if (Array.isArray(copy.type)) copy.type = [...copy.type];
    if (Array.isArray(copy.enum)) copy.enum = [...copy.enum];
    if (Array.isArray(copy.allOf)) copy.allOf = [...copy.allOf];
    if (Array.isArray(copy.anyOf)) copy.anyOf = [...copy.anyOf];
    if (Array.isArray(copy.oneOf)) copy.oneOf = [...copy.oneOf];
    if (Array.isArray(copy.required)) copy.required = [...copy.required];
    if (copy.properties) copy.properties = { ...copy.properties };
    if (Array.isArray(copy.prefixItems)) copy.prefixItems = [...copy.prefixItems];
    return copy as T;
}

export function resolveRef(doc: OpenAPI3, node: unknown, seen: Set<string> = new Set()): unknown {
    if (!node || typeof node !== "object" || !("$ref" in node)) return node;
    const ref = (node as ReferenceObject).$ref;
    if (typeof ref !== "string" || seen.has(ref)) return node;
    seen.add(ref);
    const parts = ref.split("/").slice(1);
    let cur: any = doc;
    for (const part of parts) {
        cur = cur?.[part];
    }
    if (!cur) return node;
    return resolveRef(doc, cur, seen);
}

export function isNullSchema(doc: OpenAPI3, node: unknown): boolean {
    const resolved = resolveRef(doc, node);
    if (!resolved || typeof resolved !== "object") return false;
    const type = (resolved as OpenAPISchemaNode).type;
    if (type === "null") return true;
    if (Array.isArray(type) && type.length > 0 && type.every((t) => t === "null")) return true;
    return false;
}

function isBareRef(node: unknown): node is ReferenceObject {
    return !!node && typeof node === "object" && "$ref" in node && Object.keys(node as object).length === 1;
}

/**
 * Collapse OAS 3.0 `nullable`, OAS 3.1 `type` arrays, `anyOf`/`oneOf` null
 * arms, `const`, and `allOf` composition into a single inner schema plus an
 * `isNullable` flag.
 *
 * Nullability is represented on TypeMeta (`isNullable`), not as a union
 * member named `Null`. Required + nullable means `T | null` (not optional);
 * optional + nullable means `T?`.
 */
export function normalizeOpenAPISchema(
    doc: OpenAPI3,
    raw: unknown,
    seen: WeakSet<object> = new WeakSet(),
): NormalizedOpenAPISchema {
    if (!raw || typeof raw !== "object") {
        return { schema: (raw ?? {}) as OpenAPISchemaNode, isNullable: false };
    }

    if (seen.has(raw as object)) {
        return { schema: raw as OpenAPISchemaNode | ReferenceObject, isNullable: false };
    }
    seen.add(raw as object);

    if (isBareRef(raw)) {
        return { schema: raw, isNullable: false };
    }

    let schema = shallowClone(raw as OpenAPISchemaNode);
    let isNullable = false;

    if (schema.nullable === true) {
        isNullable = true;
        delete schema.nullable;
    }

    if ("const" in schema && schema.const !== undefined && !schema.enum) {
        schema.enum = [schema.const as never];
        delete schema.const;
    }

    if (Array.isArray(schema.type)) {
        const hadNull = schema.type.includes("null");
        const types = schema.type.filter((t) => t !== "null");
        if (hadNull) isNullable = true;
        if (types.length === 0) {
            schema.type = "null";
        } else if (types.length === 1) {
            schema.type = types[0];
        } else {
            delete schema.type;
            schema.anyOf = types.map((t) => ({ type: t }));
        }
    }

    for (const key of ["anyOf", "oneOf"] as const) {
        const arms = schema[key];
        if (!Array.isArray(arms) || arms.length === 0) continue;
        const nonNull = arms.filter((arm) => !isNullSchema(doc, arm));
        if (nonNull.length !== arms.length) isNullable = true;
        if (nonNull.length === 1 && !schema[key === "anyOf" ? "oneOf" : "anyOf"]) {
            const arm = nonNull[0];
            delete schema[key];
            if (isBareRef(arm) && !schema.properties && !schema.type && !schema.enum) {
                const inner = normalizeOpenAPISchema(doc, arm, seen);
                return { schema: inner.schema, isNullable: isNullable || inner.isNullable };
            }
            const merged = isBareRef(arm)
                ? arm
                : ({ ...schema, ...shallowClone(arm as OpenAPISchemaNode) } as OpenAPISchemaNode);
            if (schema.description && !isBareRef(merged) && !merged.description) {
                merged.description = schema.description;
            }
            const inner = normalizeOpenAPISchema(doc, merged, seen);
            return { schema: inner.schema, isNullable: isNullable || inner.isNullable };
        }
        schema[key] = nonNull as typeof arms;
    }

    if (Array.isArray(schema.allOf) && !schema.anyOf && !schema.oneOf) {
        const members = schema.allOf.filter((m) => !isNullSchema(doc, m));
        if (members.length !== schema.allOf.length) isNullable = true;

        if (members.length === 1) {
            const arm = members[0];
            const leftoverKeys = Object.keys(schema).filter(
                (k) =>
                    ![
                        "allOf",
                        "nullable",
                        "description",
                        "title",
                        "type",
                        "example",
                        "examples",
                        "default",
                    ].includes(k) && (schema as any)[k] !== undefined,
            );
            const typeIsVacuous = !schema.type || schema.type === "object";
            if (isBareRef(arm) && leftoverKeys.length === 0 && typeIsVacuous && !schema.properties) {
                const inner = normalizeOpenAPISchema(doc, arm, seen);
                return { schema: inner.schema, isNullable: isNullable || inner.isNullable };
            }
        }

        if (members.length >= 1) {
            const merged = mergeAllOfMembers(doc, members, schema, seen);
            const inner = normalizeOpenAPISchema(doc, merged, seen);
            return { schema: inner.schema, isNullable: isNullable || inner.isNullable };
        }
    }

    if (schema.properties && !schema.type) {
        schema.type = "object";
    }

    return { schema, isNullable };
}

function mergeAllOfMembers(
    doc: OpenAPI3,
    members: (SchemaObject | ReferenceObject)[],
    parent: OpenAPISchemaNode,
    seen: WeakSet<object>,
): OpenAPISchemaNode {
    const result = shallowClone(parent);
    delete result.allOf;
    result.properties = { ...(parent.properties ?? {}) };
    result.required = [...(parent.required ?? [])];

    for (const member of members) {
        const resolved = resolveRef(doc, member);
        const { schema: inner } = normalizeOpenAPISchema(doc, resolved, seen);
        if (inner && typeof inner === "object" && "$ref" in inner) {
            const nested = resolveRef(doc, inner);
            const { schema: nestedSchema } = normalizeOpenAPISchema(doc, nested, seen);
            mergeObjectBits(result, nestedSchema as OpenAPISchemaNode);
        } else {
            mergeObjectBits(result, inner as OpenAPISchemaNode);
        }
    }

    if (result.required?.length) {
        result.required = [...new Set(result.required)];
    } else {
        delete result.required;
    }
    if (result.properties && Object.keys(result.properties).length === 0 && !parent.properties) {
        delete result.properties;
    }
    if (!result.type && result.properties) {
        result.type = "object";
    }
    return result;
}

function mergeObjectBits(target: OpenAPISchemaNode, source: OpenAPISchemaNode | undefined): void {
    if (!source || typeof source !== "object") return;
    if ("$ref" in source) return;
    if (source.properties) {
        target.properties = { ...(target.properties ?? {}), ...source.properties };
    }
    if (source.required) {
        target.required = [...(target.required ?? []), ...source.required];
    }
    if (source.additionalProperties !== undefined && target.additionalProperties === undefined) {
        target.additionalProperties = source.additionalProperties;
    }
    if (source.type && !target.type) {
        target.type = source.type;
    }
    if (source.enum && !target.enum) {
        target.enum = source.enum;
    }
}
