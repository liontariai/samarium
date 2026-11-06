import { named, nonNull, type FieldIR, type GraphQLDocument } from "../ast/index.ts";
import { PHASE5_PROFILES } from "../catalog/features.ts";
import { pickDescription, pickFieldName, pickTypeName } from "../lexicon/index.ts";
import { SIZE_BUDGETS, defaultSizeForProfile } from "../size.ts";
import { Rng } from "../rng.ts";
import type { GenerateOptions, Profile } from "../types.ts";
import {
    addType,
    bumpNodes,
    chance,
    emptyDocument,
    mark,
    remainingTypes,
    type GenContext,
} from "./context.ts";
import {
    addCustomScalar,
    addInput,
    addInterface,
    addUnion,
    builtinScalar,
    ensureEnum,
    ensureObject,
    ensureQuery,
    makeArgs,
    makeObjectFields,
    objectNames,
    remainingOk,
    wrapType,
} from "./helpers.ts";

const IMPLEMENTED = new Set<string>(PHASE5_PROFILES);

export function createContext(opts: GenerateOptions): GenContext {
    const rng = new Rng(opts.seed);
    const profile: Profile = opts.profile ?? "core-api";
    if (!IMPLEMENTED.has(profile)) {
        throw new Error(`Profile "${profile}" is not implemented yet. Use: ${[...IMPLEMENTED].join(", ")}.`);
    }
    const size = opts.size ?? defaultSizeForProfile(profile);
    return {
        rng,
        profile,
        size,
        budget: SIZE_BUDGETS[size],
        codegenSafeIds: opts.codegenSafeIds !== false,
        force: new Set(opts.features ?? []),
        forbid: new Set(opts.forbid ?? []),
        features: new Set(),
        typeCount: 0,
        fieldCount: 0,
        nodeCount: 0,
        directiveCount: 0,
        usedTypeNames: new Set(),
        usedDirectiveNames: new Set(["skip", "include", "deprecated", "specifiedBy", "oneOf"]),
    };
}

function genMinimal(ctx: GenContext, doc: GraphQLDocument): void {
    ensureQuery(ctx, doc, named("String"));
    mark(ctx, "field.scalar");
    mark(ctx, "type.scalar.builtin");
}

function genCoreApi(ctx: GenContext, doc: GraphQLDocument): void {
    const enumName = ensureEnum(ctx, doc);
    const objA = ensureObject(ctx, doc);
    const objB = ensureObject(ctx, doc);
    // Link A -> B
    const a = doc.types.find((t) => t.name === objA);
    if (a?.kind === "object" && chance(ctx, "field.object", 0.8)) {
        mark(ctx, "field.object");
        a.fields.push({
            name: pickFieldName(ctx, new Set(a.fields.map((f) => f.name))),
            type: wrapType(ctx, named(objB)),
            args: makeArgs(ctx, []),
        });
    }
    // Ensure Query returns something interesting
    const qFields: FieldIR[] = [
        {
            name: "node",
            type: wrapType(ctx, named(objA)),
            args: makeArgs(ctx, []),
        },
        {
            name: "status",
            type: wrapType(ctx, named(enumName)),
        },
        {
            name: "ping",
            type: named("String"),
        },
    ];
    mark(ctx, "field.scalar");
    mark(ctx, "type.scalar.builtin");
    mark(ctx, "field.object");
    const existing = doc.types.find((t) => t.name === "Query");
    if (existing?.kind === "object") existing.fields = qFields;
    else addType(ctx, doc, { kind: "object", name: "Query", fields: qFields });
    doc.schema = { query: "Query" };
    mark(ctx, "root.query");
    mark(ctx, "type.object");
}

