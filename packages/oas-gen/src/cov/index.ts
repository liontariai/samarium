import { FEATURES, featuresForDialect } from "../catalog/features.ts";
import type { CoverageCell, CoverageReport, Dialect, GeneratedSpec } from "../types.ts";

export function coverage(docs: GeneratedSpec[]): CoverageReport {
    const counts = new Map<string, { n: number; dialects: Set<Dialect> }>();
    for (const doc of docs) {
        for (const id of doc.meta.features) {
            const cur = counts.get(id) ?? { n: 0, dialects: new Set<Dialect>() };
            cur.n++;
            cur.dialects.add(doc.meta.dialect);
            counts.set(id, cur);
        }
    }

    const byFeature: CoverageCell[] = FEATURES.map((f) => {
        const hit = counts.get(f.id);
        return {
            id: f.id,
            implemented: f.implemented,
            observed: hit?.n ?? 0,
            dialectsObserved: hit ? ([...hit.dialects] as Dialect[]) : [],
        };
    });

    const implemented = FEATURES.filter((f) => f.implemented).length;
    const observed = byFeature.filter((c) => c.observed > 0).length;

    const header = `| id | implemented | observed | dialects |\n|---|---|---|---|`;
    const rows = byFeature
        .map((c) => `| \`${c.id}\` | ${c.implemented ? "yes" : ""} | ${c.observed} | ${c.dialectsObserved.join(", ")} |`)
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

export function phase1CoverageGap(docs: GeneratedSpec[], dialect: Dialect): string[] {
    const seen = new Set(docs.flatMap((d) => d.meta.features));
    return featuresForDialect(dialect)
        .filter((f) => f.implemented && f.phase === 1)
        .map((f) => f.id)
        .filter((id) => !seen.has(id));
}
