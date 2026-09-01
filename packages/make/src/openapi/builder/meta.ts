/*
 * This file contains functions for gathering metadata about OpenAPI types, fields, and arguments.
 * This metadata is used to generate the query builder.
 */
import type {
    OpenAPI3,
    ParameterObject,
    PathItemObject,
    RequestBodyObject,
    ReferenceObject,
    SchemaObject,
    ResponseObject,
    HeaderObject,
    MediaTypeObject,
    ObjectSubtype,
    ArraySubtype,
    OperationObject,
} from "openapi-typescript";
import { Collector } from "./collector";
import {
    isTupleSchema,
    mapJsonSchemaTypeToSamariumScalar,
    normalizeOpenAPISchema,
    parseTypescriptTypeFromDescription,
    parseTypescriptTypeFromSchema,
    pickContentSchema,
    type OpenAPISchemaNode,
} from "./normalize";

import {
    type FieldMeta,
    type ParameterMeta,
    type SchemaMeta,
    type TypeMeta,
    type OperationMeta,
    type CodegenOptions,
    type OperationMethod,
    type SdkRuntimeMode,
    type ExternalRuntimeConfig,
} from "../types/meta";
export {
    type FieldMeta,
    type SchemaMeta,
    type TypeMeta,
    type ParameterMeta,
    type OperationMeta,
    type CodegenOptions,
    type OperationMethod,
    type SdkRuntimeMode,
    type ExternalRuntimeConfig,
};

const camelCaps = (arr: string[], separator: string = "$") => {
    let result = "";
    for (let str of arr.filter(Boolean)) {
        result += str.charAt(0).toUpperCase() + str.slice(1) + separator;
    }
    return result
        .slice(0, result.length - separator.length)
        .replaceAll("/", "_")
        .replaceAll("-", "_")
        .replaceAll(".", "_");
};

/**
 * Gather metadata about the schema.
 * @param schema GraphQL schema
 * @param options Codegen options
 * @returns
 */
export const gatherMeta = (schema: OpenAPI3, options: CodegenOptions, collector: Collector): SchemaMeta => {
    const meta: SchemaMeta = {
        types: [],
        operations: [],
        customScalars: [],
    };

    for (const [key, value] of Object.entries(schema?.components?.schemas ?? {})) {
        meta.types.push(gatherMetaForType(schema, key, value, "schemas", { isNonNull: false }, collector));
    }

    for (const [key, value] of Object.entries(schema?.paths ?? {})) {
        if ("$ref" in value) {
            continue;
        }

        for (const [method, methodValue] of Object.entries(value) as [
            OperationMethod,
            PathItemObject[OperationMethod],
        ][]) {
            if (!methodValue) {
                continue;
            }
            if ("$ref" in methodValue) {
                // TODO: Handle $ref in methodValue
                console.warn(`TODO: Handle $ref in methodValue for ${key}`);
                continue;
            }

            const operation = gatherMetaForPathOperation(schema, key, method, methodValue, options, collector);
            if (!operation) {
                continue;
            }
            meta.operations.push(operation);
        }
    }

    return meta;
};

const createACustomScalarType = (
    name: string,
    description: string | undefined,
    scalarTSType: string,
    collector: Collector,
): TypeMeta => {
    const fromTypedef = parseTypescriptTypeFromDescription(description);
    const meta: TypeMeta = {
        name,
        description,
        isScalar: true,
        scalarTSType: fromTypedef ?? scalarTSType,
        isEnum: false,
        isObject: false,
        isUnion: false,
        isList: 0,
        isNonNull: false,
        fields: [],
        possibleTypes: [],
        inputFields: [],
        isInput: false,
        enumValues: [],
    };
    meta.ofType = meta;

    collector.addType(meta);
    collector.addCustomScalar(meta);

    return meta;
};

const SAMARIUM_SCALAR_TO_TS: Record<string, string> = {
    String: "string",
    Int: "number",
    Float: "number",
    Boolean: "boolean",
    ID: "string",
    Date: "Date",
    DateTime: "Date",
    DateTimeISO: "Date",
    Time: "Date",
    JSON: "Record<string, any>",
};

const applyNullable = (meta: TypeMeta, isNullable: boolean): TypeMeta => {
    if (!isNullable || meta.isNullable) return meta;
    return { ...meta, isNullable: true };
};

