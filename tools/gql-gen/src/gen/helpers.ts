import {
    BUILTIN_SCALARS,
    listOf,
    named,
    nonNull,
    type ArgIR,
    type FieldIR,
    type GraphQLDocument,
    type InputFieldIR,
    type NamedTypeIR,
    type TypeRef,
} from "../ast/index.ts";
import {
    pickArgName,
    pickCustomScalar,
    pickDescription,
    pickEnumName,
    pickEnumValue,
    pickFieldName,
    pickInputName,
    pickInterfaceName,
    pickTypeName,
    pickUnionName,
} from "../lexicon/index.ts";
import { addType, bumpNodes, chance, mark, remainingTypes, type GenContext } from "./context.ts";

export function builtinScalar(ctx: GenContext): TypeRef {
    mark(ctx, "type.scalar.builtin");
    return named(ctx.rng.pick(BUILTIN_SCALARS));
}

/** Build a legal GraphQL type (never `Type!!` or nested non-null of non-null). */
export function wrapType(ctx: GenContext, base: TypeRef, depth = 0): TypeRef {
    let inner = base;
    // Optional deeper list nesting: only add list wrappers, then outer nullability.
    const listLayers = depth < ctx.budget.maxDepth && chance(ctx, "field.list", 0.35) ? 1 : 0;
    const deep =
        listLayers > 0 && depth + 1 < ctx.budget.maxDepth && chance(ctx, "field.deep.nest", 0.15) ? 1 : 0;
    if (listLayers) mark(ctx, "field.list");
    if (deep) {
        mark(ctx, "field.deep.nest");
        mark(ctx, "field.list");
    }
    const layers = listLayers + deep;
    for (let i = 0; i < layers; i++) {
        if (chance(ctx, "field.nonNull", 0.5)) {
            mark(ctx, "field.nonNull");
            inner = nonNull(inner);
        }
        inner = listOf(inner);
    }
    if (chance(ctx, "field.nonNull", 0.45)) {
        mark(ctx, "field.nonNull");
        inner = nonNull(inner);
    }
    return inner;
}

export function makeArgs(ctx: GenContext, inputTypes: string[]): ArgIR[] | undefined {
    if (!chance(ctx, "field.arg", 0.55)) return undefined;
    mark(ctx, "field.arg");
    const n = ctx.rng.int(1, Math.max(1, Math.min(ctx.budget.maxArgs, 3)));
    const used = new Set<string>();
    const args: ArgIR[] = [];
    for (let i = 0; i < n && bumpNodes(ctx); i++) {
        const name = pickArgName(ctx, used);
        let type: TypeRef;
        if (inputTypes.length && ctx.rng.bool(0.35)) {
            type = wrapType(ctx, named(ctx.rng.pick(inputTypes)));
        } else {
            type = wrapType(ctx, builtinScalar(ctx));
        }
        const arg: ArgIR = { name, type };
        if (chance(ctx, "arg.default", 0.25) && type.kind === "named" && type.name === "Int") {
            mark(ctx, "arg.default");
            arg.defaultValue = ctx.rng.int(0, 20);
        } else if (chance(ctx, "arg.default", 0.2) && type.kind === "named" && type.name === "String") {
            mark(ctx, "arg.default");
            arg.defaultValue = "default";
        } else if (chance(ctx, "arg.default", 0.2) && type.kind === "named" && type.name === "Boolean") {
            mark(ctx, "arg.default");
            arg.defaultValue = false;
        }
        args.push(arg);
    }
    return args.length ? args : undefined;
}

