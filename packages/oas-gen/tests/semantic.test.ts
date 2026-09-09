import { describe, expect, it } from "bun:test";
import { generate, mutate, semanticCheck, validate } from "../src/index.ts";
import { documentToJson } from "../src/ser/index.ts";

describe("semantic layer", () => {
    it("rejects a path template without a matching path parameter", () => {
        const doc = {
            openapi: "3.0.3",
            info: { title: "x", version: "1" },
            paths: {
                "/items/{id}": {
                    get: {
                        responses: { "200": { description: "ok" } },
                    },
                },
            },
        };
        const { ok, errors } = semanticCheck(doc, "3.0");
        expect(ok).toBe(false);
        expect(errors.some((e) => e.code === "path.param.missing")).toBe(true);
    });

    it("rejects dangling security schemes", () => {
        const doc = {
            openapi: "3.1.0",
            info: { title: "x", version: "1" },
            paths: {
                "/ping": {
                    get: {
                        responses: { "200": { description: "ok" } },
                    },
                },
            },
            security: [{ missing: [] }],
        };
        const { ok, errors } = semanticCheck(doc, "3.1");
        expect(ok).toBe(false);
        expect(errors.some((e) => e.code === "security.unknown")).toBe(true);
    });

    it("accepts a generated core-rest document", async () => {
        const spec = generate({ seed: 0, dialect: "3.0", profile: "core-rest" });
        const v = await validate(documentToJson(spec.ir), "3.0");
        expect(v.acceptedAsValidFixture).toBe(true);
    });
});

describe("public API stubs", () => {
    it("mutate is implemented", () => {
        const spec = generate({ seed: 1, dialect: "3.0", profile: "minimal" });
        const next = mutate(spec, { seed: 2, n: 1 });
        expect(next.meta.mutations.length).toBeGreaterThan(0);
    });

    it("unknown profiles throw", () => {
        expect(() => generate({ seed: 1, profile: "full-random" })).toThrow(/not implemented/);
    });
});