const typeMetaToTypescript = (meta: TypeMeta): string => {
    if (meta.scalarTSType) {
        let ts = meta.scalarTSType;
        if (meta.isList) {
            ts = `${"Array<".repeat(meta.isList)}${ts}${">".repeat(meta.isList)}`;
        }
        return ts;
    }
    const pure = meta.name.replaceAll("!", "").replaceAll("[", "").replaceAll("]", "");
    let ts =
        SAMARIUM_SCALAR_TO_TS[pure] ??
        (meta.isEnum
            ? meta.enumValues.map((e) => enumValueToTsLiteral(e.value !== undefined ? e.value : e.name)).join(" | ") ||
            pure
            : pure);
    if (meta.isList) {
        ts = `${"Array<".repeat(meta.isList)}${ts}${">".repeat(meta.isList)}`;
    }
    if (meta.isNonNull && meta.isNullable) {
        ts = `${ts} | null`;
    }
    return ts;
};

export const enumValueToTsLiteral = (value: unknown): string => {
    if (typeof value === "string") return JSON.stringify(value);
    if (value === null) return "null";
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(String(value));
};

const makeIdentifyingTypeName = (meta: TypeMeta, override?: { isInput?: boolean; isNonNull?: boolean }): string => {
    const isInput = override?.isInput ?? meta.isInput;
    const isNonNull = override?.isNonNull ?? meta.isNonNull;
    const identifyingTypeName = `${meta.name.slice(0, isInput && isNonNull ? -1 : undefined)}${isInput ? `${isNonNull ? "Input!" : "Input"}` : ""}`;
    return identifyingTypeName.replaceAll("-", "_");
};

const turnObjectIntoInput = (meta: TypeMeta, collector: Collector): TypeMeta => {
    if (meta.isInput || meta.isScalar) {
        return meta;
    }
    const identifyingTypeName = makeIdentifyingTypeName(meta, {
        isInput: true,
    });
    const asInput: TypeMeta = {
        ...meta,
        name: identifyingTypeName,
        isInput: true,
        isObject: false,
        inputFields: meta.fields.map((field) => ({
            ...field,
            location: "$",
            type: turnObjectIntoInput(field.type, collector),
        })),
        fields: [],
        possibleTypes: meta.possibleTypes.map((t) => turnObjectIntoInput(t, collector)),
    };
    // it's way cooler to have the Input type reference the type it came from
    // but for now, the generator needs this to be self-referenced,
    // it would be better to 'fix' the generator so we can have the Input type reference the type it came from
    // but that's for the future
    asInput.ofType = asInput;

    collector.addType(asInput);

    return asInput;
};

