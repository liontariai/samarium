import type { Rng } from "../rng.ts";

/** Recursively rebuild objects with a seeded key order. Arrays keep element order. */
export function shuffleKeys(node: unknown, rng: Rng): unknown {
    if (Array.isArray(node)) return node.map((x) => shuffleKeys(x, rng));
    if (!node || typeof node !== "object") return node;
    const keys = rng.shuffle(Object.keys(node as object));
    const out: Record<string, unknown> = {};
    for (const k of keys) {
        out[k] = shuffleKeys((node as Record<string, unknown>)[k], rng);
    }
    return out;
}
