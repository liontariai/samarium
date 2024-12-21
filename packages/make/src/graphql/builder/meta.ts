/*
 * This file contains functions for gathering metadata about GraphQL types, fields, and arguments.
 * This metadata is used to generate the query builder.
 */

import {
    type GraphQLArgument,
    GraphQLEnumType,
    type GraphQLField,
    GraphQLInputObjectType,
    GraphQLInterfaceType,
    GraphQLObjectType,
    GraphQLScalarType,
    type GraphQLSchema,
    type GraphQLType,
    GraphQLUnionType,
    getNamedType,
    isObjectType,
    isInterfaceType,
    type GraphQLDirective,
    type DirectiveLocation,
    isInputObjectType,
} from "graphql";
import { Collector } from "./collector";

import {
    type ArgumentMeta,
    type FieldMeta,
    Operation,
    type RootFieldMeta,
    type SchemaMeta,
    type TypeMeta,
    type CodegenOptions,
    type DirectiveMeta,
} from "../types/meta";
export {
    type ArgumentMeta,
    type FieldMeta,
    Operation,
    type RootFieldMeta,
    type SchemaMeta,
    type TypeMeta,
    type CodegenOptions,
};

const createACustomScalarType = (
    name: string,
    description: string | undefined,
    scalarTSType: string,
    collector: Collector<any, any, any>,
): TypeMeta => {
    const descriptionIncludesTypedef = description?.includes("@typedef");
    const typeFromTypedef = descriptionIncludesTypedef
        ? description?.match(/@typedef\s*{(.*)}/)?.[1]
        : undefined;

    const meta: TypeMeta = {
        name,
        description,
        isScalar: true,
        scalarTSType: typeFromTypedef ?? scalarTSType,
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

        isInterface: false,
        isQuery: false,
        isMutation: false,
        isSubscription: false,
    };
    meta.ofType = meta;

    collector.addType(meta);
    collector.addCustomScalar(meta);

    return meta;
};

/**
 * Gather metadata about the schema.
 * @param schema GraphQL schema
 * @param options Codegen options
 * @returns
 */
export const gatherMeta = (
    schema: GraphQLSchema,
    options: CodegenOptions,
    collector: Collector,
): SchemaMeta => {
    const meta: SchemaMeta = {
        types: [],
        directives: [],

        query: [],
        mutation: [],
        subscription: [],
    };

    // Gather meta for each type
    for (const typeName in schema.getTypeMap()) {
        if (!options.includeSchemaDefinition) {
            if (
                [
                    "__Schema",
                    "__Type",
                    "__TypeKind",
                    "__Field",
                    "__InputValue",
                    "__EnumValue",
                    "__Directive",
                ].includes(typeName)
            ) {
                continue;
            }
        }
        const type = schema.getTypeMap()[typeName];
        if (type instanceof GraphQLScalarType) {
            if (
                [
                    "String",
                    "Int",
                    "Float",
                    "Boolean",
                    "ID",
                    "Date",
                    "DateTime",
                    "DateTimeISO",
                    "Time",
                    "JSON",
                ].includes(typeName)
            ) {
                continue;
            }
            meta.types.push(
                createACustomScalarType(
                    typeName,
                    type.description ?? undefined,
                    "any",
                    collector,
                ),
            );
        }
    }

    const queryType = schema.getQueryType();
    if (queryType) {
        for (let field of Object.values(queryType.getFields())) {
            // if(!["_service"].includes(field.name)){
            meta.query.push(
                gatherMetaForRootField(
                    schema,
                    field,
                    Operation.Query,
                    options,
                    collector,
                ),
            );
            // }
        }
    }

    const mutationType = schema.getMutationType();
    if (mutationType) {
        for (let field of Object.values(mutationType.getFields())) {
            meta.mutation.push(
                gatherMetaForRootField(
                    schema,
                    field,
                    Operation.Mutation,
                    options,
                    collector,
                ),
            );
        }
    }

    const subscriptionType = schema.getSubscriptionType();
    if (subscriptionType) {
        for (let field of Object.values(subscriptionType.getFields())) {
            meta.subscription.push(
                gatherMetaForRootField(
                    schema,
                    field,
                    Operation.Subscription,
                    options,
                    collector,
                ),
            );
        }
    }

    // Gather meta for each type
    for (const typeName in schema.getTypeMap()) {
        if (!options.includeSchemaDefinition) {
            if (
                [
                    "__Schema",
                    "__Type",
                    "__TypeKind",
                    "__Field",
                    "__InputValue",
                    "__EnumValue",
                    "__Directive",
                ].includes(typeName)
            ) {
                continue;
            }
        }

        const type = schema.getTypeMap()[typeName];
        if (
            isObjectType(type) ||
            isInputObjectType(type) ||
            isInterfaceType(type)
        ) {
            meta.types.push(
                gatherMetaForType(schema, type, options, collector),
            );
        }
    }

    // Gather meta for each directive
    for (const directive of schema.getDirectives()) {
        meta.directives.push(
            gatherMetaForDirective(schema, directive, options, collector),
        );
    }

    return meta;
};