export const gatherMetaForType = (
    schema: OpenAPI3,
    name: string,
    _type:
        | ReferenceObject
        | SchemaObject
        | ParameterObject
        | ResponseObject
        | RequestBodyObject
        | HeaderObject
        | MediaTypeObject
        | TypeMeta,
    typeType: "schemas" | "parameters" | "responses" | "requestBodies" | "headers",
    options: {
        isNonNull: boolean;
        operationResponseType?: boolean;
    },
    collector: Collector,
): TypeMeta => {
    if ("ofType" in _type) {
        return _type;
    }

    if ("$ref" in _type) {
        const refpath = _type.$ref.split("/");
        refpath.shift(); // remove '#'

        const components = refpath.shift() as "components";
        const componentType = refpath.shift() as "schemas" | "parameters" | "responses" | "requestBodies" | "headers";
        const refname = refpath.shift() as string;

        const ref = schema[components]?.[componentType]?.[refname];

        if (ref) {
            return gatherMetaForType(
                schema,
                // if it is an operation response type, don't include the operationName in the name
                camelCaps([options.operationResponseType ? "" : name, refname]),
                ref,
                componentType,
                { isNonNull: options.isNonNull },
                collector,
            );
        }

        throw new Error(`Reference ${_type.$ref} not found`);
    }

    // OAS 3.1 query/header/cookie params may use `content` instead of `schema`.
    // Unwrap here so they classify as the inner schema (not as Input types).
    // Request bodies keep the isInput + content path below.
    const isParameterLike =
        ("in" in _type && typeof (_type as ParameterObject).in === "string") ||
        typeType === "parameters" ||
        typeType === "headers";
    if (
        isParameterLike &&
        "content" in _type &&
        !("schema" in _type) &&
        (_type as ParameterObject | HeaderObject).content
    ) {
        const mediaSchema = pickContentSchema((_type as ParameterObject | HeaderObject).content);
        if (mediaSchema) {
            return gatherMetaForType(
                schema,
                name,
                mediaSchema,
                "schemas",
                {
                    isNonNull: options.isNonNull,
                    operationResponseType: options.operationResponseType,
                },
                collector,
            );
        }
    }

    if ("schema" in _type) {
        const t = _type as MediaTypeObject;
        return gatherMetaForType(
            schema,
            name,
            t.schema!,
            "schemas",
            {
                isNonNull: options.isNonNull,
                operationResponseType: options.operationResponseType,
            },
            collector,
        );
    }

    const { schema: normalized, isNullable: schemaNullable } = normalizeOpenAPISchema(schema, _type);
    if (normalized && typeof normalized === "object" && "$ref" in normalized) {
        return applyNullable(
            gatherMetaForType(
                schema,
                name,
                normalized,
                typeType,
                {
                    isNonNull: options.isNonNull,
                    operationResponseType: options.operationResponseType,
                },
                collector,
            ),
            schemaNullable,
        );
    }

    const type = normalized as OpenAPISchemaNode;

    const isObjectType =
        type.type === "object" ||
        (!!(type as { properties?: unknown }).properties && type.type !== "array" && !type.oneOf && !type.anyOf);

    let meta: TypeMeta = {
        name: options.operationResponseType ? name : options.isNonNull ? `${name}!` : name,

        description: type.description,

        isObject: isObjectType,
        fields: [],

        isUnion: !!type.oneOf || !!type.anyOf,
        possibleTypes: [],

        isList: 0,
        isNonNull: options.isNonNull,
        isScalar: false,
        scalarTSType: undefined,

        isEnum: !!type.enum,

        enumValues: [],

        isInput: typeType === "parameters" || typeType === "headers" || typeType === "requestBodies",
        inputFields: [],

        ofType: undefined,
    };
    meta.isScalar = !meta.isObject && !meta.isUnion && !meta.isEnum && !meta.isInput;

    const identifyingTypeName = makeIdentifyingTypeName(meta);
    // Handle already processed types
    if (collector.hasType(identifyingTypeName)) {
        return applyNullable(collector.getType(identifyingTypeName), schemaNullable);
    } else {
        meta.name = identifyingTypeName;
        collector.addType(meta);
    }

    meta.ofType = meta;

    // Handle enum types
    if (meta.isEnum) {
        const t = type as SchemaObject;
        // Gather meta for each enum value
        for (const enumValue of [...(t.enum ?? [])]) {
            meta.enumValues.push({
                name: String(enumValue as any),
                description: type.description,
                type: gatherMetaForType(schema, name, type, typeType, { isNonNull: options.isNonNull }, collector),
                value: enumValue as string | number | boolean | null,
            });
        }
    }

    // Handle input types
    if (meta.isInput) {
        // Gather meta for each input field
        const _t = type as ParameterObject | RequestBodyObject | HeaderObject;

        // handle RequestBodyObject
        if ("content" in _t) {
            const t = _t as RequestBodyObject;
            for (const [contentType, value] of Object.entries(t.content ?? {})) {
                collector.removeType(identifyingTypeName);

                const bodyType = turnObjectIntoInput(
                    gatherMetaForType(
                        schema,
                        name,
                        // camelCaps([name, "Input"]),
                        value,
                        typeType,
                        {
                            isNonNull: t.required ?? false,
                        },
                        collector,
                    ),
                    collector,
                );
                if (bodyType.fields.length === 1 && !!bodyType.fields[0].type.scalarTSType) {
                    collector.removeType(identifyingTypeName);
                    meta = bodyType.fields[0].type;
                    collector.addType(meta);
                    return applyNullable(meta, schemaNullable);
                } else {
                    collector.removeType(identifyingTypeName);
                    meta = bodyType;
                    collector.addType(meta);
                    return applyNullable(meta, schemaNullable);
                }
            }
        }

        // handle ParameterObject
        if ("schema" in _t && "in" in _t) {
            const t = _t as ParameterObject;
            if (t.schema) {
                meta.inputFields.push(
                    gatherMetaForParameter(
                        schema,
                        t.name,
                        t.schema,
                        typeType as "parameters" | "requestBodies" | "headers",
                        t.in,
                        { isNonNull: t.required ?? false },
                        collector,
                    ),
                );
            } else {
                meta.inputFields.push(
                    gatherMetaForParameter(
                        schema,
                        t.name,
                        gatherMetaForType(
                            schema,
                            camelCaps([name, "Input", t.name]),
                            t.content!["application/json"],
                            typeType,
                            {
                                isNonNull: t.required ?? false,
                            },
                            collector,
                        ),
                        typeType as "parameters" | "requestBodies" | "headers",
                        t.in,
                        { isNonNull: t.required ?? false },
                        collector,
                    ),
                );
            }
        }

        // handle HeaderObject
        if ("schema" in _t && !("in" in _t)) {
            const t = _t as HeaderObject;
            if (t.schema) {
                meta.inputFields.push(
                    gatherMetaForParameter(
                        schema,
                        camelCaps([name, "Header"]),
                        t.schema,
                        typeType as "parameters" | "requestBodies" | "headers",
                        "header",
                        { isNonNull: t.required ?? false },
                        collector,
                    ),
                );
            } else {
                meta.inputFields.push(
                    gatherMetaForParameter(
                        schema,
                        camelCaps([name, "Header"]),
                        gatherMetaForType(
                            schema,
                            camelCaps([name, "Input", "Header"]),
                            t.content!["application/json"],
                            typeType,
                            {
                                isNonNull: t.required ?? false,
                            },
                            collector,
                        ),
                        typeType as "parameters" | "requestBodies" | "headers",
                        "header",
                        { isNonNull: t.required ?? false },
                        collector,
                    ),
                );
            }
        }
    }

    // Handle object types
    if (meta.isObject) {
        const t = type as ObjectSubtype;
        const propCount = Object.keys(t.properties ?? {}).length;
        if (
            propCount === 0 &&
            (t.additionalProperties === true || JSON.stringify(t.additionalProperties) === JSON.stringify({}))
        ) {
            collector.removeType(identifyingTypeName);
            meta.isObject = false;
            meta.isScalar = true;
            meta.name = options.isNonNull ? "JSON!" : "JSON";
            meta.name = makeIdentifyingTypeName(meta);
            collector.addType(meta);
            return applyNullable(meta, schemaNullable);
        }

        // Gather meta for each field
        const fields = t.properties;
        for (const [key, value] of Object.entries(fields ?? {})) {
            const isRefObject = ("$ref" in value) as unknown as ReferenceObject;

            collector.removeType(camelCaps([name, key]));

            const valueTypeMeta = gatherMetaForType(
                schema,
                camelCaps([name, key]),
                value,
                typeType,
                { isNonNull: t.required?.includes(key) ?? false },
                collector,
            );
            // we could either always use the above typeMeta with a camelCaps([name, key]) name
            // for the type of the property and therefore do the gatherMetaForField logic here,
            // thus deleting the gaterMetaForField method, or we only do this to check if it is a scalar
            // and otherwise, for example in case of an enum the type will have name of the property key
            // this makes the names shorter.

            const fieldMeta = gatherMetaForField(
                schema,
                key,
                valueTypeMeta,
                { isNonNull: t.required?.includes(key) ?? false },
                collector,
            );
            meta.fields.push(fieldMeta);
        }

        let additionalFieldsType: TypeMeta | undefined;
        const additionalFields = t.additionalProperties;
        if (additionalFields === true || JSON.stringify(additionalFields) === JSON.stringify({})) {
            additionalFieldsType = createACustomScalarType(
                camelCaps([name, "AdditionalProperties"]),
                "Additional properties",
                "Record<string, any>",
                collector,
            );

            meta.fields.push({
                name: camelCaps([name, "Any"]),
                description: "Additional properties",
                type: additionalFieldsType,
            });
        } else if (typeof additionalFields === "object") {
            if ("type" in additionalFields && additionalFields.type === "string") {
                additionalFieldsType = createACustomScalarType(
                    camelCaps([name, "AdditionalProperties"]),
                    "Additional properties",
                    "Record<string, string>",
                    collector,
                );

                meta.fields.push({
                    name: camelCaps([name, "AdditionalProperties"]),
                    description: "Additional properties",
                    type: additionalFieldsType,
                });
            } else {
                const isRefObject = ("$ref" in additionalFields) as unknown as ReferenceObject;

                const valueTypeMeta = gatherMetaForType(
                    schema,
                    isRefObject ? "" : camelCaps([name, "AdditionalProperties"]),
                    additionalFields,
                    typeType,
                    { isNonNull: false },
                    collector,
                );

                let typescriptConformTypeOfRefWithoutArray = valueTypeMeta.name
                    .replaceAll("!", "")
                    .replaceAll("[", "")
                    .replaceAll("]", "");

                typescriptConformTypeOfRefWithoutArray =
                    {
                        Int: "number",
                        Float: "number",
                        String: "string",
                        Boolean: "boolean",
                    }[typescriptConformTypeOfRefWithoutArray] ?? typescriptConformTypeOfRefWithoutArray;

                let typescriptConformTypeOfRef =
                    typescriptConformTypeOfRefWithoutArray +
                    (valueTypeMeta.isList
                        ? Array.from({ length: valueTypeMeta.isList })
                            .map((_) => "[]")
                            .join("")
                        : "");

                if (valueTypeMeta.isScalar && valueTypeMeta.scalarTSType) {
                    additionalFieldsType = valueTypeMeta;
                    meta.fields.push({
                        name: camelCaps([name, typescriptConformTypeOfRefWithoutArray]),
                        description: "Additional properties",
                        type: additionalFieldsType,
                    });
                } else {
                    additionalFieldsType = createACustomScalarType(
                        camelCaps([name, typescriptConformTypeOfRefWithoutArray]),
                        "Additional properties",
                        `Record<string, ${typescriptConformTypeOfRef}>`,
                        collector,
                    );
                    meta.fields.push({
                        name: camelCaps([name, typescriptConformTypeOfRefWithoutArray]),
                        description: "Additional properties",
                        type: additionalFieldsType,
                    });
                }
            }
        }

        if (additionalFieldsType && meta.fields.length === 1) {
            collector.removeType(identifyingTypeName);
            collector.addType(additionalFieldsType);
            return applyNullable(additionalFieldsType, schemaNullable);
        }
    }

    // Handle union types
    if (meta.isUnion) {
        // Gather meta for each possible type
        let i = 0;
        for (const possibleType of [
            ...((type as SchemaObject).oneOf ?? []),
            ...((type as SchemaObject).anyOf ?? []),
            ...((type as SchemaObject).allOf ?? []),
        ]) {
            i++;
            collector.removeType(identifyingTypeName);
            const isRefObject = ("$ref" in possibleType) as unknown as ReferenceObject;

            meta.possibleTypes.push(
                gatherMetaForType(
                    schema,
                    // if it is a ref object, we need to use the name of the ref object
                    isRefObject ? "" : `${name}Subtype${i}`,
                    possibleType as ReferenceObject | SchemaObject,
                    typeType,
                    { isNonNull: options.isNonNull },
                    collector,
                ),
            );
        }

        if (meta.possibleTypes.length === 1) {
            const onlyType = meta.possibleTypes[0];
            meta = {
                ...onlyType,
                isList: meta.isList,
                ofType: onlyType,
                name: meta.name,
            };
        }
    }

    if (meta.isScalar) {
        const t = type as OpenAPISchemaNode;
        // the name added up until now can in no way be the final name, because
        // it will either be something not existing and having it in the collector
        // will prevent it from being collected in the next step
        // or it will not reflect the final name anyways because we will add the
        // array brackets to the name
        // however, there are schemas that have direct self-referencing array-types,
        // so we will need to check if $ref in items is the same as the name of the current type
        // and if so, we will not remove the type from the collector

        if (isTupleSchema(t)) {
            collector.removeType(identifyingTypeName);

            const elements = (t.prefixItems ?? []).map((item, i) => {
                const itemSchema = item as OpenAPISchemaNode | ReferenceObject;
                const title =
                    itemSchema && typeof itemSchema === "object" && !("$ref" in itemSchema)
                        ? (itemSchema as OpenAPISchemaNode).title
                        : undefined;
                const elMeta = gatherMetaForType(
                    schema,
                    title ? camelCaps([name, title]) : camelCaps([name, `El${i}`]),
                    item,
                    "schemas",
                    { isNonNull: true },
                    collector,
                );
                const elTs = typeMetaToTypescript(elMeta);
                return title ? `${title}: ${elTs}` : elTs;
            });

            const restItems: unknown = (t as { items?: unknown }).items;
            let tupleTS = `[${elements.join(", ")}]`;
            if (restItems && restItems !== false && typeof restItems === "object") {
                const restMeta = gatherMetaForType(
                    schema,
                    camelCaps([name, "Rest"]),
                    restItems as ReferenceObject | SchemaObject,
                    "schemas",
                    { isNonNull: false },
                    collector,
                );
                tupleTS = `[${elements.join(", ")}, ...${typeMetaToTypescript(restMeta)}[]]`;
            }

            const tupleName = identifyingTypeName.replace(/!$/, "");
            meta = createACustomScalarType(tupleName, t.description, tupleTS, collector);
            meta.isNonNull = options.isNonNull;
            if (options.isNonNull && !meta.name.endsWith("!")) {
                meta = { ...meta, name: `${meta.name}!`, isNonNull: true };
                meta.ofType = meta;
            }
        } else if (t.type === "array") {
            const items = (t as ArraySubtype).items;
            const itemsIsObject = !!items && typeof items === "object";
            const isRefObject = itemsIsObject && "$ref" in items;

            if (
                !isRefObject ||
                (items as ReferenceObject).$ref !== `#/components/${typeType}/${identifyingTypeName}`
            ) {
                collector.removeType(identifyingTypeName);
            }

            if (!itemsIsObject) {
                const unknownArr = createACustomScalarType(
                    identifyingTypeName.replace(/!$/, ""),
                    t.description,
                    "unknown[]",
                    collector,
                );
                meta = unknownArr;
                meta.isNonNull = options.isNonNull;
            } else {
                meta.isList++;
                const arraymeta = gatherMetaForType(
                    schema,
                    isRefObject ? "" : name,
                    items as ReferenceObject | SchemaObject,
                    "schemas",
                    { isNonNull: options.isNonNull },
                    collector,
                );

                const depth = (meta.isList += arraymeta?.isList ?? 0);
                meta = { ...arraymeta, isList: depth, name: `[${arraymeta.name}]` };
                meta.ofType = meta;
            }
        } else {
            const tsOverride = parseTypescriptTypeFromSchema(t);
            const mappedName = mapJsonSchemaTypeToSamariumScalar(t);

            collector.removeType(identifyingTypeName);

            if (tsOverride) {
                const typedefToSamarium: Record<string, string> = {
                    string: "String",
                    number: "Float",
                    boolean: "Boolean",
                    ...Object.fromEntries(Object.keys(SAMARIUM_SCALAR_TO_TS).map((k) => [k, k])),
                };
                const knownScalar = typedefToSamarium[tsOverride];
                if (knownScalar) {
                    meta.name = knownScalar;
                } else {
                    const scalarName = identifyingTypeName.replace(/!$/, "");
                    meta.scalarTSType = tsOverride;
                    meta.name = scalarName;
                    meta.ofType = meta;
                    collector.addCustomScalar(meta);
                }
            } else if (mappedName) {
                meta.name = mappedName;
            } else if (typeof t.type === "string") {
                meta.name = camelCaps([t.type]);
            }
        }

        if (options.isNonNull && !meta.name.endsWith("!")) {
            collector.removeType(identifyingTypeName);

            meta.name = `${meta.name}!`;
        }

        meta.name = makeIdentifyingTypeName(meta);
    }

    collector.addType(meta);

    return applyNullable(meta, schemaNullable);
};

