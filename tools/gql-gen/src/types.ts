export type Profile =
    | "minimal"
    | "core-api"
    | "type-system-heavy"
    | "directive-matrix"
    | "subscription-root"
    | "messy"
    | "cyclic-types"
    | "schema-extensions"
    | "full-random";

export type SizeClass = "xs" | "s" | "m" | "l";

export type FeatureId = string;

export type GenerateOptions = {
    seed: number;
    profile?: Profile;
    size?: SizeClass;
    features?: FeatureId[];
    forbid?: FeatureId[];
    /** Default true: identifiers safe for TypeScript codegen. */
    codegenSafeIds?: boolean;
};

export type GeneratedMeta = {
    seed: number;
    profile: Profile;
    /** When `profile` is `full-random`, the concrete profile that was generated. */
    resolvedProfile: Profile;
    size: SizeClass;
    features: FeatureId[];
    mutations: string[];
    bytes: number;
    hash: string;
};

export type GeneratedSpec = {
    ir: import("./ast/index.ts").GraphQLDocument;
    files: Record<string, string>;
    meta: GeneratedMeta;
};

export type SemanticError = {
    code: string;
    path: string;
    message: string;
};

export type LayerResult = {
    ok: boolean;
    errors: unknown[];
};

export type Verdict = {
    parse: boolean;
    structural: LayerResult;
    semantic: { ok: boolean; errors: SemanticError[] };
    roundTrip: LayerResult;
    acceptedAsValidFixture: boolean;
};

export type CoverageCell = {
    id: FeatureId;
    implemented: boolean;
    observed: number;
};

export type CoverageReport = {
    total: number;
    implemented: number;
    observed: number;
    byFeature: CoverageCell[];
    markdown: string;
};
