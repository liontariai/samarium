import type { SizeClass } from "./types.ts";

export type SizeBudget = {
    maxTypes: number;
    maxFieldsPerType: number;
    maxArgs: number;
    maxDepth: number;
    maxNodes: number;
    maxDirectives: number;
};

export const SIZE_BUDGETS: Record<SizeClass, SizeBudget> = {
    xs: { maxTypes: 3, maxFieldsPerType: 2, maxArgs: 1, maxDepth: 2, maxNodes: 40, maxDirectives: 0 },
    s: { maxTypes: 12, maxFieldsPerType: 6, maxArgs: 3, maxDepth: 3, maxNodes: 200, maxDirectives: 3 },
    m: { maxTypes: 40, maxFieldsPerType: 12, maxArgs: 5, maxDepth: 4, maxNodes: 800, maxDirectives: 8 },
    l: { maxTypes: 100, maxFieldsPerType: 20, maxArgs: 8, maxDepth: 5, maxNodes: 3000, maxDirectives: 20 },
};

export function defaultSizeForProfile(profile: string): SizeClass {
    if (profile === "minimal") return "xs";
    if (profile === "type-system-heavy" || profile === "directive-matrix") return "m";
    if (profile === "cyclic-types" || profile === "schema-extensions") return "s";
    return "s";
}
