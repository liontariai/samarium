import type { SizeClass } from "../types.ts";

export type SizeBudget = {
    maxPaths: number;
    maxOps: number;
    maxSchemas: number;
    maxDepth: number;
    maxNodes: number;
};

export const SIZE_BUDGETS: Record<SizeClass, SizeBudget> = {
    xs: { maxPaths: 1, maxOps: 1, maxSchemas: 5, maxDepth: 2, maxNodes: 40 },
    s: { maxPaths: 5, maxOps: 8, maxSchemas: 15, maxDepth: 3, maxNodes: 200 },
    m: { maxPaths: 20, maxOps: 40, maxSchemas: 40, maxDepth: 4, maxNodes: 800 },
    l: { maxPaths: 80, maxOps: 160, maxSchemas: 100, maxDepth: 5, maxNodes: 3000 },
};

export function defaultSizeForProfile(profile: string): SizeClass {
    if (profile === "minimal") return "xs";
    if (profile === "schema-heavy" || profile === "param-matrix" || profile === "media-matrix") return "m";
    if (profile === "security-matrix" || profile === "callback-webhook") return "m";
    if (profile === "ref-graph" || profile === "multi-file") return "s";
    return "s";
}
