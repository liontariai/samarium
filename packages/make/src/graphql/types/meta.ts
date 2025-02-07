import type { DirectiveLocation } from "graphql";

export enum Operation {
    Query = "query",
    Mutation = "mutation",
    Subscription = "subscription",
}
export interface CodegenOptions {
    /**
     * Whether to include the __typename field in queries.
     */
    includeTypename?: boolean;
    /**
     * Whether to include the __scalar and __type fields in queries.
     */
    includeSchemaDefinition?: boolean;
    /**
     * Whether to include the __typename field in queries.
     */
    includeIntrospection?: boolean;
}
export interface RootFieldMeta {
    name: string;
    description?: string;
    operation: Operation;
    args: ArgumentMeta[];
    type: TypeMeta;
}
export interface SchemaMeta {
    types: TypeMeta[];
    directives: DirectiveMeta[];

    query: RootFieldMeta[];
    mutation: RootFieldMeta[];
    subscription: RootFieldMeta[];
}

export interface FieldMeta {
    name: string;
    description?: string;
    hasArgs: boolean;
    args: ArgumentMeta[];
    type: TypeMeta;
}
export interface ArgumentMeta extends FieldMeta {
    name: string;
    // TOOO: remove hack
    hasArgs: false;
    args: [];
    description?: string;
    type: TypeMeta;
}
export interface EnumValueMeta {
    name: string;
    description?: string;
}
export interface TypeMeta {
    name: string;
    description?: string;
    isList: number;
    isNonNull: boolean;
    isScalar: boolean;
    scalarTSType?: string;
    isEnum: boolean;
    isInput: boolean;
    isInterface: boolean;
    isObject: boolean;
    isUnion: boolean;
    isQuery: boolean;
    isMutation: boolean;
    isSubscription: boolean;
    fields: FieldMeta[];
    possibleTypes: TypeMeta[];
    enumValues: EnumValueMeta[];
    inputFields: ArgumentMeta[];
    ofType?: TypeMeta;

    isDirective?: DirectiveMeta;
}

export interface DirectiveMeta {
    name: string;
    description?: string;
    locations: DirectiveLocation[];
    args: ArgumentMeta[];
}
