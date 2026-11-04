import type { ComponentsIR, OpenAPIDocument, PathItemIR, SecuritySchemeIR } from "../ast/index.ts";
import { mark, remainingOps, remainingPaths, type GenContext } from "./context.ts";
import { attachOp, jsonResponse, primitiveSchema, textPlainResponse } from "./helpers.ts";
import { uniqueOperationId } from "./names.ts";

const SCOPES = { read: "Read access", write: "Write access" };
const AUTH_URL = "https://example.com/oauth/authorize";
const TOKEN_URL = "https://example.com/oauth/token";
const REFRESH_URL = "https://example.com/oauth/refresh";
const OIDC_URL = "https://example.com/.well-known/openid-configuration";

function putScheme(ctx: GenContext, components: ComponentsIR, name: string, scheme: SecuritySchemeIR): void {
    components.securitySchemes ??= {};
    components.securitySchemes[name] = scheme;
    ctx.securitySchemeNames.push(name);
}

/** Covering install: every scheme type the dialect allows. */
export function installSecurityMatrix(ctx: GenContext, components: ComponentsIR, doc: OpenAPIDocument): void {
    putScheme(ctx, components, "apiKeyHeader", {
        type: "apiKey",
        name: "X-Api-Key",
        in: "header",
    });
    mark(ctx, "security.apiKey.header");

    putScheme(ctx, components, "apiKeyQuery", {
        type: "apiKey",
        name: "api_key",
        in: "query",
    });
    mark(ctx, "security.apiKey.query");

    putScheme(ctx, components, "apiKeyCookie", {
        type: "apiKey",
        name: "sid",
        in: "cookie",
    });
    mark(ctx, "security.apiKey.cookie");

    putScheme(ctx, components, "basicAuth", { type: "http", scheme: "basic" });
    mark(ctx, "security.http.basic");

    putScheme(ctx, components, "bearerAuth", {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
    });
    mark(ctx, "security.http.bearer");

    putScheme(ctx, components, "digestAuth", { type: "http", scheme: "digest" });
    mark(ctx, "security.http.digest");

    putScheme(ctx, components, "oauth2", {
        type: "oauth2",
        flows: {
            implicit: { authorizationUrl: AUTH_URL, refreshUrl: REFRESH_URL, scopes: SCOPES },
            password: { tokenUrl: TOKEN_URL, refreshUrl: REFRESH_URL, scopes: SCOPES },
            clientCredentials: { tokenUrl: TOKEN_URL, scopes: SCOPES },
            authorizationCode: {
                authorizationUrl: AUTH_URL,
                tokenUrl: TOKEN_URL,
                refreshUrl: REFRESH_URL,
                scopes: SCOPES,
            },
        },
    });
    mark(ctx, "security.oauth2.implicit");
    mark(ctx, "security.oauth2.password");
    mark(ctx, "security.oauth2.clientCredentials");
    mark(ctx, "security.oauth2.authorizationCode");

    putScheme(ctx, components, "oidc", {
        type: "openIdConnect",
        openIdConnectUrl: OIDC_URL,
    });
    mark(ctx, "security.openIdConnect");

    if (ctx.dialect === "3.1") {
        putScheme(ctx, components, "mtls", { type: "mutualTLS" });
        mark(ctx, "security.mutualTLS");
    }

    // Document-level OR: any of these satisfies.
    doc.security = [{ bearerAuth: [] }, { apiKeyHeader: [] }, { oauth2: ["read"] }];
    mark(ctx, "security.requirement.or");
}

export function genSecurityMatrix(ctx: GenContext, doc: OpenAPIDocument): void {
    const components: ComponentsIR = doc.components ?? {};
    doc.components = components;
    installSecurityMatrix(ctx, components, doc);

    doc.paths ??= {};

    const ok = () => textPlainResponse(ctx, "OK");

    if (remainingPaths(ctx) > 0 && remainingOps(ctx) > 0) {
        const item: PathItemIR = {};
        attachOp(
            item,
            "get",
            {
                operationId: uniqueOperationId(ctx, "listSecure"),
                responses: { "200": { kind: "inline", value: ok() } },
            },
            ctx,
        );
        doc.paths["/secure"] = item;
        ctx.pathCount++;
        mark(ctx, "path.static");
    }

    if (remainingPaths(ctx) > 0 && remainingOps(ctx) > 0) {
        const item: PathItemIR = {};
        attachOp(
            item,
            "get",
            {
                operationId: uniqueOperationId(ctx, "andGate"),
                security: [{ apiKeyHeader: [], oauth2: ["read", "write"] }],
                responses: { "200": { kind: "inline", value: jsonResponse(ctx, { kind: "inline", value: primitiveSchema(ctx, "string") }, "OK", "2xx") } },
            },
            ctx,
        );
        doc.paths["/and"] = item;
        ctx.pathCount++;
        mark(ctx, "security.requirement.and");
        mark(ctx, "path.static");
    }

    if (remainingPaths(ctx) > 0 && remainingOps(ctx) > 0) {
        const item: PathItemIR = {};
        attachOp(
            item,
            "get",
            {
                operationId: uniqueOperationId(ctx, "optionalAuth"),
                security: [],
                responses: { "200": { kind: "inline", value: ok() } },
            },
            ctx,
        );
        doc.paths["/optional"] = item;
        ctx.pathCount++;
        mark(ctx, "op.security.optional");
        mark(ctx, "path.static");
    }

    if (remainingPaths(ctx) > 0 && remainingOps(ctx) > 0) {
        const item: PathItemIR = {};
        attachOp(
            item,
            "get",
            {
                operationId: uniqueOperationId(ctx, "digestOnly"),
                security: [{ digestAuth: [] }],
                responses: { "200": { kind: "inline", value: ok() } },
            },
            ctx,
        );
        doc.paths["/digest"] = item;
        ctx.pathCount++;
        mark(ctx, "op.security.override");
        mark(ctx, "path.static");
    }

    if (ctx.dialect === "3.1" && remainingPaths(ctx) > 0 && remainingOps(ctx) > 0) {
        const item: PathItemIR = {};
        attachOp(
            item,
            "get",
            {
                operationId: uniqueOperationId(ctx, "mtlsOnly"),
                security: [{ mtls: [] }],
                responses: { "200": { kind: "inline", value: ok() } },
            },
            ctx,
        );
        doc.paths["/mtls"] = item;
        ctx.pathCount++;
        mark(ctx, "path.static");
    }

    if (ctx.tagNames.length) doc.tags = ctx.tagNames.map((name) => ({ name }));
}
