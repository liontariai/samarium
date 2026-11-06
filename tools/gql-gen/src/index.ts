export type {
    Profile,
    SizeClass,
    FeatureId,
    GenerateOptions,
    GeneratedSpec,
    GeneratedMeta,
    SemanticError,
    Verdict,
    CoverageReport,
    CoverageCell,
} from "./types.ts";

export { generate, stream, mutate, shrink } from "./generate.ts";
export { validate, semanticCheck, parseSdl } from "./val/index.ts";
export { coverage, phaseCoverageGap } from "./cov/index.ts";
export { oracle, compileSpec, shrinkOracleFailure, writeRepro, typecheckSdk } from "./oracle/index.ts";
export type { OracleVerdict, OracleOptions, OracleCompile, OracleTypecheck } from "./oracle/index.ts";
export { FEATURES, FEATURE_BY_ID, implementedFeatures, PHASE5_PROFILES, PHASE6_PROFILES } from "./catalog/index.ts";
export { toSdl, toStableSdl, printTypeRef } from "./ser/index.ts";
export { repair } from "./cons/repair.ts";
export { SIZE_BUDGETS } from "./size.ts";
