import { FEATURES } from "../catalog/features.ts";
import type { CoverageCell, CoverageReport, GeneratedSpec } from "../types.ts";

export function coverage(docs: GeneratedSpec[]): CoverageReport {
    const counts = new Map<string, number>();
    for (const doc of docs) {
        for (const id of doc.meta.features) {
            counts.set(id, (counts.get(id) ?? 0) + 1);
        }
    }

    const byFeature: CoverageCell[] = FEATURES.map((f) => ({
        id: f.id,
        implemented: f.implemented,
        observed: counts.get(f.id) ?? 0,
    }));

    const implemented = FEATURES.filter((f) => f.implemented).length;
    const observed = byFeature.filter((c) => c.observed > 0).length;

    const header = `| id | implemented | observed |\n|---|---|---|`;
    const rows = byFeature
        .map((c) => `| \`${c.id}\` | ${c.implemented ? "yes" : ""} | ${c.observed} |`)
        .join("\n");
    const markdown = `${header}\n${rows}\n`;

    return {
        total: FEATURES.length,
        implemented,
        observed,
        byFeature,
        markdown,
    };
}

export function phaseCoverageGap(docs: GeneratedSpec[], phase: number): string[] {
    const seen = new Set(docs.flatMap((d) => d.meta.features));
    return FEATURES.filter((f) => f.implemented && f.phase === phase)
        .map((f) => f.id)
        .filter((id) => !seen.has(id));
}
