import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import path from "node:path";
import type { OpenAPI3 } from "openapi-typescript";
import { Generator } from "@/openapi/builder/generator";
import { GeneratorSelectionTypeFlavorDefault } from "@/openapi/flavors/default/generator-flavor";
import {
    OPTIONS,
    ROOT_OP_COLLECTOR,
    RootOperation,
    type SecuritySchemeRuntime,
} from "@/openapi/flavors/default/wrapper";
import type { SecuritySchemeMeta } from "@/openapi/types/meta";
import { rootSLWFactory } from "./utils";

const SCHEMA_30_PATH = path.join(import.meta.dir, "schemas/security-matrix-30.json");
const SCHEMA_31_PATH = path.join(import.meta.dir, "schemas/security-matrix-31.json");
const GENERATED_30_PATH = path.join(import.meta.dir, "examples/security-matrix-30.generated.ts");
const GENERATED_31_PATH = path.join(import.meta.dir, "examples/security-matrix-31.generated.ts");

type Matrix30Module = typeof import("./examples/security-matrix-30.generated");
type Matrix31Module = typeof import("./examples/security-matrix-31.generated");
type MatrixMakeRoot = Matrix30Module["_makeRootOperationInput"];
type MatrixRootOps = ReturnType<MatrixMakeRoot>;

type FetchCall = { url: string; init?: RequestInit };

