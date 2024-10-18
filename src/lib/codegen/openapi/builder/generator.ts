import { DirectiveLocation, GraphQLSchema } from "graphql";
import { type CodegenOptions, gatherMeta } from "./meta";
import { Collector } from "./collector";

import type { GeneratorSelectionTypeFlavorDefault } from "../default/generator-flavor";
import type { OpenAPI3 } from "openapi-typescript";

/**
 * Class with methods to traverse a given Schema and generate the query builder's code.
 */
export class Generator {
    constructor(
        public readonly Codegen: typeof GeneratorSelectionTypeFlavorDefault,
    ) {}

    /**
     * Generate the query builder's code.
     * @param schema GraphQL schema
     * @param options Codegen options
     * @returns
     */
    public async generate({
        schema,
        options,
        authConfig,
    }: {
        schema: OpenAPI3;
        options: CodegenOptions;
        authConfig?: {
            headerName: string;
        };
    }): Promise<string> {
        const collector = new Collector();
        const schemaMeta = gatherMeta(schema, options, collector);

        // Generate selection types
        // Generate & collect Enum first, so that they can be used in the selection types
        for (const [typeName, typeMeta] of collector.types.entries()) {
            if (!typeMeta.isEnum) continue;
            new this.Codegen(typeName, collector, options).makeEnumType();
        }
        // Generate & collect Input first, so that they can be used in the selection types
        for (const [typeName, typeMeta] of collector.types.entries()) {
            if (!typeMeta.isInput) continue;
            new this.Codegen(typeName, collector, options).makeSelectionType();
        }

        // Generate selection types for all types
        for (const [typeName, typeMeta] of collector.types.entries()) {
            if (typeMeta.isScalar || typeMeta.isInput || typeMeta.isEnum)
                continue;

            new this.Codegen(typeName, collector, options).makeSelectionType();
            new this.Codegen(
                typeName,
                collector,
                options,
            ).makeSelectionFunction();
        }

        // this also collects argument types and argument meta
        const rootOperationFunction = this.Codegen.makeRootOperationFunction(
            schemaMeta.operations,
            collector,
            options,
            authConfig,
        );

        const code = [
            this.Codegen.FieldValueWrapperType,
            this.Codegen.HelperTypes(
                Array.from(collector.customScalars.values()),
            ),
            this.Codegen.HelperFunctions,
            ...[...collector.enumsTypes.entries()]
                .map(([_, code]) => code)
                .filter((code, index, arr) => arr.indexOf(code) === index),
            ...[...collector.argumentTypes.entries()]
                .map(([_, code]) => code)
                .filter((code, index, arr) => arr.indexOf(code) === index),
            ...[...collector.argumentMeta.entries()]
                .map(([_, code]) => code)
                .filter((code, index, arr) => arr.indexOf(code) === index),
            ...[...collector.selectionTypes.entries()]
                .filter(
                    ([type]) =>
                        !type.isScalar &&
                        !type.isEnum &&
                        !(type.isScalar && type.isUnion),
                )
                .map(([_, code]) => code)
                .filter((code, index, arr) => arr.indexOf(code) === index),
            this.Codegen.EnumTypesMapped(collector),
            this.Codegen.UnionTypesMapped(collector),
            ...[...collector.selectionFunctions.entries()]
                .filter(
                    ([type]) =>
                        !type.isScalar &&
                        !type.isEnum &&
                        !type.isInput &&
                        !(type.isScalar && type.isUnion),
                )
                .map(([_, code]) => code)
                .filter((code) => !code.startsWith("new SelectionWrapper"))
                .filter((code, index, arr) => arr.indexOf(code) === index),
            rootOperationFunction,
        ].join("\n");

        return code;
    }
}
