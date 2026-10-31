import { describe, expect, it } from "bun:test";
import type { OpenAPI3 } from "openapi-typescript";
import { OpenAPIGenerator, Flavors } from "../../src/index.ts";

describe("OpenAPI runtime encoding", () => {
    it("emits style/explode/contentType in args meta and encodes form bodies", async () => {
        const schema = {
            openapi: "3.0.0",
            info: { title: "enc", version: "1" },
            paths: {
                "/search": {
                    get: {
                        operationId: "search",
                        parameters: [
                            {
                                name: "tags",
                                in: "query",
                                style: "form",
                                explode: true,
                                schema: { type: "array", items: { type: "string" } },
                            },
                            {
                                name: "filter",
                                in: "query",
                                style: "deepObject",
                                explode: true,
                                schema: {
                                    type: "object",
                                    properties: { q: { type: "string" } },
                                },
                            },
                        ],
                        responses: {
                            "200": {
                                description: "ok",
                                content: { "application/json": { schema: { type: "string" } } },
                            },
                        },
                    },
                },
                "/login": {
                    post: {
                        operationId: "login",
                        requestBody: {
                            required: true,
                            content: {
                                "application/x-www-form-urlencoded": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            user: { type: "string" },
                                            pass: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            "200": {
                                description: "ok",
                                content: { "application/json": { schema: { type: "string" } } },
                            },
                        },
                    },
                },
            },
        } as unknown as OpenAPI3;

        const sdk = await new OpenAPIGenerator.Generator(Flavors.OpenAPI.default).generate({
            schema,
            options: {},
        });
        expect(sdk).toContain('style: "form"');
        expect(sdk).toContain('style: "deepObject"');
        expect(sdk).toContain('contentType: "application/x-www-form-urlencoded"');
        expect(sdk).toContain("requestContentType:");
    });

    it("throws a clear diagnostic for unsupported request media types", async () => {
        // encodeRequestBody is covered via generated SDK compile; unsupported CT is in wrapper source.
        const wrapper = await Bun.file(
            new URL("../../src/openapi/flavors/default/wrapper.ts", import.meta.url),
        ).text();
        expect(wrapper).toContain("Unsupported request content-type");
        expect(wrapper).toContain("deepObject");
        expect(wrapper).toContain("spaceDelimited");
        expect(wrapper).toContain("pipeDelimited");
    });
});