export const gatherMetaForParameter = (
    schema: OpenAPI3,
    name: string,
    type:
        | ReferenceObject
        | SchemaObject
        | ParameterObject
        | ResponseObject
        | RequestBodyObject
        | HeaderObject
        | TypeMeta,
    typeType: "parameters" | "headers" | "requestBodies",
    location: "query" | "path" | "header" | "cookie" | "body",
    options: {
        isNonNull: boolean;
    },
    collector: Collector,
): ParameterMeta => {
    return {
        name,
        description: type.description,
        location,
        type: gatherMetaForType(schema, name, type, typeType, options, collector),
    };
};

export const gatherMetaForField = (
    schema: OpenAPI3,
    name: string,
    type:
        | ReferenceObject
        | SchemaObject
        | ParameterObject
        | ResponseObject
        | RequestBodyObject
        | HeaderObject
        | TypeMeta,
    options: {
        isNonNull: boolean;
    },
    collector: Collector,
): FieldMeta => {
    return {
        name,
        description: type.description,
        type: gatherMetaForType(schema, name, type, "schemas", options, collector),
    };
};

const methodToVerbs = {
    get: "Get",
    post: "Create",
    put: "Update",
    delete: "Delete",
    patch: "Patch",
    options: "Options",
    head: "Head",
    trace: "Trace",
} as const;
/**
 * Gather metadata about a GraphQL field in one of the operations (query, mutation, subscription).
 * @param schema GraphQL schema
 * @param rootField GraphQL field
 * @param operation Operation type
 * @param options Codegen options
 * @returns
 */