function genTypeSystemHeavy(ctx: GenContext, doc: GraphQLDocument): void {
    ensureEnum(ctx, doc);
    if (remainingOk(ctx)) ensureEnum(ctx, doc);
    const iface = addInterface(ctx, doc);
    const ifaceType = doc.types.find((t) => t.name === iface);
    const ifaceFields = ifaceType?.kind === "interface" ? ifaceType.fields : [];

    const ifaceFieldNames = new Set(ifaceFields.map((f) => f.name));
    const extraA = makeObjectFields(
        ctx,
        [],
        doc.types.filter((t) => t.kind === "enum").map((t) => t.name),
        [],
        { allowObjectFields: false },
    ).filter((f) => !ifaceFieldNames.has(f.name));
    const implA = ensureObject(ctx, doc, undefined, {
        interfaces: [iface],
        fields: [...ifaceFields.map((f) => structuredClone(f)), ...extraA],
        description: chance(ctx, "desc.type", 0.5) ? pickDescription(ctx) : undefined,
    });
    const implB = ensureObject(ctx, doc, undefined, {
        interfaces: [iface],
        fields: [
            ...ifaceFields.map((f) => structuredClone(f)),
            { name: "extra", type: named("String") },
        ],
    });
    mark(ctx, "field.scalar");

    addUnion(ctx, doc, [implA, implB]);
    const input = addInput(ctx, doc, false);
    if (chance(ctx, "input.oneOf", 0.6)) addInput(ctx, doc, true);

    const scalar = addCustomScalar(ctx, doc);

    // Cyclic object
    if (remainingOk(ctx) && chance(ctx, "cycle.object", 0.7)) {
        const cycleName = pickTypeName(ctx, ctx.usedTypeNames);
        addType(ctx, doc, {
            kind: "object",
            name: cycleName,
            fields: [
                { name: "id", type: nonNull(named("ID")) },
                { name: "self", type: named(cycleName) },
                { name: "neighbors", type: wrapType(ctx, named(cycleName)) },
            ],
        });
        mark(ctx, "type.object");
        mark(ctx, "cycle.object");
        mark(ctx, "field.object");
        mark(ctx, "field.nonNull");
        mark(ctx, "type.scalar.builtin");
    }

    // Mutation root
    const mutFields: FieldIR[] = [
        {
            name: "create",
            type: named(implA),
            args: [{ name: "input", type: nonNull(named(input)) }],
        },
        {
            name: "echo",
            type: named(scalar),
            args: [{ name: "value", type: named("String") }],
        },
    ];
    mark(ctx, "field.arg");
    mark(ctx, "field.nonNull");
    mark(ctx, "field.object");
    addType(ctx, doc, { kind: "object", name: "Mutation", fields: mutFields });
    mark(ctx, "type.object");
    mark(ctx, "root.mutation");

    const qFields: FieldIR[] = [
        { name: "search", type: wrapType(ctx, named(doc.types.find((t) => t.kind === "union")!.name)) },
        { name: "node", type: named(iface) },
        { name: "item", type: named(implA) },
        { name: "stamp", type: named(scalar) },
    ];
    mark(ctx, "field.object");
    addType(ctx, doc, { kind: "object", name: "Query", fields: qFields });
    mark(ctx, "type.object");
    doc.schema = { query: "Query", mutation: "Mutation" };
    mark(ctx, "root.query");
}

function genDirectiveMatrix(ctx: GenContext, doc: GraphQLDocument): void {
    genTypeSystemHeavy(ctx, doc);

    doc.directives.push({
        name: "tag",
        locations: ["FIELD", "FRAGMENT_SPREAD", "INLINE_FRAGMENT"],
        args: [{ name: "name", type: nonNull(named("String")) }],
    });
    mark(ctx, "dir.def");
    mark(ctx, "dir.custom.field");
    mark(ctx, "dir.custom.fragment");
    ctx.directiveCount++;
    ctx.usedDirectiveNames.add("tag");

    doc.directives.push({
        name: "auth",
        locations: ["FIELD_DEFINITION", "OBJECT"],
        args: [{ name: "requires", type: named("String"), defaultValue: "USER" }],
    });
    mark(ctx, "dir.def");
    ctx.directiveCount++;
    ctx.usedDirectiveNames.add("auth");

    // Apply @deprecated / @tag-like on fields
    for (const t of doc.types) {
        if (t.kind !== "object" && t.kind !== "interface") continue;
        for (const field of t.fields) {
            if (chance(ctx, "field.deprecated", 0.2)) {
                field.deprecationReason = "legacy";
                mark(ctx, "field.deprecated");
                mark(ctx, "dir.builtin.deprecated");
            }
            if (chance(ctx, "dir.custom.field", 0.25)) {
                field.directives = [...(field.directives ?? []), { name: "auth", args: { requires: "ADMIN" } }];
                mark(ctx, "dir.custom.field");
            }
        }
        if (t.kind === "object" && chance(ctx, "dir.custom.field", 0.3)) {
            t.directives = [...(t.directives ?? []), { name: "auth", args: { requires: "USER" } }];
        }
    }
    for (const t of doc.types) {
        if (t.kind !== "enum") continue;
        for (const v of t.values) {
            if (chance(ctx, "enum.deprecated", 0.25)) {
                v.deprecationReason = "old";
                mark(ctx, "enum.deprecated");
                mark(ctx, "dir.builtin.deprecated");
            }
        }
    }

    // Note skip/include exist as built-ins (operation directives) — mark for coverage
    mark(ctx, "dir.builtin.skip");
    mark(ctx, "dir.builtin.include");
}

