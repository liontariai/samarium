import prettier from "prettier";
import { GraphQLSchema } from "graphql";
import { type CodegenOptions, gatherMeta } from "./meta";
import { Collector } from "./collector";

import type { GeneratorSelectionTypeFlavorDefault } from "../flavors/default/generator-flavor";

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
        schema: GraphQLSchema;
        options: CodegenOptions;
        authConfig?: {
            headerName: string;
        };
    }): Promise<string> {
        const QueryTypeName = schema.getQueryType()?.name;
        const MutationTypeName = schema.getMutationType()?.name;
        const SubscriptionTypeName = schema.getSubscriptionType()?.name;

        const collector = new Collector(
            QueryTypeName,
            MutationTypeName,
            SubscriptionTypeName,
        );
        gatherMeta(schema, options, collector);

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

        const code = [
            this.Codegen.FieldValueWrapperType,
            this.Codegen.HelperTypes,
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
                .filter(([type]) => !type.isScalar && !type.isEnum)
                .map(([_, code]) => code)
                .filter((code, index, arr) => arr.indexOf(code) === index),
            ...[...collector.selectionFunctions.entries()]
                .filter(
                    ([type]) => !type.isScalar && !type.isEnum && !type.isInput,
                )
                .map(([_, code]) => code),
            this.Codegen.makeRootOperationFunction(collector, authConfig),
        ].join("\n");

        const prettyCode = await prettier.format(code, {
            tabWidth: 4,
            parser: "typescript",
        });

        return prettyCode;
    }
}
