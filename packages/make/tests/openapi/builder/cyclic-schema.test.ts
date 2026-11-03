import { describe, expect, it } from "bun:test";
import type { OpenAPI3 } from "openapi-typescript";
import { gatherMeta } from "@/openapi/builder/meta";
import { Collector } from "@/openapi/builder/collector";
import { OpenAPIGenerator, Flavors } from "../../../src/index.ts";

const cycleDoc = {
    openapi: "3.1.0",
    info: { title: "t", version: "1" },
    paths: {},
    components: {
        schemas: {
            CycleNode: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    child: { $ref: "#/components/schemas/CycleNode" },
                },
                required: ["id"],
            },
            CycleA: {
                type: "object",
                properties: { next: { $ref: "#/components/schemas/CycleB" } },
            },
            CycleB: {
                type: "object",
                properties: { next: { $ref: "#/components/schemas/CycleA" } },
            },
        },
    },
} as unknown as OpenAPI3;

const paramRefDoc = {
    openapi: "3.0.0",
    info: { title: "t", version: "1" },
    paths: {
        "/albums/{id}": {
            parameters: [{ $ref: "#/components/parameters/AlbumId" }],
            get: {
                operationId: "getAlbum",
                parameters: [{ $ref: "#/components/parameters/Market" }],
                responses: {
                    "200": {
                        description: "ok",
                        content: { "application/json": { schema: { type: "string" } } },
                    },
                },
            },
        },
    },
    components: {
        parameters: {
            AlbumId: { name: "id", in: "path", required: true, schema: { type: "string" } },
            Market: { name: "market", in: "query", schema: { type: "string" } },
        },
    },
} as unknown as OpenAPI3;

const pathItemRefDoc = {
    openapi: "3.1.0",
    info: { title: "t", version: "1" },
    paths: {
        "/items/{id}": { $ref: "#/components/pathItems/Item" },
    },
    components: {
        parameters: {
            ItemId: { name: "id", in: "path", required: true, schema: { type: "string" } },
        },
        pathItems: {
            Item: {
                parameters: [{ $ref: "#/components/parameters/ItemId" }],
                get: {
                    operationId: "getItem",
                    responses: {
                        "2XX": {
                            description: "ok",
                            content: { "application/json": { schema: { type: "object" } } },
                        },
                    },
                },
            },
        },
    },
} as unknown as OpenAPI3;

describe("cyclic components.schemas", () => {
    it("gatherMeta does not stack-overflow on self-ref and mutual cycles", () => {
        const collector = new Collector();
        const meta = gatherMeta(cycleDoc, {}, collector);
        const cycleNode = meta.types.find((t) => t.name === "CycleNode");
        expect(cycleNode).toBeDefined();
        expect(cycleNode!.fields.some((f) => f.name === "child")).toBe(true);
        const child = cycleNode!.fields.find((f) => f.name === "child")!;
        expect(child.type.name.replaceAll("!", "")).toBe("CycleNode");
    });

    it("Generator.generate succeeds on cyclic schemas", async () => {
        const sdk = await new OpenAPIGenerator.Generator(Flavors.OpenAPI.default).generate({
            schema: cycleDoc,
            options: {},
        });
        expect(sdk.length).toBeGreaterThan(100);
    });
});

describe("parameter and path-item $ref", () => {
    it("resolves parameter $ref name/in and merges path-level params", () => {
        const meta = gatherMeta(paramRefDoc, {}, new Collector());
        expect(meta.operations).toHaveLength(1);
        const args = meta.operations[0].args;
        expect(args.map((a) => ({ name: a.name, loc: a.location }))).toEqual([
            { name: "id", loc: "path" },
            { name: "market", loc: "query" },
        ]);
        expect(args.find((a) => a.name === "id")!.type.isNonNull).toBe(true);
    });

    it("dereferences path-item $ref and accepts 2XX response patterns", () => {
        const meta = gatherMeta(pathItemRefDoc, {}, new Collector());
        expect(meta.operations).toHaveLength(1);
        expect(meta.operations[0].name).toBe("getItem");
        expect(meta.operations[0].args.map((a) => a.name)).toEqual(["id"]);
    });
});
