export type TypeRef =
    | { kind: "named"; name: string }
    | { kind: "list"; of: TypeRef }
    | { kind: "nonNull"; of: TypeRef };

export type AppliedDirective = {
    name: string;
    args?: Record<string, unknown>;
};

export type ArgIR = {
    name: string;
    type: TypeRef;
    defaultValue?: unknown;
    description?: string;
    directives?: AppliedDirective[];
};

export type FieldIR = {
    name: string;
    type: TypeRef;
    args?: ArgIR[];
    description?: string;
    deprecationReason?: string;
    directives?: AppliedDirective[];
};

export type InputFieldIR = {
    name: string;
    type: TypeRef;
    defaultValue?: unknown;
    description?: string;
    directives?: AppliedDirective[];
};

export type EnumValueIR = {
    name: string;
    description?: string;
    deprecationReason?: string;
    directives?: AppliedDirective[];
};

export type DirectiveArgDefIR = {
    name: string;
    type: TypeRef;
    defaultValue?: unknown;
    description?: string;
};

export type DirectiveDefIR = {
    name: string;
    locations: string[];
    args?: DirectiveArgDefIR[];
    description?: string;
    isRepeatable?: boolean;
};

export type NamedTypeIR =
    | {
          kind: "scalar";
          name: string;
          description?: string;
          specifiedByURL?: string;
          directives?: AppliedDirective[];
      }
    | {
          kind: "object";
          name: string;
          fields: FieldIR[];
          interfaces?: string[];
          description?: string;
          directives?: AppliedDirective[];
      }
    | {
          kind: "interface";
          name: string;
          fields: FieldIR[];
          interfaces?: string[];
          description?: string;
          directives?: AppliedDirective[];
      }
    | {
          kind: "union";
          name: string;
          members: string[];
          description?: string;
          directives?: AppliedDirective[];
      }
    | {
          kind: "enum";
          name: string;
          values: EnumValueIR[];
          description?: string;
          directives?: AppliedDirective[];
      }
    | {
          kind: "inputObject";
          name: string;
          fields: InputFieldIR[];
          isOneOf?: boolean;
          description?: string;
          directives?: AppliedDirective[];
      };

export type SchemaRootIR = {
    query?: string;
    mutation?: string;
    subscription?: string;
    description?: string;
    directives?: AppliedDirective[];
};

export type ExtensionIR =
    | { kind: "schema"; mutation?: string; subscription?: string; description?: string }
    | { kind: "object"; name: string; fields: FieldIR[]; interfaces?: string[] }
    | { kind: "interface"; name: string; fields: FieldIR[]; interfaces?: string[] }
    | { kind: "inputObject"; name: string; fields: InputFieldIR[] }
    | { kind: "enum"; name: string; values: EnumValueIR[] }
    | { kind: "union"; name: string; members: string[] };

export type GraphQLDocument = {
    schema?: SchemaRootIR;
    types: NamedTypeIR[];
    directives: DirectiveDefIR[];
    extensions?: ExtensionIR[];
};

export const BUILTIN_SCALARS = ["String", "Int", "Float", "Boolean", "ID"] as const;

export function named(name: string): TypeRef {
    return { kind: "named", name };
}

export function listOf(of: TypeRef): TypeRef {
    return { kind: "list", of };
}

export function nonNull(of: TypeRef): TypeRef {
    return { kind: "nonNull", of };
}

export function typeRefDepth(t: TypeRef): number {
    if (t.kind === "named") return 1;
    return 1 + typeRefDepth(t.of);
}

export function unwrapNamed(t: TypeRef): string {
    if (t.kind === "named") return t.name;
    return unwrapNamed(t.of);
}

export function cloneDoc(doc: GraphQLDocument): GraphQLDocument {
    return structuredClone(doc);
}
