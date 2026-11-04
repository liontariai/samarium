import type { FeatureId, Profile, SizeClass } from "../types.ts";
import type { SizeBudget } from "../size.ts";
import type { Rng } from "../rng.ts";
import type { GraphQLDocument, NamedTypeIR } from "../ast/index.ts";

export type GenContext = {
    rng: Rng;
    profile: Profile;
    size: SizeClass;
    budget: SizeBudget;
    codegenSafeIds: boolean;
    force: Set<FeatureId>;
    forbid: Set<FeatureId>;
    features: Set<FeatureId>;
    typeCount: number;
    fieldCount: number;
    nodeCount: number;
    directiveCount: number;
    usedTypeNames: Set<string>;
    usedDirectiveNames: Set<string>;
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

export function remainingTypes(ctx: GenContext): number {
    return Math.max(0, ctx.budget.maxTypes - ctx.typeCount);
}

export function bumpNodes(ctx: GenContext, n = 1): boolean {
    if (ctx.nodeCount + n > ctx.budget.maxNodes) return false;
    ctx.nodeCount += n;
    return true;
}

export function emptyDocument(): GraphQLDocument {
    return { types: [], directives: [] };
}

export function findType(doc: GraphQLDocument, name: string): NamedTypeIR | undefined {
    return doc.types.find((t) => t.name === name);
}

export function addType(ctx: GenContext, doc: GraphQLDocument, type: NamedTypeIR): void {
    doc.types.push(type);
    ctx.usedTypeNames.add(type.name);
    ctx.typeCount++;
    bumpNodes(ctx, 1 + ("fields" in type ? type.fields.length : 0));
}