function resetSdkOptions() {
    RootOperation[OPTIONS].fetcher = undefined as any;
    RootOperation[OPTIONS].sseFetchTransform = undefined as any;
    RootOperation[OPTIONS]._auth_fn = undefined;
    RootOperation[OPTIONS]._auth_token = undefined;
    RootOperation[OPTIONS].headers = {};
    RootOperation.resetSecurity();
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

function toRuntimeSchemes(
    schemes: Record<string, SecuritySchemeMeta>,
): Record<string, SecuritySchemeRuntime> {
    const out: Record<string, SecuritySchemeRuntime> = {};
    for (const [name, s] of Object.entries(schemes)) {
        if (s.type === "apiKey") {
            out[name] = {
                name: s.name,
                type: "apiKey",
                apiKeyName: s.apiKeyName,
                apiKeyIn: s.apiKeyIn,
            };
        } else if (s.type === "http") {
            out[name] = {
                name: s.name,
                type: "http",
                scheme: s.scheme,
                bearerFormat: s.bearerFormat,
            };
        } else if (s.type === "oauth2" || s.type === "openIdConnect") {
            out[name] = { name: s.name, type: s.type };
        } else {
            out[name] = { name: s.name, type: "mutualTLS" };
        }
    }
    return out;
}

function configureFromSecurityExport(mod: {
    security: {
        default?: string;
        options?: Record<string, string[]>[];
        schemes: Record<string, SecuritySchemeMeta>;
    };
}) {
    const defaultName = mod.security.default;
    const options = mod.security.options;
    RootOperation.configureSecurity({
        schemes: toRuntimeSchemes(mod.security.schemes),
        defaultSecurity: defaultName ? { [defaultName]: [] } : undefined,
        documentSecurity: Array.isArray(options) ? options : undefined,
    });
}

async function generateFromFixture(schemaPath: string, outPath: string) {
    const schema = (await Bun.file(schemaPath).json()) as OpenAPI3;
    const generator = new Generator(GeneratorSelectionTypeFlavorDefault);
    const source = await generator.generate({
        schema,
        options: {},
        runtime: "external",
        externalRuntime: {
            wrapperModule: "@/openapi/flavors/default/wrapper",
        },
    });
    await Bun.write(outPath, source);
    return source;
}

describe("oas-gen security-matrix fixtures", () => {
    let mod30: Matrix30Module;
    let mod31: Matrix31Module;
    let makeRoot30: MatrixMakeRoot;
    let source30: string;
    let source31: string;

    async function executeOp(
        makeRoot: MatrixMakeRoot,
        select: (op: MatrixRootOps) => object,
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
        source30 = await generateFromFixture(SCHEMA_30_PATH, GENERATED_30_PATH);
        source31 = await generateFromFixture(SCHEMA_31_PATH, GENERATED_31_PATH);
        mod30 = (await import(
            `./examples/security-matrix-30.generated.ts?t=${Date.now()}`
        )) as Matrix30Module;
        mod31 = (await import(
            `./examples/security-matrix-31.generated.ts?t=${Date.now() + 1}`
        )) as Matrix31Module;
        makeRoot30 = mod30._makeRootOperationInput;
    });

    beforeEach(() => {
        configureFromSecurityExport(mod30);
    });

    afterEach(() => {
        resetSdkOptions();
    });

    describe("3.0 export metadata", () => {
        it("emits basic, digest, oauth2 flows, and oidc schemes", () => {
            expect(source30).toContain("export const security");
            expect(source30).toContain("__ensureSecurityConfigured");
            expect(source30).toContain("export type AuthScheme");
            expect(source30).toContain("authScheme?: AuthScheme");
            expect(source30).toMatch(/export type AuthScheme = /);
            expect(source30).not.toMatch(/export type AuthScheme = .+\(string & \{\}\)/);
            expect(mod30.security.default).toBe("bearerAuth");
            expect(mod30.security.schemes.basicAuth.type).toBe("http");
            if (mod30.security.schemes.basicAuth.type === "http") {
                expect(mod30.security.schemes.basicAuth.scheme).toBe("basic");
            }
            expect(mod30.security.schemes.digestAuth.type).toBe("http");
            expect(mod30.security.schemes.oauth2.type).toBe("oauth2");
            if (mod30.security.schemes.oauth2.type === "oauth2") {
                expect(mod30.security.schemes.oauth2.flows.authorizationCode?.scopes.read).toBe(
                    "Read access",
                );
                expect(mod30.security.schemes.oauth2.flows.clientCredentials?.tokenUrl).toBeTruthy();
            }
            expect(mod30.security.schemes.oidc.type).toBe("openIdConnect");
            if (mod30.security.schemes.oidc.type === "openIdConnect") {
                expect(mod30.security.schemes.oidc.openIdConnectUrl).toContain("openid-configuration");
            }
        });
    });

    describe("3.0 wire placement", () => {
        it("applies doc OR default bearer for string auth on listSecure", async () => {
            const calls = await executeOp(makeRoot30, (op) => ({ me: op.listSecure }), "tok");
            expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(
                "Bearer tok",
            );
        });

        it("selects apiKeyHeader OR branch via init authScheme", async () => {
            RootOperation[OPTIONS].authScheme = "apiKeyHeader";
            RootOperation[OPTIONS]._auth_token = "k";
            const calls = await executeOp(makeRoot30, (op) => ({ me: op.listSecure }));
            const headers = calls[0].init?.headers as Record<string, string>;
            expect(headers["X-Api-Key"]).toBe("k");
            expect(headers.Authorization).toBeUndefined();
        });

        it("selects authScheme via client init", async () => {
            resetSdkOptions();
            const { calls } = installMockFetch();
            mod30.default.init({
                fetcher: RootOperation[OPTIONS].fetcher as any,
                authScheme: "apiKeyHeader",
                authToken: "from-init",
            });
            await mod30.default((op) => ({ me: op.listSecure }));
            const headers = calls[0].init?.headers as Record<string, string>;
            expect(headers["X-Api-Key"]).toBe("from-init");
            expect(headers.Authorization).toBeUndefined();
        });

        it("applies named apiKeyHeader from scheme map on listSecure", async () => {
            const calls = await executeOp(makeRoot30, (op) => ({ me: op.listSecure }), {
                apiKeyHeader: "k",
            });
            const headers = calls[0].init?.headers as Record<string, string>;
            expect(headers["X-Api-Key"]).toBe("k");
            expect(headers.Authorization).toBeUndefined();
        });

        it("applies AND map on andGate (apiKeyHeader + oauth2)", async () => {
            const calls = await executeOp(makeRoot30, (op) => ({ me: op.andGate }), {
                apiKeyHeader: "secret",
                oauth2: "atok",
            });
            const headers = calls[0].init?.headers as Record<string, string>;
            expect(headers["X-Api-Key"]).toBe("secret");
            expect(headers.Authorization).toBe("Bearer atok");
        });

        it("applies AND string auth to first scheme only (apiKeyHeader)", async () => {
            const calls = await executeOp(makeRoot30, (op) => ({ me: op.andGate }), "secret");
            const headers = calls[0].init?.headers as Record<string, string>;
            expect(headers["X-Api-Key"]).toBe("secret");
            expect(headers.Authorization).toBeUndefined();
        });

        it("skips credential placement on optionalAuth (security: [])", async () => {
            const calls = await executeOp(makeRoot30, (op) => ({ me: op.optionalAuth }), "tok");
            const headers = calls[0].init?.headers as Record<string, string>;
            expect(headers.Authorization).toBeUndefined();
            expect(headers["X-Api-Key"]).toBeUndefined();
            expect(headers.Cookie).toBeUndefined();
            expect(calls[0].url).toBe("[ENDPOINT]/optional");
        });

        it("passes digest Authorization value through on digestOnly", async () => {
            const raw = "Digest username=x";
            const calls = await executeOp(makeRoot30, (op) => ({ me: op.digestOnly }), raw);
            expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(raw);
        });

        it("applies basicAuth via scheme map on listSecure", async () => {
            const calls = await executeOp(makeRoot30, (op) => ({ me: op.listSecure }), {
                basicAuth: "dXNlcjpwYXNz",
            });
            expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(
                "Basic dXNlcjpwYXNz",
            );
        });

        it("applies oauth2 and oidc as Bearer via scheme map", async () => {
            const oauthCalls = await executeOp(makeRoot30, (op) => ({ me: op.listSecure }), {
                oauth2: "oauth-tok",
            });
            expect((oauthCalls[0].init?.headers as Record<string, string>).Authorization).toBe(
                "Bearer oauth-tok",
            );

            const oidcCalls = await executeOp(makeRoot30, (op) => ({ me: op.listSecure }), {
                oidc: "oidc-tok",
            });
            expect((oidcCalls[0].init?.headers as Record<string, string>).Authorization).toBe(
                "Bearer oidc-tok",
            );
        });

        it("configures schemes via client() __ensureSecurityConfigured without manual map", async () => {
            // Fresh module so __securityConfigured starts false (module-level latch).
            const fresh = (await import(
                `./examples/security-matrix-30.generated.ts?ensure=${Date.now()}`
            )) as Matrix30Module;
            resetSdkOptions();
            const { calls } = installMockFetch();
            fresh.default.init({ fetcher: RootOperation[OPTIONS].fetcher as any });

            const result = await fresh.default((op) => ({ me: op.listSecure })).auth("from-client");
            await result;

            expect(calls).toHaveLength(1);
            expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(
                "Bearer from-client",
            );
            // Schemes were applied by __ensureSecurityConfigured
            expect(RootOperation.securitySchemes.bearerAuth).toBeTruthy();
            expect(RootOperation.defaultSecurity).toEqual({ bearerAuth: [] });
        });
    });

    describe("3.1 mtls", () => {
        beforeEach(() => {
            configureFromSecurityExport(mod31);
        });

        it("exports mutualTLS scheme", () => {
            expect(source31).toContain("mutualTLS");
            expect(mod31.security.schemes.mtls.type).toBe("mutualTLS");
        });

        it("applies no string credential placement on mtlsOnly", async () => {
            type Matrix31Ops = ReturnType<Matrix31Module["_makeRootOperationInput"]>;
            const makeRoot31 = mod31._makeRootOperationInput;
            const { calls } = installMockFetch();
            const slw = rootSLWFactory(makeRoot31, (op: Matrix31Ops) => ({ me: op.mtlsOnly }));
            slw[ROOT_OP_COLLECTOR]!.ref.op!.setAuth("ignored");
            await slw[ROOT_OP_COLLECTOR]!.ref.execute();
            const headers = calls[0].init?.headers as Record<string, string>;
            expect(headers.Authorization).toBeUndefined();
            expect(headers["X-Api-Key"]).toBeUndefined();
            expect(calls[0].url).toBe("[ENDPOINT]/mtls");
        });
    });
});
