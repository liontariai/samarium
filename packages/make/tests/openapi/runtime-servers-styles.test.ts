import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import path from "node:path";
import type { OpenAPI3 } from "openapi-typescript";
import { Generator } from "@/openapi/builder/generator";
import { GeneratorSelectionTypeFlavorDefault } from "@/openapi/flavors/default/generator-flavor";
import {
    OPTIONS,
    ROOT_OP_COLLECTOR,
    RootOperation,
    encodeCookieParam,
    encodeHeaderParam,
    joinOriginAndPath,
    resolveRequestOrigin,
    substituteServerUrl,
} from "@/openapi/flavors/default/wrapper";
import { rootSLWFactory } from "./utils";

const GENERATED_PATH = path.join(import.meta.dir, "examples/servers-styles.generated.ts");

const SERVERS_STYLES_SPEC = {
    openapi: "3.0.0",
    info: { title: "servers-styles", version: "1" },
    servers: [
        {
            url: "https://{env}.api.example.com/{version}",
            variables: {
                env: { default: "prod", enum: ["prod", "staging"] },
                version: { default: "v1" },
            },
        },
    ],
    paths: {
        "/ping": {
            get: {
                operationId: "ping",
                responses: {
                    "200": {
                        description: "ok",
                        content: { "application/json": { schema: { type: "string" } } },
                    },
                },
            },
        },
        "/admin": {
            servers: [{ url: "https://admin.example.com" }],
            get: {
                operationId: "adminGet",
                responses: {
                    "200": {
                        description: "ok",
                        content: { "application/json": { schema: { type: "string" } } },
                    },
                },
            },
            post: {
                operationId: "adminPostEu",
                servers: [{ url: "https://admin-eu.example.com" }],
                responses: {
                    "200": {
                        description: "ok",
                        content: { "application/json": { schema: { type: "string" } } },
                    },
                },
            },
        },
        "/headers": {
            get: {
                operationId: "getWithHeaders",
                parameters: [
                    {
                        name: "X-Tags",
                        in: "header",
                        style: "simple",
                        explode: false,
                        schema: { type: "array", items: { type: "string" } },
                    },
                    {
                        name: "X-Color",
                        in: "header",
                        style: "simple",
                        explode: true,
                        schema: {
                            type: "object",
                            properties: { R: { type: "integer" }, G: { type: "integer" } },
                        },
                    },
                    {
                        name: "X-Color-Flat",
                        in: "header",
                        style: "simple",
                        explode: false,
                        schema: {
                            type: "object",
                            properties: { R: { type: "integer" }, G: { type: "integer" } },
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
        "/cookies": {
            get: {
                operationId: "getWithCookies",
                parameters: [
                    {
                        name: "sid",
                        in: "cookie",
                        style: "form",
                        explode: true,
                        schema: { type: "string" },
                    },
                    {
                        name: "tags",
                        in: "cookie",
                        style: "form",
                        explode: false,
                        schema: { type: "array", items: { type: "string" } },
                    },
                    {
                        name: "prefs",
                        in: "cookie",
                        style: "form",
                        explode: true,
                        schema: {
                            type: "object",
                            properties: {
                                theme: { type: "string" },
                                lang: { type: "string" },
                            },
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
    },
} as unknown as OpenAPI3;

type ServersStylesMakeRoot =
    (typeof import("./examples/servers-styles.generated"))["_makeRootOperationInput"];
type ServersStylesRootOps = ReturnType<ServersStylesMakeRoot>;
type ServersStylesModule = typeof import("./examples/servers-styles.generated");

type FetchCall = { url: string; init?: RequestInit };

function resetSdkOptions() {
    RootOperation[OPTIONS].fetcher = undefined as any;
    RootOperation[OPTIONS].sseFetchTransform = undefined as any;
    RootOperation[OPTIONS]._auth_fn = undefined;
    RootOperation[OPTIONS]._auth_token = undefined;
    RootOperation[OPTIONS].headers = {};
    RootOperation.resetSecurity();
    RootOperation.resetServers();
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

describe("encodeHeaderParam / encodeCookieParam (unit)", () => {
    it("encodes header simple arrays and objects", () => {
        expect(encodeHeaderParam(["a", "b"], "simple", false)).toBe("a,b");
        expect(encodeHeaderParam(["a", "b"], "simple", true)).toBe("a,b");
        expect(encodeHeaderParam({ R: 100, G: 200 }, "simple", true)).toBe("R=100,G=200");
        expect(encodeHeaderParam({ R: 100, G: 200 }, "simple", false)).toBe("R,100,G,200");
    });

    it("encodes cookie form primitives, arrays, and objects", () => {
        expect(encodeCookieParam("sid", "abc", "form", true)).toBe("sid=abc");
        expect(encodeCookieParam("tags", ["a", "b"], "form", false)).toBe("tags=a,b");
        expect(encodeCookieParam("tags", ["a", "b"], "form", true)).toBe("tags=a; tags=b");
        expect(encodeCookieParam("prefs", { theme: "dark", lang: "en" }, "form", true)).toBe(
            "theme=dark; lang=en",
        );
        expect(encodeCookieParam("prefs", { theme: "dark", lang: "en" }, "form", false)).toBe(
            "prefs=theme,dark,lang,en",
        );
    });
});

describe("server URL helpers (unit)", () => {
    it("substitutes variables with overrides and defaults", () => {
        expect(
            substituteServerUrl(
                "https://{env}.example.com/{version}",
                { env: "staging" },
                { env: { default: "prod" }, version: { default: "v1" } },
            ),
        ).toBe("https://staging.example.com/v1");
    });

    it("joins origin and path without double slashes", () => {
        expect(joinOriginAndPath("https://api.example.com", "/ping")).toBe(
            "https://api.example.com/ping",
        );
        expect(joinOriginAndPath("https://api.example.com/", "ping")).toBe(
            "https://api.example.com/ping",
        );
        expect(joinOriginAndPath("[ENDPOINT]", "/ping")).toBe("[ENDPOINT]/ping");
    });

    it("resolves origin with baseUrl override, then servers, then placeholder", () => {
        expect(
            resolveRequestOrigin([{ url: "https://doc.example.com" }], {
                baseUrl: "https://override.example.com/",
            }),
        ).toBe("https://override.example.com");
        expect(
            resolveRequestOrigin([{ url: "https://op.example.com" }], {
                documentServers: [{ url: "https://doc.example.com" }],
            }),
        ).toBe("https://op.example.com");
        expect(
            resolveRequestOrigin(undefined, {
                documentServers: [{ url: "https://doc.example.com" }],
            }),
        ).toBe("https://doc.example.com");
        expect(resolveRequestOrigin(undefined, {})).toBe("[ENDPOINT]");
    });
});

describe("OpenAPI servers + header/cookie styles", () => {
    let makeRoot: ServersStylesMakeRoot;
    let mod: ServersStylesModule;
    let generatedSource: string;

    async function executeOp(
        select: (op: ServersStylesRootOps) => object,
    ): Promise<FetchCall[]> {
        const { calls } = installMockFetch();
        const slw = rootSLWFactory(makeRoot, select);
        await slw[ROOT_OP_COLLECTOR]!.ref.execute();
        return calls;
    }

    beforeAll(async () => {
        const generator = new Generator(GeneratorSelectionTypeFlavorDefault);
        generatedSource = await generator.generate({
            schema: SERVERS_STYLES_SPEC,
            options: {},
            runtime: "external",
            externalRuntime: {
                wrapperModule: "@/openapi/flavors/default/wrapper",
            },
        });
        await Bun.write(GENERATED_PATH, generatedSource);
        mod = (await import(
            `./examples/servers-styles.generated.ts?t=${Date.now()}`
        )) as ServersStylesModule;
        makeRoot = mod._makeRootOperationInput;
    });

    afterEach(() => {
        resetSdkOptions();
    });

    it("emits servers const and typed ServerVariables / BaseUrl", () => {
        expect(generatedSource).toContain("export const servers");
        expect(generatedSource).toContain("export type ServerVariables");
        expect(generatedSource).toContain('"prod" | "staging"');
        // default-only vars: literal for autocomplete + open string escape hatch
        expect(generatedSource).toContain('"v1" | (string & {})');
        expect(generatedSource).toContain("serverVariables?: ServerVariables");
        expect(generatedSource).toContain("export type BaseUrl");
        expect(generatedSource).toContain("baseUrl?: BaseUrl");
        expect(generatedSource).toContain("https://{env}.api.example.com/{version}");
        expect(generatedSource).toContain("https://prod.api.example.com/v1");
        expect(generatedSource).toContain("https://admin.example.com");
        expect(generatedSource).toContain("https://admin-eu.example.com");
        expect(generatedSource).toMatch(/export type BaseUrl = .+ \| \(string & \{\}\);/);
        expect(mod.servers[0].url).toContain("{env}");
    });

    describe("header serialization", () => {
        it("encodes simple array and object headers", async () => {
            const calls = await executeOp((op) => ({
                me: op.getWithHeaders({
                    "X-Tags": ["a", "b"],
                    "X-Color": { R: 100, G: 200 },
                    "X-Color-Flat": { R: 100, G: 200 },
                }),
            }));
            const headers = calls[0].init?.headers as Record<string, string>;
            expect(headers["X-Tags"]).toBe("a,b");
            expect(headers["X-Color"]).toBe("R=100,G=200");
            expect(headers["X-Color-Flat"]).toBe("R,100,G,200");
        });
    });

    describe("cookie serialization", () => {
        it("encodes form cookie primitives, arrays, and objects", async () => {
            const calls = await executeOp((op) => ({
                me: op.getWithCookies({
                    sid: "abc",
                    tags: ["a", "b"],
                    prefs: { theme: "dark", lang: "en" },
                }),
            }));
            const headers = calls[0].init?.headers as Record<string, string>;
            expect(headers.Cookie).toContain("sid=abc");
            expect(headers.Cookie).toContain("tags=a,b");
            expect(headers.Cookie).toContain("theme=dark");
            expect(headers.Cookie).toContain("lang=en");
        });
    });

    describe("servers resolution", () => {
        it("uses document server variable defaults from op meta", async () => {
            const calls = await executeOp((op) => ({ me: op.ping }));
            expect(calls[0].url).toBe("https://prod.api.example.com/v1/ping");
        });

        it("applies typed serverVariables via init", async () => {
            const { calls } = installMockFetch();
            mod.default.init({
                fetcher: RootOperation[OPTIONS].fetcher as any,
                serverVariables: { env: "staging" },
            });
            await mod.default((op) => ({ me: op.ping }));
            expect(calls[0].url).toBe("https://staging.api.example.com/v1/ping");
        });

        it("lets init baseUrl override servers", async () => {
            const { calls } = installMockFetch();
            mod.default.init({
                fetcher: RootOperation[OPTIONS].fetcher as any,
                baseUrl: "https://override.example.com",
            });
            await mod.default((op) => ({ me: op.ping }));
            expect(calls[0].url).toBe("https://override.example.com/ping");
        });

        it("uses path-item servers override", async () => {
            const calls = await executeOp((op) => ({ me: op.adminGet }));
            expect(calls[0].url).toBe("https://admin.example.com/admin");
        });

        it("uses operation servers override over path-item", async () => {
            const calls = await executeOp((op) => ({ me: op.adminPostEu }));
            expect(calls[0].url).toBe("https://admin-eu.example.com/admin");
        });
    });
});

describe("OpenAPI [ENDPOINT] fallback without servers", () => {
    it("keeps [ENDPOINT] when the schema has no servers", async () => {
        const generator = new Generator(GeneratorSelectionTypeFlavorDefault);
        const source = await generator.generate({
            schema: {
                openapi: "3.0.0",
                info: { title: "no-servers", version: "1" },
                paths: {
                    "/x": {
                        get: {
                            operationId: "getX",
                            responses: {
                                "200": {
                                    description: "ok",
                                    content: {
                                        "application/json": { schema: { type: "string" } },
                                    },
                                },
                            },
                        },
                    },
                },
            } as unknown as OpenAPI3,
            options: {},
            runtime: "external",
            externalRuntime: { wrapperModule: "@/openapi/flavors/default/wrapper" },
        });
        const out = path.join(import.meta.dir, "examples/no-servers.generated.ts");
        await Bun.write(out, source);
        const noServers = (await import(
            `./examples/no-servers.generated.ts?t=${Date.now()}`
        )) as {
            _makeRootOperationInput: (...args: any[]) => any;
        };
        resetSdkOptions();
        const { calls } = installMockFetch();
        const slw = rootSLWFactory(noServers._makeRootOperationInput, (op: any) => ({
            me: op.getX,
        }));
        await slw[ROOT_OP_COLLECTOR]!.ref.execute();
        expect(calls[0].url).toBe("[ENDPOINT]/x");
        expect(source).toContain("export type ServerVariables = Record<string, never>");
    });
});
