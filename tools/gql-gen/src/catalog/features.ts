import type { FeatureId, Profile } from "../types.ts";

export type FeatureWeight = "common" | "uncommon" | "rare";
export type SamariumRelevance = "high" | "medium" | "low";
export type FeatureObject =
    | "Schema"
    | "Type"
    | "Field"
    | "Arg"
    | "Input"
    | "Directive"
    | "Extension"
    | "Serialization"
    | "Mutation";

export type FeatureDef = {
    id: FeatureId;
    object: FeatureObject;
    keywords: string[];
    weight: FeatureWeight;
    samariumRelevance: SamariumRelevance;
    implemented: boolean;
    phase: 1 | 2 | 3 | 4 | 5;
};

function f(
    id: FeatureId,
    object: FeatureObject,
    keywords: string[],
    extra: Partial<Pick<FeatureDef, "weight" | "samariumRelevance" | "implemented" | "phase">> = {},
): FeatureDef {
    return {
        id,
        object,
        keywords,
        weight: extra.weight ?? "common",
        samariumRelevance: extra.samariumRelevance ?? "high",
        implemented: extra.implemented ?? false,
        phase: extra.phase ?? 2,
    };
}

export const FEATURES: FeatureDef[] = [
    // Phase 1
    f("root.query", "Schema", ["Query"], { implemented: true, phase: 1 }),
    f("type.object", "Type", ["type"], { implemented: true, phase: 1 }),
    f("type.scalar.builtin", "Type", ["String", "Int", "Float", "Boolean", "ID"], { implemented: true, phase: 1 }),
    f("field.scalar", "Field", [], { implemented: true, phase: 1 }),
    f("field.list", "Field", ["[]"], { implemented: true, phase: 1 }),
    f("field.nonNull", "Field", ["!"], { implemented: true, phase: 1 }),
    f("field.arg", "Arg", ["("], { implemented: true, phase: 1 }),
    f("type.enum", "Type", ["enum"], { implemented: true, phase: 1 }),
    f("ser.sdl", "Serialization", ["graphql"], { implemented: true, phase: 1, samariumRelevance: "medium" }),

    // Phase 2
    f("root.mutation", "Schema", ["Mutation"], { implemented: true, phase: 2 }),
    f("type.input", "Input", ["input"], { implemented: true, phase: 2 }),
    f("input.oneOf", "Input", ["@oneOf"], { implemented: true, phase: 2, weight: "uncommon", samariumRelevance: "medium" }),
    f("type.interface", "Type", ["interface", "implements"], { implemented: true, phase: 2 }),
    f("type.union", "Type", ["union"], { implemented: true, phase: 2 }),
    f("field.object", "Field", [], { implemented: true, phase: 2 }),
    f("arg.default", "Arg", ["="], { implemented: true, phase: 2, weight: "uncommon" }),
    f("type.scalar.custom", "Type", ["scalar"], { implemented: true, phase: 2 }),
    f("scalar.typedef", "Type", ["@typedef"], { implemented: true, phase: 2, weight: "uncommon", samariumRelevance: "high" }),
    f("desc.type", "Type", ['"""'], { implemented: true, phase: 2, weight: "uncommon", samariumRelevance: "medium" }),
    f("desc.field", "Field", ['"""'], { implemented: true, phase: 2, weight: "uncommon", samariumRelevance: "medium" }),
    f("cycle.object", "Type", [], { implemented: true, phase: 2, weight: "uncommon" }),

    // Phase 3
    f("root.subscription", "Schema", ["Subscription"], { implemented: true, phase: 3 }),
    f("dir.builtin.deprecated", "Directive", ["@deprecated"], { implemented: true, phase: 3 }),
    f("dir.builtin.skip", "Directive", ["@skip"], { implemented: true, phase: 3, samariumRelevance: "medium" }),
    f("dir.builtin.include", "Directive", ["@include"], { implemented: true, phase: 3, samariumRelevance: "medium" }),
    f("dir.custom.field", "Directive", ["@"], { implemented: true, phase: 3 }),
    f("dir.custom.fragment", "Directive", ["FRAGMENT_SPREAD", "INLINE_FRAGMENT"], {
        implemented: true,
        phase: 3,
        weight: "uncommon",
    }),
    f("dir.def", "Directive", ["directive"], { implemented: true, phase: 3 }),
    f("field.deprecated", "Field", ["@deprecated"], { implemented: true, phase: 3 }),
    f("enum.deprecated", "Type", ["@deprecated"], { implemented: true, phase: 3, weight: "uncommon" }),

    // Phase 4
    f("mut.rename.field", "Mutation", [], { implemented: true, phase: 4, weight: "uncommon", samariumRelevance: "medium" }),
    f("mut.add.field", "Mutation", [], { implemented: true, phase: 4, weight: "uncommon", samariumRelevance: "medium" }),
    f("mut.wrap.list", "Mutation", [], { implemented: true, phase: 4, weight: "uncommon", samariumRelevance: "medium" }),
    f("mut.add.unused", "Mutation", [], { implemented: true, phase: 4, weight: "uncommon", samariumRelevance: "medium" }),
    f("mut.desc", "Mutation", [], { implemented: true, phase: 4, weight: "rare", samariumRelevance: "low" }),

    // Phase 5
    f("ext.type", "Extension", ["extend type"], { implemented: true, phase: 5 }),
    f("ext.schema", "Extension", ["extend schema"], { implemented: true, phase: 5, weight: "uncommon" }),
    f("type.unused", "Type", [], { implemented: true, phase: 5, weight: "uncommon", samariumRelevance: "medium" }),
    f("field.deep.nest", "Field", ["[["], { implemented: true, phase: 5, weight: "uncommon" }),
];

export const FEATURE_BY_ID = new Map(FEATURES.map((x) => [x.id, x]));

export function implementedFeatures(): FeatureDef[] {
    return FEATURES.filter((f) => f.implemented);
}

/** Profiles with dedicated combinators (excludes full-random meta-profile). */
export const PHASE5_PROFILES: Profile[] = [
    "minimal",
    "core-api",
    "type-system-heavy",
    "directive-matrix",
    "subscription-root",
    "messy",
    "cyclic-types",
    "schema-extensions",
];

export const PHASE6_PROFILES: Profile[] = [...PHASE5_PROFILES, "full-random"];