export function makeObjectFields(
    ctx: GenContext,
    objectTypes: string[],
    enumTypes: string[],
    inputTypes: string[],
    opts: { allowObjectFields?: boolean; forceCycle?: string } = {},
): FieldIR[] {
    const used = new Set<string>();
    const count = ctx.rng.int(1, Math.max(1, Math.min(ctx.budget.maxFieldsPerType, 4)));
    const fields: FieldIR[] = [];
    for (let i = 0; i < count && bumpNodes(ctx); i++) {
        const name = pickFieldName(ctx, used);
        let type: TypeRef;
        if (opts.forceCycle && i === 0) {
            type = named(opts.forceCycle);
            mark(ctx, "field.object");
            mark(ctx, "cycle.object");
        } else if (opts.allowObjectFields && objectTypes.length && chance(ctx, "field.object", 0.35)) {
            mark(ctx, "field.object");
            type = wrapType(ctx, named(ctx.rng.pick(objectTypes)));
        } else if (enumTypes.length && ctx.rng.bool(0.25)) {
            type = wrapType(ctx, named(ctx.rng.pick(enumTypes)));
        } else {
            mark(ctx, "field.scalar");
            type = wrapType(ctx, builtinScalar(ctx));
        }
        const field: FieldIR = {
            name,
            type,
            args: makeArgs(ctx, inputTypes),
        };
        if (chance(ctx, "desc.field", 0.2)) {
            mark(ctx, "desc.field");
            field.description = pickDescription(ctx);
        }
        fields.push(field);
    }
    return fields;
}

export function makeInputFields(ctx: GenContext, inputTypes: string[], enumTypes: string[]): InputFieldIR[] {
    const used = new Set<string>();
    const count = ctx.rng.int(1, Math.max(1, Math.min(ctx.budget.maxFieldsPerType, 3)));
    const fields: InputFieldIR[] = [];
    for (let i = 0; i < count && bumpNodes(ctx); i++) {
        const name = pickFieldName(ctx, used);
        let type: TypeRef;
        if (inputTypes.length && ctx.rng.bool(0.2)) {
            type = wrapType(ctx, named(ctx.rng.pick(inputTypes)));
        } else if (enumTypes.length && ctx.rng.bool(0.25)) {
            type = wrapType(ctx, named(ctx.rng.pick(enumTypes)));
        } else {
            type = wrapType(ctx, builtinScalar(ctx));
        }
        fields.push({ name, type });
    }
    return fields;
}

export function ensureEnum(ctx: GenContext, doc: GraphQLDocument): string {
    const existing = doc.types.filter((t) => t.kind === "enum");
    if (existing.length) return existing[0]!.name;
    const name = pickEnumName(ctx, ctx.usedTypeNames);
    const valuesUsed = new Set<string>();
    const values = Array.from({ length: ctx.rng.int(2, 4) }, () => ({
        name: pickEnumValue(ctx, valuesUsed),
    }));
    addType(ctx, doc, { kind: "enum", name, values });
    mark(ctx, "type.enum");
    return name;
}

export function ensureObject(
    ctx: GenContext,
    doc: GraphQLDocument,
    nameHint?: string,
    opts: { interfaces?: string[]; fields?: FieldIR[]; description?: string } = {},
): string {
    if (nameHint && ctx.usedTypeNames.has(nameHint)) {
        const t = doc.types.find((x) => x.name === nameHint);
        if (t?.kind === "object") return nameHint;
    }
    const name = nameHint && !ctx.usedTypeNames.has(nameHint) ? nameHint : pickTypeName(ctx, ctx.usedTypeNames);
    const enums = doc.types.filter((t) => t.kind === "enum").map((t) => t.name);
    const objects = doc.types.filter((t) => t.kind === "object").map((t) => t.name);
    const inputs = doc.types.filter((t) => t.kind === "inputObject").map((t) => t.name);
    const type: NamedTypeIR = {
        kind: "object",
        name,
        fields: opts.fields ?? makeObjectFields(ctx, objects, enums, inputs, { allowObjectFields: true }),
        interfaces: opts.interfaces,
        description: opts.description,
    };
    addType(ctx, doc, type);
    mark(ctx, "type.object");
    if (opts.description) mark(ctx, "desc.type");
    return name;
}

