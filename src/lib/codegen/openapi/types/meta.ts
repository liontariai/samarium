import type { OpenAPI3 } from "openapi-typescript";

export type CodegenOptions = {};

export interface SchemaMeta {
    types: TypeMeta[];
    operations: OperationMeta[];
    customScalars: TypeMeta[];
}

export type OperationMethod =
    | "get"
    | "post"
    | "put"
    | "delete"
    | "patch"
    | "options"
    | "head"
    | "trace";
export interface OperationMeta {
    name: string;
    description: string | undefined;
    path: string;
    method: OperationMethod;
    args: ParameterMeta[];
    type: TypeMeta;
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