/**
 * Gather metadata about a GraphQL field in one of the operations (query, mutation, subscription).
 * @param schema GraphQL schema
 * @param rootField GraphQL field
 * @param operation Operation type
 * @param options Codegen options
 * @returns
 */
export const gatherMetaForRootField = (
    schema: GraphQLSchema,
    rootField: GraphQLField<any, any>,
    operation: Operation,
    options: CodegenOptions,
    collector: Collector,
): RootFieldMeta => {
    const meta: RootFieldMeta = {
        name: rootField.name,
        description: rootField.description ?? undefined,
        operation,
        args: [],
        type: gatherMetaForType(schema, rootField.type, options, collector),
    };

    // Gather meta for each argument
    for (const argName in rootField.args) {
        const arg = rootField.args[argName];
        meta.args.push(gatherMetaForArgument(schema, arg, options, collector));
    }

    return meta;
};

/**
 * Gather metadata about a GraphQL argument.
 * @param schema GraphQL schema
 * @param arg GraphQL argument
 * @param options Codegen options
 * @returns
 */
export const gatherMetaForArgument = (
    schema: GraphQLSchema,
    arg: GraphQLArgument,
    options: CodegenOptions,
    collector: Collector,
): ArgumentMeta => {
    return {
        name: arg.name,
        // TODO: remove hack
        hasArgs: false,
        args: [],
        description: arg.description ?? undefined,
        type: gatherMetaForType(schema, arg.type, options, collector),
    };
};

/**
 * Gather metadata about a GraphQL type.
 * @param schema GraphQL schema
 * @param type GraphQL type
 * @param options Codegen options
 * @returns
 */
