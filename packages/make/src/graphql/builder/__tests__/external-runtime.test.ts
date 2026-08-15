import { describe, expect, it } from "bun:test";
import { buildSchema } from "graphql";
import { Generator } from "../generator";
import { GeneratorSelectionTypeFlavorDefault } from "../../flavors/default/generator-flavor";

const booksSdl = `
type Book {
    title: String
    author: String
}
type Query {
    books: [Book]
}
type Mutation {
    createBooks(titles: [String]!, authors: [String]!): [Book]
}
`;

describe("GraphQL generate runtime: external", () => {
    it("emits wrapper imports and does not inline RootOperation / SelectionWrapper classes", async () => {
        const generator = new Generator(GeneratorSelectionTypeFlavorDefault);
        const code = await generator.generate({
            schema: buildSchema(booksSdl),
            options: {},
            runtime: "external",
            externalRuntime: {
                wrapperModule: "@/graphql/flavors/default/wrapper",
            },
        });

        expect(code).toContain('@samarium-runtime external');
        expect(code).toContain('from "@/graphql/flavors/default/wrapper"');
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
                schema: buildSchema(booksSdl),
                options: {},
                runtime: "external",
            }),
        ).rejects.toThrow(/wrapperModule/);
    });

    it("emits CustomScalarOrAny aliases for unresolved @typedef names (user override wins)", async () => {
        const sdl = `
"""
@typedef {JToken}
"""
scalar OpaqueToken
type Query {
    token: OpaqueToken
}
`;
        const generator = new Generator(GeneratorSelectionTypeFlavorDefault);
        const code = await generator.generate({
            schema: buildSchema(sdl),
            options: {},
            runtime: "external",
            externalRuntime: {
                wrapperModule: "@/graphql/flavors/default/wrapper",
            },
        });

        expect(code).toContain('type CustomScalarOrAny<K extends string>');
        expect(code).toContain('export type JToken = CustomScalarOrAny<"JToken">');
        expect(code).toMatch(/OpaqueToken":\s*JToken/);
        // Must not pin JToken: any on the interface — that would win over user augmentation
        expect(code).not.toMatch(/interface ScalarTypeMapWithCustom\s*\{[^}]*JToken:\s*any/);
    });

    it("still embeds runtime classes when runtime is embedded (default)", async () => {
        const generator = new Generator(GeneratorSelectionTypeFlavorDefault);
        const code = await generator.generate({
            schema: buildSchema(booksSdl),
            options: {},
            authConfig: { headerName: "Authorization" },
        });

        expect(code).toContain("export class RootOperation");
        expect(code).toContain('authHeaderName = "Authorization"');
        expect(code).not.toContain("[AUTH_HEADER_NAME]");
    });
});
