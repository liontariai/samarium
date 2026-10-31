import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import path from "node:path";
import type { OpenAPI3 } from "openapi-typescript";
import { Generator } from "@/openapi/builder/generator";
import { GeneratorSelectionTypeFlavorDefault } from "@/openapi/flavors/default/generator-flavor";
import { OPTIONS, ROOT_OP_COLLECTOR, RootOperation } from "@/openapi/flavors/default/wrapper";
import { rootSLWFactory } from "./utils";

const GENERATED_PATH = path.join(import.meta.dir, "examples/encoding.generated.ts");

const ENCODING_SPEC = {
    openapi: "3.0.0",
    info: { title: "encoding", version: "1" },
    paths: {
        "/search": {
            get: {
                operationId: "searchForm",
                parameters: [
                    {
                        name: "tags",
                        in: "query",
                        style: "form",
                        explode: true,
                        schema: { type: "array", items: { type: "string" } },
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
        "/q-deep": {
            get: {
                operationId: "searchDeep",
                parameters: [
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
        "/q-space": {
            get: {
                operationId: "searchSpace",
                parameters: [
                    {
                        name: "tags",
                        in: "query",
                        style: "spaceDelimited",
                        explode: false,
                        schema: { type: "array", items: { type: "string" } },
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
        "/q-pipe": {
            get: {
                operationId: "searchPipe",
                parameters: [
                    {
                        name: "tags",
                        in: "query",
                        style: "pipeDelimited",
                        explode: false,
                        schema: { type: "array", items: { type: "string" } },
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
        "/p-simple/{id}": {
            get: {
                operationId: "getSimple",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        style: "simple",
                        schema: { type: "string" },
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
        "/p-label/{id}": {
            get: {
                operationId: "getLabel",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        style: "label",
                        explode: false,
                        schema: { type: "string" },
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
        "/p-matrix/{id}": {
            get: {
                operationId: "getMatrix",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        style: "matrix",
                        explode: false,
                        schema: { type: "string" },
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
        "/json": {
            post: {
                operationId: "postJson",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: { msg: { type: "string" } },
                                required: ["msg"],
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
        "/login": {
            post: {
                operationId: "loginForm",
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
        "/upload": {
            post: {
                operationId: "uploadMultipart",
                requestBody: {
                    required: true,
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                properties: { name: { type: "string" } },
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
        "/xml": {
            post: {
                operationId: "postXml",
                requestBody: {
                    required: true,
                    content: {
                        "application/xml": {
                            schema: {
                                type: "object",
                                properties: { a: { type: "string" } },
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

/** Types from the on-disk generated SDK (refreshed in `beforeAll`). */
type EncodingMakeRoot = (typeof import("./examples/encoding.generated"))["_makeRootOperationInput"];
type EncodingRootOps = ReturnType<EncodingMakeRoot>;

type FetchCall = { url: string; init?: RequestInit };

function resetSdkOptions() {
    RootOperation[OPTIONS].fetcher = undefined as any;
    RootOperation[OPTIONS].sseFetchTransform = undefined as any;
    RootOperation[OPTIONS]._auth_fn = undefined;
    RootOperation[OPTIONS]._auth_token = undefined;
    RootOperation[OPTIONS].headers = {};
    RootOperation.authHeaderName = "Authorization";
}

function installMockFetch(data: unknown = "ok"): { calls: FetchCall[] } {
    const calls: FetchCall[] = [];
    RootOperation[OPTIONS].fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        return {
            ok: true,
            json: async () => data,
            text: async () => (typeof data === "string" ? data : JSON.stringify(data)),
        } as Response;
    }) as any;
    return { calls };
}

async function generateEncodingSdk(): Promise<string> {
    const generator = new Generator(GeneratorSelectionTypeFlavorDefault);
    return generator.generate({
        schema: ENCODING_SPEC,
        options: {},
        runtime: "external",
        externalRuntime: {
            wrapperModule: "@/openapi/flavors/default/wrapper",
        },
    });
}

describe("OpenAPI runtime encoding", () => {
    let makeRoot: EncodingMakeRoot;
    let generatedSource: string;

    async function executeOp<T extends object>(select: (op: EncodingRootOps) => T): Promise<FetchCall[]> {
        const { calls } = installMockFetch();
        const slw = rootSLWFactory(makeRoot, select);
        await slw[ROOT_OP_COLLECTOR]!.ref.execute();
        return calls;
    }

    beforeAll(async () => {
        generatedSource = await generateEncodingSdk();
        await Bun.write(GENERATED_PATH, generatedSource);
        const mod = await import(`./examples/encoding.generated.ts?t=${Date.now()}`);
        makeRoot = mod._makeRootOperationInput;
    });

    afterEach(() => {
        resetSdkOptions();
    });

    it("emits style/explode/contentType in args meta", () => {
        expect(generatedSource).toContain('style: "form"');
        expect(generatedSource).toContain('style: "deepObject"');
        expect(generatedSource).toContain('contentType: "application/x-www-form-urlencoded"');
        expect(generatedSource).toContain("requestContentType:");
    });

    describe("query serialization", () => {
        it("encodes form+explode as repeated query keys", async () => {
            const calls = await executeOp((op) => ({
                search: op.searchForm({ tags: ["a", "b"] }),
            }));
            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe("[ENDPOINT]/search?tags=a&tags=b");
            expect(calls[0].init?.method).toBe("get");
        });

        it("encodes deepObject query params", async () => {
            const calls = await executeOp((op) => ({
                search: op.searchDeep({ filter: { q: "x" } }),
            }));
            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe("[ENDPOINT]/q-deep?filter%5Bq%5D=x");
        });

        it("encodes spaceDelimited arrays", async () => {
            const calls = await executeOp((op) => ({
                search: op.searchSpace({ tags: ["a", "b"] }),
            }));
            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe("[ENDPOINT]/q-space?tags=a+b");
        });

        it("encodes pipeDelimited arrays", async () => {
            const calls = await executeOp((op) => ({
                search: op.searchPipe({ tags: ["a", "b"] }),
            }));
            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe("[ENDPOINT]/q-pipe?tags=a%7Cb");
        });
    });

    describe("path serialization", () => {
        it("encodes simple path params", async () => {
            const calls = await executeOp((op) => ({
                get: op.getSimple({ id: "abc" }),
            }));
            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe("[ENDPOINT]/p-simple/abc");
        });

        it("encodes label path params", async () => {
            const calls = await executeOp((op) => ({
                get: op.getLabel({ id: "abc" }),
            }));
            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe("[ENDPOINT]/p-label/.abc");
        });

        it("encodes matrix path params", async () => {
            const calls = await executeOp((op) => ({
                get: op.getMatrix({ id: "abc" }),
            }));
            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe("[ENDPOINT]/p-matrix/;abc");
        });
    });

    describe("request body encoding", () => {
        it("encodes application/json bodies", async () => {
            const calls = await executeOp((op) => ({
                post: op.postJson({ msg: "hi" }),
            }));
            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe("[ENDPOINT]/json");
            expect(calls[0].init?.method).toBe("post");
            expect((calls[0].init?.headers as Record<string, string>)["Content-Type"]).toBe(
                "application/json",
            );
            expect(calls[0].init?.body).toBe(JSON.stringify({ msg: "hi" }));
        });

        it("encodes application/x-www-form-urlencoded bodies", async () => {
            const calls = await executeOp((op) => ({
                login: op.loginForm({ user: "u", pass: "p" }),
            }));
            expect(calls).toHaveLength(1);
            expect((calls[0].init?.headers as Record<string, string>)["Content-Type"]).toBe(
                "application/x-www-form-urlencoded",
            );
            expect(calls[0].init?.body).toBeInstanceOf(URLSearchParams);
            expect(String(calls[0].init?.body)).toBe("user=u&pass=p");
        });

        it("encodes multipart/form-data without a manual Content-Type", async () => {
            const calls = await executeOp((op) => ({
                upload: op.uploadMultipart({ name: "n" }),
            }));
            expect(calls).toHaveLength(1);
            expect(calls[0].init?.body).toBeInstanceOf(FormData);
            expect((calls[0].init?.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
            expect((calls[0].init?.body as FormData).get("name")).toBe("n");
        });

        it("throws a clear diagnostic for unsupported request media types", async () => {
            const { calls } = installMockFetch();
            const slw = rootSLWFactory(makeRoot, (op) => ({
                post: op.postXml({ a: "1" }),
            }));
            await expect(slw[ROOT_OP_COLLECTOR]!.ref.execute()).rejects.toThrow(
                /Unsupported request content-type "application\/xml"/,
            );
            expect(calls).toHaveLength(0);
        });
    });
});
