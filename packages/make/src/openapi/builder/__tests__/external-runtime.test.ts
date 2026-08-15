import { describe, expect, it } from "bun:test";
import type { OpenAPI3 } from "openapi-typescript";
import { Generator } from "../generator";
import { GeneratorSelectionTypeFlavorDefault } from "../../flavors/default/generator-flavor";

const booksSpec = {
    openapi: "3.0.3",
    info: { title: "Books", version: "1.0.0" },
    paths: {
        "/books": {
            get: {
                operationId: "listBooks",
                responses: {
                    "200": {
                        description: "ok",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "array",
                                    items: { $ref: "#/components/schemas/Book" },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                operationId: "createBooks",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["titles", "authors"],
                                properties: {
                                    titles: { type: "array", items: { type: "string" } },
                                    authors: { type: "array", items: { type: "string" } },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "ok",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "array",
                                    items: { $ref: "#/components/schemas/Book" },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    components: {
        schemas: {
            Book: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    author: { type: "string" },
                },
            },
        },
    },
} as unknown as OpenAPI3;

describe("OpenAPI generate runtime: external", () => {
    it("emits wrapper imports and does not inline RootOperation / SelectionWrapper classes", async () => {
        const generator = new Generator(GeneratorSelectionTypeFlavorDefault);
        const code = await generator.generate({
            schema: booksSpec,
            options: {},
            runtime: "external",
            externalRuntime: {
                wrapperModule: "@/openapi/flavors/default/wrapper",
            },
        });

        expect(code).toContain("@samarium-runtime external");
        expect(code).toContain('from "@/openapi/flavors/default/wrapper"');
        expect(code).toContain("SelectionWrapper");
        expect(code).toContain("RootOperation");
        expect(code).toContain("makeSLFN");
        expect(code).toContain("_makeRootOperationInput");

        // Must not embed the runtime class bodies
        expect(code).not.toContain("export class RootOperation");
        expect(code).not.toContain("export class SelectionWrapper");
        expect(code).not.toContain("export class SelectionWrapperImpl");
        expect(code).not.toContain("export class OperationSelectionCollector");
    });

    it("requires externalRuntime.wrapperModule when runtime is external", async () => {
        const generator = new Generator(GeneratorSelectionTypeFlavorDefault);
        await expect(
            generator.generate({
                schema: booksSpec,
                options: {},
                runtime: "external",
            }),
        ).rejects.toThrow(/wrapperModule/);
    });

    it("still embeds runtime classes when runtime is embedded (default)", async () => {
        const generator = new Generator(GeneratorSelectionTypeFlavorDefault);
        const code = await generator.generate({
            schema: booksSpec,
            options: {},
            authConfig: { headerName: "Authorization" },
        });

        expect(code).toContain("export class RootOperation");
        expect(code).toContain('authHeaderName = "Authorization"');
        expect(code).not.toContain("[AUTH_HEADER_NAME]");
    });
});