export const gatherMetaForType = (
    schema: GraphQLSchema,
    type: GraphQLType,
    options: CodegenOptions,
    collector: Collector,
): TypeMeta => {
    const namedType = getNamedType(type);

    const meta: TypeMeta = {
        name: type.toString(),
        description: namedType.description ?? undefined,
        isList: type.toString().split("[").length - 1,
        isNonNull: type.toString().endsWith("!"),
        isScalar: namedType instanceof GraphQLScalarType,
        isEnum: namedType instanceof GraphQLEnumType,
        isInput: namedType instanceof GraphQLInputObjectType,
        isInterface: namedType instanceof GraphQLInterfaceType,
        isObject: namedType instanceof GraphQLObjectType,
        isUnion: namedType instanceof GraphQLUnionType,
        isQuery: false,
        isMutation: false,
        isSubscription: false,
        fields: [],
        possibleTypes: [],
        enumValues: [],
        inputFields: [],
    };

    // Handle already processed types
    if (collector.hasType(meta.name)) {
        return collector.getType(meta.name);
    } else {
        collector.addType(meta);
    }

    meta.ofType = meta;

    // Handle enum types
    if (meta.isEnum) {
        // Gather meta for each enum value
        for (const enumValue of (namedType as GraphQLEnumType).getValues()) {
            meta.enumValues.push({
                name: enumValue.name,
                description: enumValue.description ?? undefined,
            });
        }
    }

    // Handle input types
    if (meta.isInput) {
        // Gather meta for each input field
        const fields = (namedType as GraphQLInputObjectType).getFields();
        for (const inputField in fields) {
            meta.inputFields.push(
                gatherMetaForArgument(
                    schema,
                    fields[inputField],
                    options,
                    collector,
                ),
            );
        }
    }

    // Handle interface types
    if (meta.isInterface) {
        // Gather meta for each field
        const fields = (
            namedType as GraphQLInterfaceType | GraphQLObjectType
        ).getFields();
        for (const field in fields) {
            meta.fields.push(
                gatherMetaForField(schema, fields[field], options, collector),
            );
        }
    }

    // Handle object types
    if (meta.isObject) {
        // Gather meta for each field
        const fields = (
            namedType as GraphQLInterfaceType | GraphQLObjectType
        ).getFields();
        for (const field in fields) {
            meta.fields.push(
                gatherMetaForField(schema, fields[field], options, collector),
            );
        }
    }

    // Handle union types
    if (meta.isUnion) {
        // Gather meta for each possible type
        for (const possibleType of (namedType as GraphQLUnionType).getTypes()) {
            meta.possibleTypes.push(
                gatherMetaForType(schema, possibleType, options, collector),
            );
        }
    }

    // Handle operation types
    if (namedType instanceof GraphQLObjectType) {
        if (namedType.name === "Query") {
            meta.isQuery = true;
        } else if (namedType.name === "Mutation") {
            meta.isMutation = true;
        } else if (namedType.name === "Subscription") {
            meta.isSubscription = true;
        }
    }

    collector.addType(meta);

    return meta;
};

/**
 * Gather metadata about a GraphQL field.
 * @param schema GraphQL schema
 * @param field GraphQL field
 * @param options Codegen options
 * @returns
 */
export const gatherMetaForField = (
    schema: GraphQLSchema,
    field: GraphQLField<any, any>,
    options: CodegenOptions,
    collector: Collector,
): FieldMeta => {
    const meta: FieldMeta = {
        name: field.name,
        description: field.description ?? undefined,
        hasArgs: Object.keys(field.args).length > 0,
        args: [],
        type: gatherMetaForType(schema, field.type, options, collector),
    };

    // Gather meta for each argument
    for (const argName in field.args) {
        const arg = field.args[argName];
        meta.args.push(gatherMetaForArgument(schema, arg, options, collector));
    }

    return meta;
};

/**
 * Gather metadata about a GraphQL directive.
 * @param schema GraphQL schema
 * @param directive GraphQL directive
 * @param options Codegen options
 * @returns
 */
export const gatherMetaForDirective = (
    schema: GraphQLSchema,
    directive: GraphQLDirective,
    options: CodegenOptions,
    collector: Collector,
): DirectiveMeta => {
    const meta: DirectiveMeta = {
        name: directive.name,
        description: directive.description ?? undefined,
        locations: directive.locations as DirectiveLocation[],
        args: [],
    };

    // Gather meta for each argument
    for (const argName in directive.args) {
        const arg = directive.args[argName];
        meta.args.push(gatherMetaForArgument(schema, arg, options, collector));
    }

    collector.addType({
        name: `Directive_${directive.name}`,
        description: directive.description ?? undefined,
        isList: 0,
        isNonNull: false,
        isScalar: false,
        isEnum: false,
        isInput: false,
        isInterface: false,
        isObject: false,
        isUnion: false,
        isQuery: false,
        isMutation: false,
        isSubscription: false,
        fields: [],
        possibleTypes: [],
        enumValues: [],
        inputFields: [],

        isDirective: meta,
    });

    return meta;
};
