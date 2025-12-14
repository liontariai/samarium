import type { GraphQLSchema } from "graphql";
import type { Collector } from "./collector";
import type { CodegenOptions, FieldMeta, TypeMeta } from "./meta";

/**
 * Abstract class for selection type flavors.
 * A selection type flavor is a class that generates the code for a selection type.
 * A selection type is a way to select the fields of a GraphQL type via typescript code.
 */
export abstract class GeneratorSelectionTypeFlavor {
    /**
     * The code for the SelectionWrapper class.
     * The SelectionWrapper class is used to select a field of a GraphQL type.
     */
    public static readonly FieldValueWrapperType: string;

    /**
     * The code for the EnumTypesMapped interface.
     * The EnumTypesMapped interface is used to map the enum names used in SelectionWrapper to the actual enum types.
     */
    public static EnumTypesMapped: (collector: Collector) => string;

    /**
     * The code for the helper types.
     * The helper types are types that are used by the selection type flavor.
     */
    public static readonly HelperTypes: (customScalars: TypeMeta[]) => string;

    /**
     * The code for the helper functions.
     * The helper functions are functions that are used by the selection type flavor.
     */
    public static readonly HelperFunctions: string;

    /**
     * The metadata for the GraphQL type. Gathered from the schema.
     * @see gatherMeta for more information.
     * @see TypeMeta for more information.
     */
    protected typeMeta: TypeMeta;

    /**
     * The name of the GraphQL type.
     */
    protected typeName: string;

    /**
     * The original full name of the GraphQL type.
     */
    protected originalFullTypeName: string;

    constructor(
        typeName: string,
        protected readonly collector: Collector,
        protected readonly options: CodegenOptions,
        protected readonly authConfig?: {
            headerName: string;
        },
    ) {
        // Get the metadata for the GraphQL type using the collector and the full name of the GraphQL type.
        this.typeMeta = collector.getType(typeName);

        // Set the original full name of the GraphQL type.
        this.originalFullTypeName = typeName;
        // Set the name of the GraphQL type to a more typescript friendly name.
        this.typeName = this.originalTypeNameToTypescriptFriendlyName(typeName);
    }
    protected originalTypeNameToTypescriptFriendlyName(originalTypeName: string): string {
        return originalTypeName.replaceAll("[", "").replaceAll("]", "Array").replaceAll("!", "NotNull");
    }
    protected originalTypeNameToTypescriptTypeNameWithoutModifiers(
        originalTypeName: string,
        suffix: string = "",
    ): string {
        return `${originalTypeName.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}${suffix}`;
    }
    protected originalTypeNameToTypescriptTypeName(originalTypeName: string, suffix: string = ""): string {
        return `${this.originalTypeNameToTypescriptTypeNameWithoutModifiers(originalTypeName, suffix)}${Array.from({
            length: originalTypeName.split("[").length - 1,
        })
            .fill("[]")
            .join("")}`;
    }

    protected abstract makeSelectionTypeInputValueForFieldWrapperType(fieldName: string, fieldMeta: TypeMeta): string;
    protected abstract makeSelectionTypeInputValueForField(
        field: FieldMeta,
        parents: string[],
        parentIsInput: boolean,
    ): string;

    public abstract makeSelectionType(): string;

    protected abstract makeSelectionFunctionInputObjectValueForFieldWrapper(
        field: FieldMeta,
        parents: string[],
    ): string;
    protected abstract makeSelectionFunctionInputObjectValueForField(field: FieldMeta, parents: string[]): string;

    public abstract makeSelectionFunction(schema: GraphQLSchema): string;

    public static makeRootOperationFunction(collector: Collector): string {
        throw new Error("Method not implemented.");
    }
}
