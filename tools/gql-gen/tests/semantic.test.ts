import { describe, expect, it } from "bun:test";
import { named, nonNull, type GraphQLDocument } from "../src/ast/index.ts";
import { semanticCheck } from "../src/val/index.ts";
import { repair } from "../src/cons/repair.ts";

describe("semantic", () => {
    it("rejects dangling type refs", () => {
        const doc: GraphQLDocument = {
            schema: { query: "Query" },
            types: [
                {
                    kind: "object",
                    name: "Query",
                    fields: [{ name: "x", type: named("Missing") }],
                },
            ],
            directives: [],
        };
        const r = semanticCheck(doc);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => e.code === "DANGLING_TYPE")).toBe(true);
    });

    it("repair stubs dangling refs and restores Query", () => {
        const doc: GraphQLDocument = {
            types: [
                {
                    kind: "object",
                    name: "Foo",
                    fields: [{ name: "x", type: named("Missing") }],
                },
            ],
            directives: [],
        };
        const fixed = repair(doc);
        expect(fixed.schema?.query).toBe("Query");
        const r = semanticCheck(fixed);
        expect(r.ok).toBe(true);
    });

    it("flags @oneOf non-null fields", () => {
        const doc: GraphQLDocument = {
            schema: { query: "Query" },
            types: [
                { kind: "object", name: "Query", fields: [{ name: "h", type: named("String") }] },
                {
                    kind: "inputObject",
                    name: "By",
                    isOneOf: true,
                    fields: [{ name: "id", type: nonNull(named("ID")) }],
                },
            ],
            directives: [],
        };
        const r = semanticCheck(doc);
        expect(r.errors.some((e) => e.code === "ONEOF_NULLABLE")).toBe(true);
    });
});
