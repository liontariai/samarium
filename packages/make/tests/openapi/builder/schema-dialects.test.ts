import { describe, expect, it } from "bun:test";
import type { OpenAPI3 } from "openapi-typescript";
import { Generator } from "@/openapi/builder/generator";
import { GeneratorSelectionTypeFlavorDefault } from "@/openapi/flavors/default/generator-flavor";

/**
 * Required + schema-nullable → `T | null` (field stays required).
 * Optional + schema-nullable → `T?` (nullability is absorbed into optionality).
 */
async function generateSdk(spec: object): Promise<string> {
    const generator = new Generator(GeneratorSelectionTypeFlavorDefault);
    return generator.generate({
        schema: spec as OpenAPI3,
        options: {},
        runtime: "external",
        externalRuntime: {
            wrapperModule: "@/openapi/flavors/default/wrapper",
        },
    });
}

function usersSpec(opts: {
    parameters?: object[];
    response?: object;
    schemas?: Record<string, object>;
}): object {
    return {
        openapi: "3.1.0",
        info: { title: "dialects", version: "1.0.0" },
        paths: {
            "/users": {
                get: {
                    operationId: "getUsers",
                    parameters: opts.parameters ?? [],
                    responses: {
                        "200": {
                            description: "ok",
                            content: {
                                "application/json": {
                                    schema: opts.response ?? { type: "string" },
                                },
                            },
                        },
                    },
                },
            },
        },
        components: { schemas: opts.schemas ?? {} },
    };
}

function expectNoAnyFor(code: string, ident: string) {
    expect(code).not.toMatch(new RegExp(`${ident}\\??:\\s*any\\b`));
}