function genSubscriptionRoot(ctx: GenContext, doc: GraphQLDocument): void {
    genCoreApi(ctx, doc);
    const objects = objectNames(doc).filter((n) => n !== "Query" && n !== "Mutation" && n !== "Subscription");
    const target = objects[0] ?? ensureObject(ctx, doc);
    addType(ctx, doc, {
        kind: "object",
        name: "Subscription",
        fields: [
            {
                name: "onUpdate",
                type: named(target),
                args: [{ name: "id", type: named("ID") }],
            },
        ],
    });
    mark(ctx, "type.object");
    mark(ctx, "root.subscription");
    mark(ctx, "field.object");
    mark(ctx, "field.arg");
    doc.schema = { ...(doc.schema ?? { query: "Query" }), subscription: "Subscription" };
}

function genCyclicTypes(ctx: GenContext, doc: GraphQLDocument): void {
    const a = pickTypeName(ctx, ctx.usedTypeNames);
    const b = pickTypeName(ctx, ctx.usedTypeNames);
    addType(ctx, doc, {
        kind: "object",
        name: a,
        fields: [
            { name: "id", type: nonNull(named("ID")) },
            { name: "other", type: named(b) },
            { name: "self", type: named(a) },
        ],
    });
    addType(ctx, doc, {
        kind: "object",
        name: b,
        fields: [
            { name: "id", type: nonNull(named("ID")) },
            { name: "back", type: named(a) },
            { name: "list", type: wrapType(ctx, named(a)) },
        ],
    });
    mark(ctx, "type.object");
    mark(ctx, "cycle.object");
    mark(ctx, "field.object");
    mark(ctx, "field.nonNull");
    mark(ctx, "type.scalar.builtin");
    if (remainingTypes(ctx) > 0) {
        addType(ctx, doc, {
            kind: "object",
            name: pickTypeName(ctx, ctx.usedTypeNames),
            fields: [{ name: "n", type: named("Int") }],
        });
        mark(ctx, "type.unused");
        mark(ctx, "type.object");
        mark(ctx, "field.scalar");
    }
    ensureQuery(ctx, doc);
    const q = doc.types.find((t) => t.name === "Query");
    if (q?.kind === "object") {
        q.fields = [
            { name: "a", type: named(a) },
            { name: "b", type: named(b) },
        ];
        mark(ctx, "field.object");
    }
}

function genSchemaExtensions(ctx: GenContext, doc: GraphQLDocument): void {
    genCoreApi(ctx, doc);
    const base = objectNames(doc).find((n) => n !== "Query") ?? ensureObject(ctx, doc);
    doc.extensions = [
        {
            kind: "object",
            name: base,
            fields: [{ name: "extended", type: named("String") }],
        },
    ];
    mark(ctx, "ext.type");
    mark(ctx, "field.scalar");
    mark(ctx, "type.scalar.builtin");

    if (chance(ctx, "ext.schema", 0.7) && !doc.schema?.mutation) {
        addType(ctx, doc, {
            kind: "object",
            name: "Mutation",
            fields: [{ name: "noop", type: named("Boolean") }],
        });
        mark(ctx, "type.object");
        doc.extensions.push({ kind: "schema", mutation: "Mutation" });
        mark(ctx, "ext.schema");
        mark(ctx, "root.mutation");
    }

    if (remainingOk(ctx)) {
        addType(ctx, doc, {
            kind: "object",
            name: pickTypeName(ctx, ctx.usedTypeNames),
            fields: [{ name: "orphan", type: named("String") }],
        });
        mark(ctx, "type.unused");
        mark(ctx, "type.object");
    }
}

function genMessyBase(ctx: GenContext, doc: GraphQLDocument): void {
    // Messy starts from type-system-heavy; mutations applied in generate.ts
    genTypeSystemHeavy(ctx, doc);
}

export function generateDocument(ctx: GenContext): GraphQLDocument {
    const doc = emptyDocument();
    switch (ctx.profile) {
        case "minimal":
            genMinimal(ctx, doc);
            break;
        case "core-api":
            genCoreApi(ctx, doc);
            break;
        case "type-system-heavy":
            genTypeSystemHeavy(ctx, doc);
            break;
        case "directive-matrix":
            genDirectiveMatrix(ctx, doc);
            break;
        case "subscription-root":
            genSubscriptionRoot(ctx, doc);
            break;
        case "cyclic-types":
            genCyclicTypes(ctx, doc);
            break;
        case "schema-extensions":
            genSchemaExtensions(ctx, doc);
            break;
        case "messy":
            genMessyBase(ctx, doc);
            break;
        default:
            genCoreApi(ctx, doc);
    }
    mark(ctx, "ser.sdl");
    return doc;
}

export { type GenContext };
