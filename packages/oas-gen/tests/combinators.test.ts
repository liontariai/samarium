import { describe, expect, it } from "bun:test";
import { generate } from "../src/generate.ts";
import { pathTemplateTokens } from "../src/cons/repair.ts";
import { documentToJson } from "../src/ser/index.ts";
import { HTTP_METHODS } from "../src/ast/index.ts";

function operations(json: Record<string, unknown>) {
    const paths = (json.paths ?? {}) as Record<string, Record<string, unknown>>;
    const out: Array<{ path: string; method: string; op: Record<string, unknown> }> = [];
    for (const [path, item] of Object.entries(paths)) {
        for (const method of HTTP_METHODS) {
            if (item[method] && typeof item[method] === "object") {
                out.push({ path, method, op: item[method] as Record<string, unknown> });
            }
        }
    }
    return out;
}

function paramsOf(item: Record<string, unknown>, op: Record<string, unknown>) {
    const a = Array.isArray(item.parameters) ? item.parameters : [];
    const b = Array.isArray(op.parameters) ? op.parameters : [];
    return [...a, ...b] as Array<Record<string, unknown>>;
}

describe("combinators", () => {
    it("path parameters are always required:true and in:path", () => {
        for (let seed = 0; seed < 40; seed++) {
            for (const dialect of ["3.0", "3.1"] as const) {
                const spec = generate({ seed, dialect, profile: "core-rest" });
                const json = documentToJson(spec.ir) as Record<string, unknown>;
                const paths = (json.paths ?? {}) as Record<string, Record<string, unknown>>;
                for (const { path, op } of operations(json)) {
                    const item = paths[path]!;
                    for (const p of paramsOf(item, op)) {
                        if (p.in === "path") {
                            expect(p.required).toBe(true);
                        }
                    }
                }
            }
        }
    });

    it("every {template} token has a matching path parameter", () => {
        for (let seed = 0; seed < 40; seed++) {
            const spec = generate({ seed, dialect: "3.1", profile: "core-rest" });
            const json = documentToJson(spec.ir) as Record<string, unknown>;
            const paths = (json.paths ?? {}) as Record<string, Record<string, unknown>>;
            for (const { path, op } of operations(json)) {
                const tokens = pathTemplateTokens(path);
                const names = paramsOf(paths[path]!, op)
                    .filter((p) => p.in === "path")
                    .map((p) => p.name);
                for (const t of tokens) {
                    expect(names).toContain(t);
                }
            }
        }
    });

    it("schema-heavy emits composition and discriminator", () => {
        const spec = generate({ seed: 3, dialect: "3.1", profile: "schema-heavy" });
        const json = documentToJson(spec.ir) as Record<string, unknown>;
        const schemas = ((json.components as { schemas?: Record<string, Record<string, unknown>> } | undefined)?.schemas ??
            {}) as Record<string, Record<string, unknown>>;
        expect(Object.values(schemas).some((s) => Array.isArray(s.allOf))).toBe(true);
        expect(Object.values(schemas).some((s) => Array.isArray(s.oneOf) && isObj(s.discriminator))).toBe(true);
        expect(spec.meta.features).toContain("schema.discriminator");
        expect(spec.meta.features).toContain("schema.format.uuid");
    });
});

function isObj(x: unknown): x is Record<string, unknown> {
    return !!x && typeof x === "object" && !Array.isArray(x);
}
