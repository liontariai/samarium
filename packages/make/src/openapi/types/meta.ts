export type CodegenOptions = {};

/**
 * How the generated SDK obtains its runtime (SelectionWrapper, RootOperation, …).
 *
 * - `"embedded"` (default): inlines the full runtime into the generated file (published SDKs).
 * - `"external"`: emits imports from a shared module instead — used by tests so traps/mocks
 *   observe the same class instances as the test suite.
 */
export type SdkRuntimeMode = "embedded" | "external";

export interface ExternalRuntimeConfig {
    /** e.g. `"@/openapi/flavors/default/wrapper"` */
    wrapperModule: string;
}

export interface SchemaMeta {
    types: TypeMeta[];
    operations: OperationMeta[];
    customScalars: TypeMeta[];
}

export type OperationMethod = "get" | "post" | "put" | "delete" | "patch" | "options" | "head" | "trace";
export interface OperationMeta {
    name: string;
    description: string | undefined;
    path: string;
    method: OperationMethod;
    args: ParameterMeta[];
    type: TypeMeta;
    /** True when success response content includes text/event-stream */
    isEventStream?: boolean;
    /** Response content-type used for the operation body/event payload type */
    responseContentType?: string;
}

export interface ParameterMeta {
    name: string;
    description: string | undefined;
    location: "path" | "query" | "header" | "cookie" | "body" | "$";
    type: TypeMeta;
}

export interface TypeMeta {
    name: string;
    description: string | undefined;
    isList: number;
    isNonNull: boolean;
    isScalar: boolean; // type with "format"
    scalarTSType?: string;

    isObject: boolean;
    fields: FieldMeta[];

    isUnion: boolean; // is anyOf / oneOf
    possibleTypes: TypeMeta[];

    isEnum: boolean;
    enumValues: EnumValueMeta[];

    isInput: boolean; // is used in post body somewhere
    inputFields: ParameterMeta[];

    ofType?: TypeMeta;
}

export interface FieldMeta {
    name: string;
    description: string | undefined;
    type: TypeMeta;
}

export interface EnumValueMeta {
    name: string;
    description: string | undefined;
    type: TypeMeta;
}
