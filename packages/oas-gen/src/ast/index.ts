export type ComponentTable =
    | "schemas"
    | "parameters"
    | "responses"
    | "requestBodies"
    | "headers"
    | "examples"
    | "securitySchemes"
    | "links"
    | "callbacks"
    | "pathItems";

export type ComponentPointer = {
    table: ComponentTable;
    name: string;
};

export type Ref<T> = { kind: "ref"; target: ComponentPointer } | { kind: "inline"; value: T };

export type Extensions = Record<string, unknown>;

export type PrimitiveType = "string" | "number" | "integer" | "boolean" | "null";

export type SchemaIR =
    | {
          kind: "ref";
          target: ComponentPointer;
          description?: string;
          summary?: string;
      }
    | {
          kind: "primitive";
          type: PrimitiveType;
          types?: string[];
          format?: string;
          enum?: Array<string | number | boolean | null>;
          const?: unknown;
          nullable?: boolean;
          minLength?: number;
          maxLength?: number;
          pattern?: string;
          minimum?: number;
          maximum?: number;
          exclusiveMinimum?: number | boolean;
          exclusiveMaximum?: number | boolean;
          multipleOf?: number;
          default?: unknown;
          example?: unknown;
          examples?: unknown[];
          readOnly?: boolean;
          writeOnly?: boolean;
          deprecated?: boolean;
          description?: string;
          extensions?: Extensions;
      }
    | {
          kind: "object";
          properties: Record<string, Ref<SchemaIR>>;
          required?: string[];
          additionalProperties?: boolean | Ref<SchemaIR>;
          patternProperties?: Record<string, Ref<SchemaIR>>;
          propertyNames?: Ref<SchemaIR>;
          dependentRequired?: Record<string, string[]>;
          discriminator?: DiscriminatorIR;
          xml?: XmlIR;
          readOnly?: boolean;
          writeOnly?: boolean;
          deprecated?: boolean;
          if?: Ref<SchemaIR>;
          then?: Ref<SchemaIR>;
          else?: Ref<SchemaIR>;
          nullable?: boolean;
          description?: string;
          extensions?: Extensions;
      }
    | {
          kind: "array";
          items: Ref<SchemaIR>;
          prefixItems?: Ref<SchemaIR>[];
          minItems?: number;
          maxItems?: number;
          uniqueItems?: boolean;
          xml?: XmlIR;
          nullable?: boolean;
          description?: string;
          extensions?: Extensions;
      }
    | {
          kind: "composition";
          combiner: "allOf" | "anyOf" | "oneOf";
          schemas: Ref<SchemaIR>[];
          discriminator?: DiscriminatorIR;
          nullable?: boolean;
          description?: string;
          extensions?: Extensions;
      }
    | {
          kind: "not";
          schema: Ref<SchemaIR>;
          description?: string;
          extensions?: Extensions;
      };

export type DiscriminatorIR = {
    propertyName: string;
    mapping?: Record<string, string>;
};

export type XmlIR = {
    name?: string;
    wrapped?: boolean;
    attribute?: boolean;
};

export type ExampleIR = {
    summary?: string;
    description?: string;
    value?: unknown;
    externalValue?: string;
    extensions?: Extensions;
};

export type EncodingIR = {
    contentType?: string;
    headers?: Record<string, Ref<HeaderIR>>;
    style?: string;
    explode?: boolean;
    allowReserved?: boolean;
    extensions?: Extensions;
};

export type MediaTypeIR = {
    schema?: Ref<SchemaIR>;
    example?: unknown;
    examples?: Record<string, Ref<ExampleIR>>;
    encoding?: Record<string, EncodingIR>;
    extensions?: Extensions;
};

export type ParameterIR = {
    name: string;
    in: "path" | "query" | "header" | "cookie";
    required?: boolean;
    description?: string;
    deprecated?: boolean;
    allowEmptyValue?: boolean;
    allowReserved?: boolean;
    style?: string;
    explode?: boolean;
    schema?: Ref<SchemaIR>;
    content?: Record<string, MediaTypeIR>;
    example?: unknown;
    examples?: Record<string, Ref<ExampleIR>>;
    extensions?: Extensions;
};

export type HeaderIR = Omit<ParameterIR, "name" | "in">;