export const gatherMetaForPathOperation = (
    schema: OpenAPI3,
    path: string,
    method: "get" | "post" | "put" | "delete" | "patch" | "options" | "head" | "trace",
    operation: OperationObject,
    options: CodegenOptions,
    collector: Collector,
): OperationMeta | undefined => {
    if (!operation.responses) {
        console.warn("Operation has no responses!");
        return undefined;
    }

    const okResponses = Object.entries(operation.responses)
        .filter(([statusCode, _]) => statusCode.toString().startsWith("2"))
        .sort(([codeA, _], [codeB, __]) => +codeA - +codeB);
    const successResponse = okResponses.length > 0 ? okResponses[0][1] : operation.responses.default;

    const errorResponses = Object.entries(operation.responses).filter(
        ([statusCode, _]) => statusCode.toString().startsWith("4") || statusCode.toString().startsWith("5"),
    );

    if (!successResponse) {
        console.warn("Operation has no success response!", operation);
        return undefined;
    }

    const operationName =
        operation.operationId?.replaceAll(".", "_").replaceAll("/", "_").replaceAll("-", "_") ??
        // TODO: the following fallback is bad, needs more logic
        camelCaps(
            [
                methodToVerbs[method],
                ...path
                    .split("/")
                    // remove curly braces and use the param name like 'By{Param}'
                    .flatMap((p) =>
                        [p.includes("{") ? "By" : "", p.replace(/{([^}]+)}/g, "$1")].filter((s) => s.length > 0),
                    ),
            ],
            "",
        );

    // Prefer text/event-stream when present (OpenAPI SSE), else application/json, else first content type
    let responseContentType: string | undefined;
    let responseMedia: MediaTypeObject | ReferenceObject | undefined;
    let isEventStream = false;
    if ("content" in successResponse && successResponse.content) {
        const content = successResponse.content;
        if (content["text/event-stream"]) {
            responseContentType = "text/event-stream";
            responseMedia = content["text/event-stream"];
            isEventStream = true;
        } else if (content["application/json"]) {
            responseContentType = "application/json";
            responseMedia = content["application/json"];
        } else {
            const first = Object.entries(content).find(([_, value]) => value);
            if (first) {
                responseContentType = first[0];
                responseMedia = first[1];
                isEventStream = first[0] === "text/event-stream";
            }
        }
    }

    const meta: OperationMeta = {
        name: operationName,
        description: operation.description,
        path,
        method,
        args: [],
        isEventStream,
        responseContentType,
        type: gatherMetaForType(
            schema,
            operationName,
            "content" in successResponse
                ? (responseMedia as MediaTypeObject | ReferenceObject)
                : (successResponse as ReferenceObject),
            "responses",
            { isNonNull: false, operationResponseType: true },
            collector,
        ),
    };

    // Gather meta for each argument, first from parameters
    for (const arg of operation.parameters ?? ([] as (ReferenceObject | ParameterObject)[])) {
        const name = "$ref" in arg ? arg.$ref.split("/").pop() : arg.name;
        const rawLocation =
            "in" in arg ? arg.in : (arg.$ref.split("/").at(-2)! as "parameters" | "requestBodies" | "headers");
        const location = (
            {
                parameters: "query",
                requestBodies: "body",
                headers: "header",
                cookie: "cookie",
                path: "path",
                query: "query",
                header: "header",
            } as const
        )[rawLocation];

        meta.args.push(
            gatherMetaForParameter(
                schema,
                name!,
                arg,
                "parameters",
                location,
                {
                    isNonNull: "$ref" in arg ? false : (arg.required ?? false),
                },
                collector,
            ),
        );
    }

    // then from requestBody
    if (operation.requestBody) {
        const t = operation.requestBody as RequestBodyObject;
        const body = gatherMetaForParameter(
            schema,
            `${operationName}RequestBody`,
            t,
            "requestBodies",
            "body",
            {
                isNonNull: t.required ?? false,
            },
            collector,
        );
        body.name = "$";
        meta.args.push(body);
    }

    return meta;
};
