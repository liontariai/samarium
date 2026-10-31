import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import path from "node:path";
import type { OpenAPI3 } from "openapi-typescript";
import { Generator } from "@/openapi/builder/generator";
import { GeneratorSelectionTypeFlavorDefault } from "@/openapi/flavors/default/generator-flavor";
import {
    OPTIONS,
    ROOT_OP_COLLECTOR,
    RootOperation,
    applySecurityCredential,
} from "@/openapi/flavors/default/wrapper";
import { rootSLWFactory } from "./utils";

const GENERATED_PATH = path.join(import.meta.dir, "examples/security-auth.generated.ts");

const SECURITY_SPEC = {
    openapi: "3.0.0",
    info: { title: "security-auth", version: "1" },
    security: [{ bearerAuth: [] }],
    paths: {
        "/bearer": {
            get: {
                operationId: "getBearer",
                responses: {
                    "200": {
                        description: "ok",
                        content: { "application/json": { schema: { type: "string" } } },
                    },
                },
            },
        },
        "/api-key": {
            get: {
                operationId: "getApiKeyHeader",
                security: [{ apiKeyHeader: [] }],
                responses: {
                    "200": {
                        description: "ok",
                        content: { "application/json": { schema: { type: "string" } } },
                    },
                },
            },
        },
        "/api-key-query": {
            get: {
                operationId: "getApiKeyQuery",
                security: [{ apiKeyQuery: [] }],
                responses: {
                    "200": {
                        description: "ok",
                        content: { "application/json": { schema: { type: "string" } } },
                    },
                },
            },
        },
        "/api-key-cookie": {
            get: {
                operationId: "getApiKeyCookie",
                security: [{ apiKeyCookie: [] }],
                responses: {
                    "200": {
                        description: "ok",
                        content: { "application/json": { schema: { type: "string" } } },
                    },
                },
            },
        },
        "/and": {
            get: {
                operationId: "getAnd",
                security: [{ bearerAuth: [], apiKeyHeader: [] }],
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
        securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
            apiKeyHeader: { type: "apiKey", name: "X-Api-Key", in: "header" },
            apiKeyQuery: { type: "apiKey", name: "api_key", in: "query" },
            apiKeyCookie: { type: "apiKey", name: "sid", in: "cookie" },
            oauth2: {
                type: "oauth2",
                flows: {
                    authorizationCode: {
                        authorizationUrl: "https://example.com/oauth/authorize",
                        tokenUrl: "https://example.com/oauth/token",
                        scopes: { read: "Read access", write: "Write access" },
                    },
                },
            },
        },
    },
} as unknown as OpenAPI3;

type SecurityMakeRoot = (typeof import("./examples/security-auth.generated"))["_makeRootOperationInput"];
type SecurityRootOps = ReturnType<SecurityMakeRoot>;
type SecurityModule = typeof import("./examples/security-auth.generated");

type FetchCall = { url: string; init?: RequestInit };

function resetSdkOptions() {
    RootOperation[OPTIONS].fetcher = undefined as any;
    RootOperation[OPTIONS].sseFetchTransform = undefined as any;
    RootOperation[OPTIONS]._auth_fn = undefined;
    RootOperation[OPTIONS]._auth_token = undefined;
    RootOperation[OPTIONS].headers = {};
    RootOperation.securitySchemes = {};
    RootOperation.defaultSecurity = undefined;
    RootOperation.authHeaderOverride = undefined;
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

describe("applySecurityCredential", () => {
    it("places bearer, apiKey header/query/cookie correctly", () => {
        expect(
            applySecurityCredential(
                { name: "b", type: "http", scheme: "bearer" },
                "tok",
            ).headers.Authorization,
        ).toBe("Bearer tok");
        expect(
            applySecurityCredential(
                { name: "b", type: "http", scheme: "bearer" },
                "Bearer already",
            ).headers.Authorization,
        ).toBe("Bearer already");
        expect(
            applySecurityCredential(
                { name: "k", type: "apiKey", apiKeyName: "X-Api-Key", apiKeyIn: "header" },
                "secret",
            ).headers["X-Api-Key"],
        ).toBe("secret");
        expect(
            applySecurityCredential(
                { name: "k", type: "apiKey", apiKeyName: "api_key", apiKeyIn: "query" },
                "q",
            ).query.api_key,
        ).toBe("q");
        expect(
            applySecurityCredential(
                { name: "k", type: "apiKey", apiKeyName: "sid", apiKeyIn: "cookie" },
                "c",
            ).cookie.sid,
        ).toBe("c");
    });
});

describe("OpenAPI schema-aware auth", () => {
    let makeRoot: SecurityMakeRoot;
    let mod: SecurityModule;
    let generatedSource: string;

    async function executeOp<T extends object>(
        select: (op: SecurityRootOps) => T,
        auth?: unknown,
    ): Promise<FetchCall[]> {
        const { calls } = installMockFetch();
        const slw = rootSLWFactory(makeRoot, select);
        if (auth !== undefined) {
            slw[ROOT_OP_COLLECTOR]!.ref.op!.setAuth(auth);
        }
        await slw[ROOT_OP_COLLECTOR]!.ref.execute();
        return calls;
    }

    beforeAll(async () => {
        const generator = new Generator(GeneratorSelectionTypeFlavorDefault);
        generatedSource = await generator.generate({
            schema: SECURITY_SPEC,
            options: {},
            runtime: "external",
            externalRuntime: {
                wrapperModule: "@/openapi/flavors/default/wrapper",
            },
        });
        await Bun.write(GENERATED_PATH, generatedSource);
        mod = (await import(`./examples/security-auth.generated.ts?t=${Date.now()}`)) as SecurityModule;
        makeRoot = mod._makeRootOperationInput;
    });

    beforeEach(() => {
        // Tests use rootSLWFactory (not client()); apply schemes the client would cache-apply on first call.
        RootOperation.configureSecurity({
            schemes: {
                bearerAuth: { name: "bearerAuth", type: "http", scheme: "bearer", bearerFormat: "JWT" },
                apiKeyHeader: {
                    name: "apiKeyHeader",
                    type: "apiKey",
                    apiKeyName: "X-Api-Key",
                    apiKeyIn: "header",
                },
                apiKeyQuery: {
                    name: "apiKeyQuery",
                    type: "apiKey",
                    apiKeyName: "api_key",
                    apiKeyIn: "query",
                },
                apiKeyCookie: {
                    name: "apiKeyCookie",
                    type: "apiKey",
                    apiKeyName: "sid",
                    apiKeyIn: "cookie",
                },
                oauth2: { name: "oauth2", type: "oauth2" },
            },
            defaultSecurity: { bearerAuth: [] },
        });
    });

    afterEach(() => {
        resetSdkOptions();
    });

    it("emits security const with oauth2 flow metadata", () => {
        expect(generatedSource).toContain("export const security");
        expect(generatedSource).toContain("authorizationUrl");
        expect(generatedSource).toContain("https://example.com/oauth/authorize");
        expect(mod.security.default).toBe("bearerAuth");
        expect(mod.security.schemes.oauth2.type).toBe("oauth2");
        if (mod.security.schemes.oauth2.type === "oauth2") {
            expect(mod.security.schemes.oauth2.flows.authorizationCode?.scopes.read).toBe(
                "Read access",
            );
        }
        expect(generatedSource).toContain("__ensureSecurityConfigured");
        expect(generatedSource).toContain("__SECURITY_CONFIG");
        expect(generatedSource).toContain(".auth");
    });

    it("applies bearer via authToken using doc default scheme", async () => {
        RootOperation[OPTIONS]._auth_token = "tok";
        const calls = await executeOp((op) => ({ me: op.getBearer }));
        expect(calls).toHaveLength(1);
        expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    });

    it("applies bearer via .auth(string)", async () => {
        const calls = await executeOp((op) => ({ me: op.getBearer }), "tok");
        expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    });

    it("applies apiKey header from op security", async () => {
        const calls = await executeOp((op) => ({ me: op.getApiKeyHeader }), "secret");
        expect((calls[0].init?.headers as Record<string, string>)["X-Api-Key"]).toBe("secret");
        expect((calls[0].init?.headers as Record<string, string>).Authorization).toBeUndefined();
    });

    it("applies apiKey query on the wire", async () => {
        const calls = await executeOp((op) => ({ me: op.getApiKeyQuery }), "qkey");
        expect(calls[0].url).toBe("[ENDPOINT]/api-key-query?api_key=qkey");
    });

    it("applies apiKey cookie on the wire", async () => {
        const calls = await executeOp((op) => ({ me: op.getApiKeyCookie }), "cookie-val");
        expect((calls[0].init?.headers as Record<string, string>).Cookie).toBe("sid=cookie-val");
    });

    it("applies scheme-name map for AND requirements", async () => {
        const calls = await executeOp((op) => ({ me: op.getAnd }), {
            bearerAuth: "tok",
            apiKeyHeader: "secret",
        });
        const headers = calls[0].init?.headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer tok");
        expect(headers["X-Api-Key"]).toBe("secret");
    });

    it("still accepts raw header objects as escape hatch", async () => {
        const calls = await executeOp((op) => ({ me: op.getBearer }), {
            "X-Custom": "1",
            Authorization: "Raw raw",
        });
        const headers = calls[0].init?.headers as Record<string, string>;
        expect(headers["X-Custom"]).toBe("1");
        expect(headers.Authorization).toBe("Raw raw");
    });

    it("supports reelgood-style X-Api-Key without authConfig.headerName", async () => {
        // getApiKeyHeader op security is apiKeyHeader → X-Api-Key
        RootOperation[OPTIONS]._auth_token = "rg-test-key";
        const calls = await executeOp((op) => ({ me: op.getApiKeyHeader }));
        expect((calls[0].init?.headers as Record<string, string>)["X-Api-Key"]).toBe("rg-test-key");
    });
});
