import type { LayerResult } from "../types.ts";

type Parser = {
    dereference: (doc: unknown, opts?: unknown) => Promise<unknown>;
};

let parserPromise: Promise<Parser | null> | undefined;

async function loadParser(): Promise<Parser | null> {
    if (!parserPromise) {
        parserPromise = import("@apidevtools/swagger-parser")
            .then((mod) => {
                const Sp = (mod as { default?: Parser }).default ?? (mod as unknown as Parser);
                if (typeof Sp.dereference === "function") return Sp;
                return null;
            })
            .catch(() => null);
    }
    return parserPromise;
}

function isObj(x: unknown): x is Record<string, unknown> {
    return !!x && typeof x === "object" && !Array.isArray(x);
}

function resolvePointer(doc: Record<string, unknown>, ref: string): unknown {
    if (!ref.startsWith("#/")) return undefined;
    const parts = ref
        .slice(2)
        .split("/")
        .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
    let cur: unknown = doc;
    for (const p of parts) {
        if (!isObj(cur) && !Array.isArray(cur)) return undefined;
        cur = (cur as Record<string, unknown>)[p];
        if (cur === undefined) return undefined;
    }
    return cur;
}

function internalDereference(doc: unknown): LayerResult {
    if (!isObj(doc)) return { ok: false, errors: ["document is not an object"] };
    const errors: string[] = [];
    const seen = new Set<unknown>();
    const walk = (node: unknown, path: string): void => {
        if (!node || typeof node !== "object") return;
        if (seen.has(node)) return;
        seen.add(node);
        if (Array.isArray(node)) {
            node.forEach((x, i) => walk(x, `${path}/${i}`));
            return;
        }
        const obj = node as Record<string, unknown>;
        if (typeof obj.$ref === "string") {
            if (obj.$ref.startsWith("#/")) {
                if (resolvePointer(doc, obj.$ref) === undefined) {
                    errors.push(`${path}: dangling $ref ${obj.$ref}`);
                }
            }
        }
        for (const [k, v] of Object.entries(obj)) {
            if (k === "$ref") continue;
            walk(v, `${path}/${k}`);
        }
    };
    walk(doc, "");
    return { ok: errors.length === 0, errors };
}

/**
 * Prefer swagger-parser; fall back to an internal JSON Pointer walk so Phase 1
 * stays usable if the parser cannot load OAS 3.1.
 */
export async function dereference(doc: unknown): Promise<LayerResult> {
    const internal = internalDereference(doc);
    const parser = await loadParser();
    if (!parser) return internal;
    try {
        await parser.dereference(structuredClone(doc), {
            dereference: { circular: "ignore" },
            resolve: { http: false, external: false },
        });
        if (!internal.ok) {
            return { ok: true, errors: [{ tool_disagreement: true, internal: internal.errors }] };
        }
        return { ok: true, errors: [] };
    } catch (e) {
        if (internal.ok) {
            return {
                ok: true,
                errors: [{ tool_disagreement: true, swaggerParser: String(e) }],
            };
        }
        return { ok: false, errors: [e, ...internal.errors] };
    }
}