export type ResponseIR = {
    description: string;
    headers?: Record<string, Ref<HeaderIR>>;
    content?: Record<string, MediaTypeIR>;
    links?: Record<string, Ref<LinkIR>>;
    extensions?: Extensions;
};

export type RequestBodyIR = {
    description?: string;
    required?: boolean;
    content: Record<string, MediaTypeIR>;
    extensions?: Extensions;
};

export type LinkIR = {
    operationId?: string;
    operationRef?: string;
    parameters?: Record<string, string>;
    requestBody?: unknown;
    description?: string;
    server?: ServerIR;
    extensions?: Extensions;
};

export type CallbackIR = Record<string, PathItemIR>;

export type OperationIR = {
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
    deprecated?: boolean;
    parameters?: Ref<ParameterIR>[];
    requestBody?: Ref<RequestBodyIR>;
    responses: Record<string, Ref<ResponseIR>>;
    security?: SecurityRequirementIR[];
    servers?: ServerIR[];
    callbacks?: Record<string, Ref<CallbackIR>>;
    externalDocs?: ExternalDocsIR;
    extensions?: Extensions;
};

export type PathItemIR = {
    /** Path Item `$ref` (including `components.pathItems` in 3.1). */
    $ref?: ComponentPointer;
    summary?: string;
    description?: string;
    servers?: ServerIR[];
    parameters?: Ref<ParameterIR>[];
    get?: OperationIR;
    put?: OperationIR;
    post?: OperationIR;
    delete?: OperationIR;
    options?: OperationIR;
    head?: OperationIR;
    patch?: OperationIR;
    trace?: OperationIR;
    extensions?: Extensions;
};

export type OAuthFlowIR = {
    authorizationUrl?: string;
    tokenUrl?: string;
    refreshUrl?: string;
    scopes: Record<string, string>;
    extensions?: Extensions;
};

export type OAuthFlowsIR = {
    implicit?: OAuthFlowIR;
    password?: OAuthFlowIR;
    clientCredentials?: OAuthFlowIR;
    authorizationCode?: OAuthFlowIR;
};

export type SecuritySchemeIR = {
    type: "apiKey" | "http" | "oauth2" | "openIdConnect" | "mutualTLS";
    description?: string;
    name?: string;
    in?: "header" | "query" | "cookie";
    scheme?: string;
    bearerFormat?: string;
    flows?: OAuthFlowsIR;
    openIdConnectUrl?: string;
    extensions?: Extensions;
};

export type SecurityRequirementIR = Record<string, string[]>;

export type ServerVariableIR = {
    default: string;
    enum?: string[];
    description?: string;
};

export type ServerIR = {
    url: string;
    description?: string;
    variables?: Record<string, ServerVariableIR>;
};

export type ContactIR = {
    name?: string;
    url?: string;
    email?: string;
};

export type LicenseIR = {
    name: string;
    url?: string;
    identifier?: string;
};

export type InfoIR = {
    title: string;
    version: string;
    summary?: string;
    description?: string;
    termsOfService?: string;
    contact?: ContactIR;
    license?: LicenseIR;
    extensions?: Extensions;
};

export type TagIR = {
    name: string;
    description?: string;
    externalDocs?: ExternalDocsIR;
    extensions?: Extensions;
};

export type ExternalDocsIR = {
    url: string;
    description?: string;
    extensions?: Extensions;
};

export type ComponentsIR = {
    schemas?: Record<string, SchemaIR>;
    parameters?: Record<string, ParameterIR>;
    responses?: Record<string, ResponseIR>;
    requestBodies?: Record<string, RequestBodyIR>;
    headers?: Record<string, HeaderIR>;
    examples?: Record<string, ExampleIR>;
    securitySchemes?: Record<string, SecuritySchemeIR>;
    links?: Record<string, LinkIR>;
    callbacks?: Record<string, CallbackIR>;
    pathItems?: Record<string, PathItemIR>;
    extensions?: Extensions;
};

export type OpenAPIDocument = {
    openapi: string;
    info: InfoIR;
    jsonSchemaDialect?: string;
    servers?: ServerIR[];
    security?: SecurityRequirementIR[];
    tags?: TagIR[];
    externalDocs?: ExternalDocsIR;
    paths?: Record<string, PathItemIR>;
    webhooks?: Record<string, PathItemIR>;
    components?: ComponentsIR;
    extensions?: Extensions;
};

export const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];
