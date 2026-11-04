import type { Dialect, FeatureId, Profile, SizeClass } from "../types.ts";
import type { SizeBudget } from "../size.ts";
import type { DialectTable } from "../dialects/index.ts";
import type { Rng } from "../rng.ts";
import type { OpenAPIDocument, SchemaIR } from "../ast/index.ts";

export type GenContext = {
    rng: Rng;
    dialect: Dialect;
    dialectTable: DialectTable;
    profile: Profile;
    size: SizeClass;
    budget: SizeBudget;
    codegenSafeIds: boolean;
    force: Set<FeatureId>;
    forbid: Set<FeatureId>;
    features: Set<FeatureId>;
    /** Schema names already fully generated (safe to $ref). */
    finishedSchemas: string[];
    schemaCount: number;
    pathCount: number;
    opCount: number;
    nodeCount: number;
    operationIds: Set<string>;
    securitySchemeNames: string[];
    tagNames: string[];
};

export function canMark(ctx: GenContext, id: FeatureId): boolean {
    if (ctx.forbid.has(id)) return false;
    return true;
}

export function mark(ctx: GenContext, id: FeatureId): void {
    if (!canMark(ctx, id)) return;
    ctx.features.add(id);
}

export function wants(ctx: GenContext, id: FeatureId): boolean {
    return ctx.force.has(id) && canMark(ctx, id);
}

export function chance(ctx: GenContext, id: FeatureId, p: number): boolean {
    if (!canMark(ctx, id)) return false;
    if (ctx.force.has(id)) return true;
    return ctx.rng.bool(p);
}

export function remainingOps(ctx: GenContext): number {
    return Math.max(0, ctx.budget.maxOps - ctx.opCount);
}

export function remainingPaths(ctx: GenContext): number {
    return Math.max(0, ctx.budget.maxPaths - ctx.pathCount);
}

export function remainingSchemas(ctx: GenContext): number {
    return Math.max(0, ctx.budget.maxSchemas - ctx.schemaCount);
}

export function bumpNodes(ctx: GenContext, n = 1): boolean {
    if (ctx.nodeCount + n > ctx.budget.maxNodes) return false;
    ctx.nodeCount += n;
    return true;
}

export function emptyDocument(): OpenAPIDocument {
    return {
        openapi: "3.0.3",
        info: { title: "Generated API", version: "1.0.0" },
        paths: {},
        components: { schemas: {} },
    };
}

export type SchemaRef = { kind: "ref"; target: { table: "schemas"; name: string } };

export function schemaRef(name: string): SchemaIR {
    return { kind: "ref", target: { table: "schemas", name } };
}
