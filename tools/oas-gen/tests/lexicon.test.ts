import { describe, expect, it } from "bun:test";
import { generate } from "../src/generate.ts";
import { documentToJson } from "../src/ser/index.ts";
import { LEGAL_STYLE } from "../src/dialects/index.ts";
import { HTTP_METHODS } from "../src/ast/index.ts";

function allParams(json: Record<string, unknown>) {
    const paths = (json.paths ?? {}) as Record<string, Record<string, unknown>>;
    const out: Array<Record<string, unknown>> = [];
    for (const item of Object.values(paths)) {
        if (Array.isArray(item.parameters)) out.push(...(item.parameters as Record<string, unknown>[]));
        for (const method of HTTP_METHODS) {
            const op = item[method] as Record<string, unknown> | undefined;
            if (op && Array.isArray(op.parameters)) out.push(...(op.parameters as Record<string, unknown>[]));
        }
    }
    return out;
}

describe("lexicon variety", () => {
    it("core-rest query param names are not always limit/q", () => {
        const names = new Set<string>();
        for (let seed = 0; seed < 30; seed++) {
            const spec = generate({ seed, dialect: "3.1", profile: "core-rest" });
            const json = documentToJson(spec.ir) as Record<string, unknown>;
            for (const p of allParams(json)) {
                if (p.in === "query" && typeof p.name === "string") names.add(p.name);
            }
        }
        expect(names.size).toBeGreaterThan(8);
        expect([...names].some((n) => n !== "limit" && n !== "q")).toBe(true);
    });

    it("core-rest schema names vary across seeds", () => {
        const schemas = new Set<string>();
        for (let seed = 0; seed < 20; seed++) {
            const spec = generate({ seed, dialect: "3.0", profile: "core-rest" });
            const json = documentToJson(spec.ir) as Record<string, unknown>;
            const comps = (json.components as { schemas?: Record<string, unknown> } | undefined)?.schemas ?? {};
            for (const k of Object.keys(comps)) schemas.add(k);
        }
        expect(schemas.size).toBeGreaterThan(5);
    });
});

describe("param-matrix", () => {
    it("every parameter style is legal for its in", () => {
        for (const dialect of ["3.0", "3.1"] as const) {
            const spec = generate({ seed: 1, dialect, profile: "param-matrix" });
            const json = documentToJson(spec.ir) as Record<string, unknown>;
            for (const p of allParams(json)) {
                const inn = p.in as keyof typeof LEGAL_STYLE;
                if (typeof p.style === "string" && inn in LEGAL_STYLE) {
                    expect(LEGAL_STYLE[inn]).toContain(p.style);
                }
                if (p.in === "path") expect(p.required).toBe(true);
                expect(p.schema !== undefined || p.content !== undefined).toBe(true);
                expect(!!p.schema && !!p.content).toBe(false);
            }
        }
    });

    it("content parameters omit style, explode, example, and examples", () => {
        for (const dialect of ["3.0", "3.1"] as const) {
            const spec = generate({ seed: 8, dialect, profile: "param-matrix" });
            const json = documentToJson(spec.ir) as Record<string, unknown>;
            const contentParams = allParams(json).filter((p) => p.content);
            expect(contentParams.length).toBeGreaterThan(0);
            for (const p of contentParams) {
                expect(p.style).toBeUndefined();
                expect(p.explode).toBeUndefined();
                expect(p.example).toBeUndefined();
                expect(p.examples).toBeUndefined();
                expect(p.schema).toBeUndefined();
                expect(p.allowReserved).toBeUndefined();
            }
        }
    });
});