export function ensureQuery(ctx: GenContext, doc: GraphQLDocument, fieldType?: TypeRef): void {
    const queryName = "Query";
    const enums = doc.types.filter((t) => t.kind === "enum").map((t) => t.name);
    const objects = doc.types.filter((t) => t.kind === "object" && t.name !== "Query").map((t) => t.name);
    const inputs = doc.types.filter((t) => t.kind === "inputObject").map((t) => t.name);
    const fields =
        fieldType != null
            ? [{ name: "hello", type: fieldType }]
            : makeObjectFields(ctx, objects, enums, inputs, { allowObjectFields: true });
    if (!fields.some((f) => f.name === "hello") && fields.length === 0) {
        fields.push({ name: "hello", type: named("String") });
        mark(ctx, "field.scalar");
        mark(ctx, "type.scalar.builtin");
    }
    const existing = doc.types.find((t) => t.name === queryName);
    if (existing?.kind === "object") {
        existing.fields = fields;
    } else {
        addType(ctx, doc, { kind: "object", name: queryName, fields });
        mark(ctx, "type.object");
    }
    doc.schema = { ...(doc.schema ?? {}), query: queryName };
    mark(ctx, "root.query");
}

export function addCustomScalar(ctx: GenContext, doc: GraphQLDocument): string {
    const name = pickCustomScalar(ctx, ctx.usedTypeNames);
    const withTypedef = chance(ctx, "scalar.typedef", 0.4);
    const description = withTypedef
        ? `@typedef {string}`
        : chance(ctx, "desc.type", 0.5)
          ? pickDescription(ctx)
          : undefined;
    if (withTypedef) mark(ctx, "scalar.typedef");
    if (description && !withTypedef) mark(ctx, "desc.type");
    addType(ctx, doc, { kind: "scalar", name, description });
    mark(ctx, "type.scalar.custom");
    return name;
}

export function addInput(ctx: GenContext, doc: GraphQLDocument, oneOf = false): string {
    const name = pickInputName(ctx, ctx.usedTypeNames);
    const enums = doc.types.filter((t) => t.kind === "enum").map((t) => t.name);
    const inputs = doc.types.filter((t) => t.kind === "inputObject").map((t) => t.name);
    let fields = makeInputFields(ctx, inputs, enums);
    if (oneOf) {
        fields = fields.map((f) => {
            let t = f.type;
            while (t.kind === "nonNull") t = t.of;
            return { name: f.name, type: t, description: f.description };
        });
        mark(ctx, "input.oneOf");
    }
    addType(ctx, doc, { kind: "inputObject", name, fields, isOneOf: oneOf || undefined });
    mark(ctx, "type.input");
    return name;
}

export function addInterface(ctx: GenContext, doc: GraphQLDocument): string {
    const name = pickInterfaceName(ctx, ctx.usedTypeNames);
    const enums = doc.types.filter((t) => t.kind === "enum").map((t) => t.name);
    const fields = makeObjectFields(ctx, [], enums, [], { allowObjectFields: false });
    // Ensure at least an id: ID field for implementors to share
    if (!fields.some((f) => f.name === "id")) {
        fields.unshift({ name: "id", type: nonNull(named("ID")) });
        mark(ctx, "field.nonNull");
        mark(ctx, "type.scalar.builtin");
        mark(ctx, "field.scalar");
    }
    addType(ctx, doc, { kind: "interface", name, fields });
    mark(ctx, "type.interface");
    return name;
}

export function addUnion(ctx: GenContext, doc: GraphQLDocument, members: string[]): string {
    const name = pickUnionName(ctx, ctx.usedTypeNames);
    const safe = members.filter((m) => doc.types.some((t) => t.kind === "object" && t.name === m));
    const finalMembers = safe.length >= 2 ? safe.slice(0, 3) : safe.length === 1 ? [safe[0]!, ensureObject(ctx, doc)] : [ensureObject(ctx, doc), ensureObject(ctx, doc)];
    addType(ctx, doc, { kind: "union", name, members: finalMembers });
    mark(ctx, "type.union");
    return name;
}

export function objectNames(doc: GraphQLDocument): string[] {
    return doc.types.filter((t) => t.kind === "object").map((t) => t.name);
}

export function remainingOk(ctx: GenContext): boolean {
    return remainingTypes(ctx) > 0 && ctx.nodeCount < ctx.budget.maxNodes;
}
