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
    /** Request body content-type chosen for encoding (json / form / multipart / …) */
    requestContentType?: string;
}

/** OpenAPI 3 parameter `style` values (serialization). */
export type OpenAPIParameterStyle =
    | "matrix"
    | "label"
    | "form"
    | "simple"
    | "spaceDelimited"
    | "pipeDelimited"
    | "deepObject";

export interface ParameterMeta {
    name: string;
    description: string | undefined;
    location: "path" | "query" | "header" | "cookie" | "body" | "$";
    type: TypeMeta;
    /** OpenAPI `style` (form, simple, deepObject, …). */
    style?: OpenAPIParameterStyle;
    /** OpenAPI `explode`. */
    explode?: boolean;
    /** Media type when the parameter/body uses `content` instead of `schema`. */
    contentType?: string;
}

export interface TypeMeta {
    name: string;
    description: string | undefined;
    isList: number;
    isNonNull: boolean;
    /**
     * Schema-level nullability (`type: ["T","null"]`, `nullable: true`,
     * `anyOf`/`oneOf` with `{ type: "null" }`). Distinct from `isNonNull`
     * (OpenAPI `required`): required + nullable → `T | null`; optional +
     * nullable → `T?`.
     */
    isNullable?: boolean;
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
    /** Original enum/`const` value so mixed enums emit `"ok" | 1`, not `"ok" | "1"`. */
    value?: string | number | boolean | null;
}
