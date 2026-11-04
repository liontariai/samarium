import type { Dialect } from "../types.ts";

export type DialectTable = {
    dialect: Dialect;
    defaultVersion: string;
    versions: string[];
    allows: {
        nullable: boolean;
        exclusiveMinimumBoolean: boolean;
        schemaExample: boolean;
        schemaExamples: boolean;
        webhooks: boolean;
        jsonSchemaDialect: boolean;
        pathItemsComponents: boolean;
        licenseIdentifier: boolean;
        infoSummary: boolean;
        typeArray: boolean;
        typeNull: boolean;
        schemaConst: boolean;
        prefixItems: boolean;
        ifThenElse: boolean;
        patternProperties: boolean;
        propertyNames: boolean;
        dependentRequired: boolean;
        dependentSchemas: boolean;
        mutualTLS: boolean;
    };
};

export const OAS30: DialectTable = {
    dialect: "3.0",
    defaultVersion: "3.0.3",
    versions: ["3.0.0", "3.0.1", "3.0.2", "3.0.3"],
    allows: {
        nullable: true,
        exclusiveMinimumBoolean: true,
        schemaExample: true,
        schemaExamples: false,
        webhooks: false,
        jsonSchemaDialect: false,
        pathItemsComponents: false,
        licenseIdentifier: false,
        infoSummary: false,
        typeArray: false,
        typeNull: false,
        schemaConst: false,
        prefixItems: false,
        ifThenElse: false,
        patternProperties: false,
        propertyNames: false,
        dependentRequired: false,
        dependentSchemas: false,
        mutualTLS: false,
    },
};

export const OAS31: DialectTable = {
    dialect: "3.1",
    defaultVersion: "3.1.0",
    versions: ["3.1.0", "3.1.1"],
    allows: {
        nullable: false,
        exclusiveMinimumBoolean: false,
        schemaExample: false,
        schemaExamples: true,
        webhooks: true,
        jsonSchemaDialect: true,
        pathItemsComponents: true,
        licenseIdentifier: true,
        infoSummary: true,
        typeArray: true,
        typeNull: true,
        schemaConst: true,
        prefixItems: true,
        ifThenElse: true,
        patternProperties: true,
        propertyNames: true,
        dependentRequired: true,
        dependentSchemas: true,
        mutualTLS: true,
    },
};

export function dialectTable(dialect: Dialect): DialectTable {
    return dialect === "3.0" ? OAS30 : OAS31;
}

/** Legal `style` values by `in`. Sparse; do not pick at random without this table. */
export const LEGAL_STYLE: Record<"path" | "query" | "header" | "cookie", readonly string[]> = {
    path: ["simple", "label", "matrix"],
    query: ["form", "spaceDelimited", "pipeDelimited", "deepObject"],
    header: ["simple"],
    cookie: ["form"],
};

export const COMPONENT_KEY_RE = /^[a-zA-Z0-9.\-_]+$/;

export const RESERVED_HEADER_NAMES = new Set(["accept", "content-type", "authorization"]);

export function jsonPointerEscape(segment: string): string {
    return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

export function componentRef(table: string, name: string): string {
    return `#/components/${table}/${jsonPointerEscape(name)}`;
}

export type ParamIn = "path" | "query" | "header" | "cookie";
export type ParamSchemaKind = "primitive" | "array" | "object";

/** Sparse legal cells. Do not sample style/explode without this table. */
export type ParamCell = {
    inn: ParamIn;
    style: string;
    explode: boolean;
    schemaKind: ParamSchemaKind;
    content?: boolean;
    allowEmptyValue?: boolean;
    allowReserved?: boolean;
};

export const PARAM_MATRIX_CELLS: ParamCell[] = [
    { inn: "path", style: "simple", explode: false, schemaKind: "primitive" },
    { inn: "path", style: "simple", explode: true, schemaKind: "array" },
    { inn: "path", style: "label", explode: false, schemaKind: "primitive" },
    { inn: "path", style: "label", explode: true, schemaKind: "primitive" },
    { inn: "path", style: "matrix", explode: false, schemaKind: "primitive" },
    { inn: "path", style: "matrix", explode: true, schemaKind: "array" },
    { inn: "query", style: "form", explode: true, schemaKind: "primitive" },
    { inn: "query", style: "form", explode: false, schemaKind: "array" },
    { inn: "query", style: "form", explode: true, schemaKind: "object" },
    { inn: "query", style: "spaceDelimited", explode: false, schemaKind: "array" },
    { inn: "query", style: "pipeDelimited", explode: false, schemaKind: "array" },
    { inn: "query", style: "deepObject", explode: true, schemaKind: "object" },
    { inn: "header", style: "simple", explode: false, schemaKind: "primitive" },
    { inn: "header", style: "simple", explode: true, schemaKind: "array" },
    { inn: "cookie", style: "form", explode: true, schemaKind: "primitive" },
    { inn: "cookie", style: "form", explode: false, schemaKind: "primitive" },
    { inn: "query", style: "form", explode: true, schemaKind: "primitive", content: true },
    { inn: "query", style: "form", explode: true, schemaKind: "primitive", allowEmptyValue: true },
    { inn: "query", style: "form", explode: true, schemaKind: "primitive", allowReserved: true },
];