describe("OpenAPI schema dialects (OAS 3.0 / 3.1)", () => {
    it("1. optional query { type: [\"string\", \"null\"] } → search?: string, meta String", async () => {
        const code = await generateSdk(
            usersSpec({
                parameters: [
                    {
                        name: "search",
                        in: "query",
                        required: false,
                        schema: { type: ["string", "null"] },
                    },
                ],
            }),
        );

        expect(code).toMatch(/search\?:\s*string;/);
        expect(code).toMatch(/type:\s*"String"/);
        expectNoAnyFor(code, "search");
        expect(code).not.toMatch(/type:\s*"search"/);
    });

    it("2. optional query { type: string, nullable: true } → search?: string", async () => {
        const code = await generateSdk(
            usersSpec({
                parameters: [
                    {
                        name: "search",
                        in: "query",
                        required: false,
                        schema: { type: "string", nullable: true },
                    },
                ],
            }),
        );

        expect(code).toMatch(/search\?:\s*string;/);
        expect(code).toMatch(/type:\s*"String"/);
        expectNoAnyFor(code, "search");
    });

    it("3. optional query anyOf string | null → search?: string", async () => {
        const code = await generateSdk(
            usersSpec({
                parameters: [
                    {
                        name: "search",
                        in: "query",
                        required: false,
                        schema: { anyOf: [{ type: "string" }, { type: "null" }] },
                    },
                ],
            }),
        );

        expect(code).toMatch(/search\?:\s*string;/);
        expect(code).toMatch(/type:\s*"String"/);
        expectNoAnyFor(code, "search");
    });

    it("4. { type: \"number\" } property with no format → number, not any", async () => {
        const code = await generateSdk(
            usersSpec({
                response: { $ref: "#/components/schemas/User" },
                schemas: {
                    User: {
                        type: "object",
                        properties: {
                            count: { type: "number" },
                        },
                    },
                },
            }),
        );

        expect(code).toMatch(/count\?:\s*number;/);
        expectNoAnyFor(code, "count");
    });

    it("5. { type: \"integer\" } → number", async () => {
        const code = await generateSdk(
            usersSpec({
                parameters: [
                    {
                        name: "limit",
                        in: "query",
                        required: false,
                        schema: { type: "integer" },
                    },
                ],
            }),
        );

        expect(code).toMatch(/limit\?:\s*number;/);
        expect(code).toMatch(/type:\s*"Int"/);
        expect(code).not.toMatch(/type:\s*"Integer"/);
        expectNoAnyFor(code, "limit");
    });

    it("6. optional object field { type: [\"number\", \"null\"] } → minAge?: number", async () => {
        const code = await generateSdk(
            usersSpec({
                response: { $ref: "#/components/schemas/User" },
                schemas: {
                    User: {
                        type: "object",
                        properties: {
                            minAge: { type: ["number", "null"] },
                        },
                    },
                },
            }),
        );

        expect(code).toMatch(/minAge\?:\s*number;/);
        expectNoAnyFor(code, "minAge");
    });

    it("7. tuple prefixItems without items does not throw; TS is [string, number]", async () => {
        const code = await generateSdk(
            usersSpec({
                response: { $ref: "#/components/schemas/User" },
                schemas: {
                    User: {
                        type: "object",
                        properties: {
                            pair: {
                                type: "array",
                                prefixItems: [
                                    { type: "string", title: "name" },
                                    { type: "number", title: "age" },
                                ],
                                minItems: 2,
                                maxItems: 2,
                            },
                        },
                    },
                },
            }),
        );

        expect(code).toMatch(/\[name:\s*string,\s*age:\s*number\]/);
        expect(code).not.toMatch(/pair\?:\s*any\b/);
        expect(code).not.toMatch(/pair\?:\s*string\s*\|\s*number/);
        expect(code).not.toMatch(/pair\?:\s*string\s*\|\s*any/);
    });

    it("8. tuple with items: false does not throw", async () => {
        const code = await generateSdk(
            usersSpec({
                response: { $ref: "#/components/schemas/User" },
                schemas: {
                    User: {
                        type: "object",
                        properties: {
                            pair: {
                                type: "array",
                                prefixItems: [{ type: "string" }, { type: "number" }],
                                items: false,
                                minItems: 2,
                                maxItems: 2,
                            },
                        },
                    },
                },
            }),
        );

        expect(code).toMatch(/\[string,\s*number\]/);
        expect(code).not.toMatch(/pair\?:\s*any\b/);
    });

    it("9. query param with only content.application/json.schema is a typed object", async () => {
        const code = await generateSdk(
            usersSpec({
                parameters: [
                    {
                        name: "filter",
                        in: "query",
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/Filter" },
                            },
                        },
                    },
                ],
                schemas: {
                    Filter: {
                        type: "object",
                        required: ["q"],
                        properties: {
                            q: { type: "string" },
                        },
                    },
                },
            }),
        );

        expect(code).toMatch(/filter:\s*Filter/);
        expect(code).toMatch(/location:\s*"query"/);
        expect(code).not.toMatch(/location:\s*"body"/);
        expectNoAnyFor(code, "filter");
        expect(code).toMatch(/q:\s*string;/);
    });

    it("10. scalar component with @typedef {Date} Date and format date-time → Date", async () => {
        const code = await generateSdk(
            usersSpec({
                response: { $ref: "#/components/schemas/Event" },
                schemas: {
                    Timestamp: {
                        type: "string",
                        format: "date-time",
                        description: "@typedef {Date} Date",
                    },
                    Event: {
                        type: "object",
                        properties: {
                            at: { $ref: "#/components/schemas/Timestamp" },
                        },
                    },
                },
            }),
        );

        expect(code).toMatch(/at\?:\s*Date;/);
        expectNoAnyFor(code, "at");
    });

    it("11. scalar with @typedef {\"ok\" | \"1\"} Kind → \"ok\" | \"1\", not any", async () => {
        const code = await generateSdk(
            usersSpec({
                response: { $ref: "#/components/schemas/Payload" },
                schemas: {
                    Kind: {
                        type: "string",
                        description: '@typedef {"ok" | "1"} Kind',
                    },
                    Payload: {
                        type: "object",
                        properties: {
                            kind: { $ref: "#/components/schemas/Kind" },
                        },
                    },
                },
            }),
        );

        expect(code).toMatch(/"ok"\s*\|\s*"1"/);
        expect(code).not.toMatch(/kind\?:\s*any\b/);
    });

    it("12. { const: \"x\" } → \"x\"", async () => {
        const code = await generateSdk(
            usersSpec({
                response: { $ref: "#/components/schemas/Flag" },
                schemas: {
                    Flag: {
                        type: "object",
                        properties: {
                            status: { const: "x" },
                        },
                    },
                },
            }),
        );

        expect(code).toMatch(/"x"/);
        expect(code).not.toMatch(/status\?:\s*any\b/);
    });

    it("13. allOf $ref + extra properties merges into one object, not a union", async () => {
        const code = await generateSdk(
            usersSpec({
                response: { $ref: "#/components/schemas/B" },
                schemas: {
                    A: {
                        type: "object",
                        required: ["id"],
                        properties: {
                            id: { type: "string" },
                        },
                    },
                    B: {
                        allOf: [
                            { $ref: "#/components/schemas/A" },
                            {
                                type: "object",
                                properties: {
                                    extra: { type: "string" },
                                },
                            },
                        ],
                    },
                },
            }),
        );

        expect(code).toMatch(/export type B = \{/);
        expect(code).toMatch(/id:\s*string;/);
        expect(code).toMatch(/extra\?:\s*string;/);
        expect(code).not.toMatch(/export type B = A\s*\|/);
        expect(code).not.toMatch(/\$on:\s*\{[\s\S]*B/);
    });

    it("14. required + type [string, null] → string | null (not optional)", async () => {
        const code = await generateSdk(
            usersSpec({
                parameters: [
                    {
                        name: "search",
                        in: "query",
                        required: true,
                        schema: { type: ["string", "null"] },
                    },
                ],
            }),
        );

        expect(code).toMatch(/search:\s*string\s*\|\s*null;/);
        expect(code).not.toMatch(/search\?:\s*string/);
        expectNoAnyFor(code, "search");
    });

    it("oneOf with $ref + null is not a Null union member (no | any)", async () => {
        const code = await generateSdk(
            usersSpec({
                response: { $ref: "#/components/schemas/MaybeBook" },
                schemas: {
                    Book: {
                        type: "object",
                        properties: { title: { type: "string" } },
                    },
                    MaybeBook: {
                        oneOf: [{ $ref: "#/components/schemas/Book" }, { type: "null" }],
                    },
                },
            }),
        );

        expect(code).not.toMatch(/MaybeBook[\s\S]{0,200}\|\s*any\b/);
        expect(code).not.toMatch(/"Null"/);
        expect(code).toMatch(/title\?:\s*string;/);
    });
});
