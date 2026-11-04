export type Dialect = "3.0" | "3.1";

export type Profile =
    | "minimal"
    | "core-rest"
    | "schema-heavy"
    | "param-matrix"
    | "media-matrix"
    | "security-matrix"
    | "callback-webhook"
    | "ref-graph"
    | "multi-file"
    | "messy"
    | "full-random";

export type SizeClass = "xs" | "s" | "m" | "l";

export type FeatureId = string;

export type GenerateOptions = {
    seed: number;
    dialect?: Dialect;
    profile?: Profile;
    size?: SizeClass;
    format?: "json" | "yaml" | "both";
    features?: FeatureId[];
    forbid?: FeatureId[];
    multiFile?: boolean;
    /** Default `stable`. `shuffle` is also implied by `ref-graph` / `multi-file`. */
    keyOrder?: "stable" | "shuffle";
    /** Default `block`. `flow` is also implied by odd-seed `ref-graph`. */
    yamlStyle?: "block" | "flow";
    /** Default true: identifiers safe for TypeScript codegen. */
    codegenSafeIds?: boolean;
};

export type GeneratedMeta = {
    seed: number;
    dialect: Dialect;
    profile: Profile;
    size: SizeClass;
    features: FeatureId[];
    mutations: string[];
    bytes: number;
    hash: string;
};

export type GeneratedSpec = {
    ir: import("./ast/index.ts").OpenAPIDocument;
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
    officialSchema: LayerResult;
    semantic: { ok: boolean; errors: SemanticError[] };
    dereference: LayerResult;
    redocly?: { ok: boolean; issues: unknown[] };
    acceptedAsValidFixture: boolean;
};

export type CoverageCell = {
    id: FeatureId;
    implemented: boolean;
    observed: number;
    dialectsObserved: Dialect[];
};

export type CoverageReport = {
    total: number;
    implemented: number;
    observed: number;
    byFeature: CoverageCell[];
    markdown: string;
};
