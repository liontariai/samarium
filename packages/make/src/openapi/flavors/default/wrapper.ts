const Proxy = globalThis.Proxy;
Proxy.prototype = {};

/** Wrap real response data so property access re-enters the SelectionWrapper handler (Array.isArray works). */
export function proxify(_data: any, slw: SelectionWrapperImpl<any, any, any, any, any>): any & ArrayLike<any> {
    const data = _data;
    const proxy = new Proxy(data as any | any[], {
        get(target: any[], prop: PropertyKey, receiver: any): any {
            return Reflect.get(slw, prop, receiver);
        },
        set(target: any[], prop: PropertyKey, value: any, receiver: any): boolean {
            return Reflect.set(slw, prop, value, receiver);
        },
        has(target: any[], prop: PropertyKey): boolean {
            return Reflect.has(slw, prop);
        },
        deleteProperty(target: any[], prop: PropertyKey): boolean {
            return Reflect.deleteProperty(slw, prop);
        },
        ownKeys(target: any[]): ArrayLike<string | symbol> {
            return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor(target: any[], prop: PropertyKey): PropertyDescriptor | undefined {
            return Reflect.getOwnPropertyDescriptor(target, prop);
        },
        getPrototypeOf(target: any[]): object | null {
            return Object.getPrototypeOf(target);
        },
    });
    return proxy as unknown as any & ArrayLike<any>;
}

type FnOrPromisOrPrimitive =
    | (() => string | { [key: string]: string } | undefined)
    | (() => Promise<string | { [key: string]: string } | undefined>)
    | string
    | { [key: string]: string };

/** Per-call source passed to `.auth(source)` and into the global `auth` resolver. */
export type AuthSource = unknown;
/** Value returned by the global `auth` resolver (or a direct per-call token/headers). */
export type AuthResult = string | { [key: string]: string } | undefined;
/** Global `init({ auth })` resolver — called per SDK request with the optional `.auth(source)` argument. */
export type AuthResolver =
    | ((source?: AuthSource) => AuthResult)
    | ((source?: AuthSource) => Promise<AuthResult>);

export const _ = Symbol("_") as any;
export const OPTIONS = Symbol("OPTIONS");

/** OpenAPI 3 parameter `style` values (serialization). */
export type OpenAPIParameterStyle =
    | "matrix"
    | "label"
    | "form"
    | "simple"
    | "spaceDelimited"
    | "pipeDelimited"
    | "deepObject";

type ParamEncodingMeta = {
    type?: string;
    location: "path" | "query" | "header" | "cookie" | "body";
    style?: OpenAPIParameterStyle;
    explode?: boolean;
    contentType?: string;
};

/** One OpenAPI security requirement object (AND of named schemes → scopes). */
export type SecurityRequirement = Record<string, string[]>;

/** Runtime security scheme used to place credentials on the wire. */
export type SecuritySchemeRuntime =
    | {
          name: string;
          type: "apiKey";
          apiKeyName: string;
          apiKeyIn: "header" | "query" | "cookie";
      }
    | {
          name: string;
          type: "http";
          scheme: string;
          bearerFormat?: string;
      }
    | {
          name: string;
          type: "oauth2" | "openIdConnect";
      }
    | {
          name: string;
          type: "mutualTLS";
      };

export type AppliedAuth = {
    headers: Record<string, string>;
    query: Record<string, string>;
    cookie: Record<string, string>;
};

/** Runtime server object — only fields needed for URL resolution. */
export type ServerVariableRuntime = {
    default: string;
    enum?: string[];
};

export type ServerRuntime = {
    url: string;
    variables?: Record<string, ServerVariableRuntime>;
};

function emptyAppliedAuth(): AppliedAuth {
    return { headers: {}, query: {}, cookie: {} };
}

/** Place `Authorization`, optionally prefixing Bearer/Basic when missing. */
function authorizationHeader(value: string, prefix?: "Bearer" | "Basic"): AppliedAuth {
    const token =
        prefix && !new RegExp(`^${prefix}\\s+`, "i").test(value) ? `${prefix} ${value}` : value;
    return { ...emptyAppliedAuth(), headers: { Authorization: token } };
}

export function applySecurityCredential(
    scheme: SecuritySchemeRuntime,
    value: string,
): AppliedAuth {
    if (scheme.type === "apiKey") {
        const bucket =
            scheme.apiKeyIn === "header" ? "headers" : scheme.apiKeyIn === "query" ? "query" : "cookie";
        return { ...emptyAppliedAuth(), [bucket]: { [scheme.apiKeyName]: value } };
    }
    if (scheme.type === "http") {
        const s = scheme.scheme.toLowerCase();
        if (s === "bearer") return authorizationHeader(value, "Bearer");
        if (s === "basic") return authorizationHeader(value, "Basic");
        // digest and other http schemes: pass through as Authorization value
        return authorizationHeader(value);
    }
    if (scheme.type === "oauth2" || scheme.type === "openIdConnect") {
        return authorizationHeader(value, "Bearer");
    }
    // mutualTLS: no string credential application
    return emptyAppliedAuth();
}

function mergeAppliedAuth(into: AppliedAuth, from: AppliedAuth): AppliedAuth {
    return {
        headers: { ...into.headers, ...from.headers },
        query: { ...into.query, ...from.query },
        cookie: { ...into.cookie, ...from.cookie },
    };
}

type OpenAPIRequest = {
    path: string;
    method: "get" | "post" | "put" | "delete" | "patch" | "head" | "options" | "trace";
    header: Record<string, any>;
    params: {
        path: Record<string, any>;
        query: Record<string, any>;
    };
    /** Per-arg encoding hints from argsMeta (keyed by arg name). */
    paramMeta?: Record<string, ParamEncodingMeta>;
    body: Record<string, any> | string | FormData | URLSearchParams | undefined;
    cookie: Record<string, any>;
    isEventStream?: boolean;
    requestContentType?: string;
    /** Operation security (OR of AND-requirements); undefined → use doc default. */
    security?: SecurityRequirement[];
    /** Effective servers for this op (op/path override or document). */
    servers?: ServerRuntime[];
};

const isNil = (v: unknown) => v === undefined || v === null;
const asEntries = (v: object) => Object.entries(v as Record<string, unknown>);

/** OAS simple / form non-deepObject object + array flattening. */
function serializeSimple(value: unknown, explode = false): string {
    if (isNil(value)) return "";
    if (Array.isArray(value)) return value.map(String).join(",");
    if (typeof value === "object") {
        const sep = explode ? "=" : ",";
        return asEntries(value)
            .map(([k, v]) => `${k}${sep}${v}`)
            .join(",");
    }
    return String(value);
}

function encodePathParam(
    value: unknown,
    style: OpenAPIParameterStyle = "simple",
    explode = false,
): string {
    if (isNil(value)) return "";
    if (style === "label" || style === "matrix") {
        const p = style === "label" ? "." : ";";
        if (Array.isArray(value)) {
            return `${p}${value.map(String).join(explode ? p : ",")}`;
        }
        if (typeof value === "object") {
            const sep = explode ? "=" : ",";
            return `${p}${asEntries(value)
                .map(([k, v]) => `${k}${sep}${v}`)
                .join(explode ? p : ",")}`;
        }
        return `${p}${String(value)}`;
    }
    // Path `simple` ignores explode for arrays/objects (OAS).
    return serializeSimple(value, false);
}

function appendQueryParam(
    qs: URLSearchParams,
    name: string,
    value: unknown,
    style: OpenAPIParameterStyle = "form",
    explode = true,
): void {
    if (isNil(value)) return;
    if (Array.isArray(value)) {
        if (style === "spaceDelimited") qs.set(name, value.map(String).join(" "));
        else if (style === "pipeDelimited") qs.set(name, value.map(String).join("|"));
        else if (explode) for (const v of value) qs.append(name, String(v));
        else qs.set(name, value.map(String).join(","));
        return;
    }
    if (typeof value === "object") {
        const entries = asEntries(value);
        if (style === "deepObject") for (const [k, v] of entries) qs.set(`${name}[${k}]`, String(v));
        else if (explode) for (const [k, v] of entries) qs.set(k, String(v));
        else qs.set(name, serializeSimple(value, false));
        return;
    }
    qs.set(name, String(value));
}

/** OAS header `style: simple` serialization → header field value. */
export function encodeHeaderParam(
    value: unknown,
    _style: OpenAPIParameterStyle = "simple",
    explode = false,
): string {
    return serializeSimple(value, explode);
}

/**
 * OAS cookie `style: form` serialization → one or more `name=value` segments
 * joined with `; ` for the Cookie header.
 */
export function encodeCookieParam(
    name: string,
    value: unknown,
    _style: OpenAPIParameterStyle = "form",
    explode = true,
): string {
    if (isNil(value)) return "";
    if (Array.isArray(value) && explode) {
        return value.map((v) => `${name}=${String(v)}`).join("; ");
    }
    if (typeof value === "object" && !Array.isArray(value) && explode) {
        return asEntries(value)
            .map(([k, v]) => `${k}=${String(v)}`)
            .join("; ");
    }
    return `${name}=${serializeSimple(value, false)}`;
}

export function substituteServerUrl(
    url: string,
    overrides: Record<string, string> | undefined,
    variables?: Record<string, ServerVariableRuntime>,
): string {
    return url.replace(/\{([^}]+)\}/g, (_, name: string) => {
        if (overrides?.[name] !== undefined) return overrides[name];
        const def = variables?.[name]?.default;
        if (def !== undefined) return def;
        return `{${name}}`;
    });
}

export function joinOriginAndPath(origin: string, path: string): string {
    if (origin === "[ENDPOINT]") {
        return path.startsWith("/") ? `[ENDPOINT]${path}` : `[ENDPOINT]/${path}`;
    }
    const base = origin.replace(/\/$/, "");
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
}

export function resolveRequestOrigin(
    opServers: ServerRuntime[] | undefined,
    options: {
        baseUrl?: string;
        serverVariables?: Record<string, string>;
        documentServers?: ServerRuntime[];
        /** When true (init baseUrl path), do not fill missing vars from OAS defaults. */
        explicitVariablesOnly?: boolean;
    },
): string {
    if (options.baseUrl) {
        // Init-provided origin: substitute with provided variables only (no OAS defaults).
        const substituted =
            options.serverVariables || options.explicitVariablesOnly
                ? substituteServerUrl(options.baseUrl, options.serverVariables, undefined)
                : options.baseUrl;
        return substituted.replace(/\/$/, "");
    }
    const server = opServers?.[0] ?? options.documentServers?.[0];
    if (!server) return "[ENDPOINT]";
    return substituteServerUrl(server.url, options.serverVariables, server.variables).replace(
        /\/$/,
        "",
    );
}

/** Fetch body values we encode — portable (no DOM `BodyInit` / Bun types). */
type RequestBodyInit = string | Blob | ArrayBuffer | Uint8Array | FormData | URLSearchParams;

function encodeRequestBody(
    body: unknown,
    contentType: string | undefined,
): { payload: RequestBodyInit | undefined; contentTypeHeader?: string } {
    if (body === undefined || body === null) return { payload: undefined };
    const ct = contentType ?? "application/json";
    if (ct.includes("application/json") || ct.includes("+json")) {
        return { payload: JSON.stringify(body), contentTypeHeader: "application/json" };
    }
    if (ct.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams();
        if (typeof body === "object" && body !== null) {
            for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
                if (v === undefined || v === null) continue;
                if (Array.isArray(v)) for (const item of v) params.append(k, String(item));
                else params.set(k, String(v));
            }
        }
        return { payload: params, contentTypeHeader: "application/x-www-form-urlencoded" };
    }
    if (ct.includes("multipart/form-data")) {
        const form = new FormData();
        if (typeof body === "object" && body !== null) {
            for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
                if (v === undefined || v === null) continue;
                if (v instanceof Blob) form.append(k, v);
                else form.append(k, String(v));
            }
        }
        // Let fetch set the multipart boundary — do not set Content-Type manually.
        return { payload: form };
    }
    if (ct.includes("text/plain")) {
        return { payload: typeof body === "string" ? body : String(body), contentTypeHeader: "text/plain" };
    }
    if (ct.includes("application/octet-stream")) {
        if (body instanceof Blob || body instanceof ArrayBuffer) {
            return { payload: body, contentTypeHeader: "application/octet-stream" };
        }
        if (ArrayBuffer.isView(body)) {
            // Normalize TypedArray/DataView → Uint8Array for portable fetch body typing.
            return {
                payload: new Uint8Array(body.buffer, body.byteOffset, body.byteLength),
                contentTypeHeader: "application/octet-stream",
            };
        }
        throw new Error(
            `Unsupported body value for content-type "${ct}". Pass a Blob, ArrayBuffer, or TypedArray.`,
        );
    }
    throw new Error(
        `Unsupported request content-type "${ct}". Supported: application/json, application/x-www-form-urlencoded, multipart/form-data, text/plain, application/octet-stream.`,
    );
}

export class RootOperation {
    /** Fallback single-header name when no security schemes are configured (or override). */
    public static authHeaderName = "Authorization";
    /** Compiled `components.securitySchemes` (runtime placement). */
    public static securitySchemes: Record<string, SecuritySchemeRuntime> = {};
    /** First document-level security OR-branch (default for string credentials). */
    public static defaultSecurity: SecurityRequirement | undefined = undefined;
    /** When set, string credentials always go to this header (authConfig override). */
    public static authHeaderOverride: string | undefined = undefined;
    /** Document-level OpenAPI `servers` (used when op has no override). */
    public static documentServers: ServerRuntime[] = [];

    public static configureSecurity(config: {
        schemes?: Record<string, SecuritySchemeRuntime>;
        defaultSecurity?: SecurityRequirement | undefined;
        /** Full document-level security OR list (for authScheme matching). */
        documentSecurity?: SecurityRequirement[] | undefined;
        authHeaderOverride?: string | undefined;
        authScheme?: string | undefined;
    }) {
        if (config.schemes !== undefined) RootOperation.securitySchemes = config.schemes;
        if ("defaultSecurity" in config) RootOperation.defaultSecurity = config.defaultSecurity;
        if ("documentSecurity" in config) {
            RootOperation[OPTIONS].documentSecurity = config.documentSecurity;
        }
        if ("authScheme" in config) RootOperation[OPTIONS].authScheme = config.authScheme;
        if ("authHeaderOverride" in config) {
            RootOperation.authHeaderOverride = config.authHeaderOverride;
            if (config.authHeaderOverride) {
                RootOperation.authHeaderName = config.authHeaderOverride;
            } else {
                RootOperation.authHeaderName = "Authorization";
            }
        }
    }

    public static configureServers(config: { servers?: ServerRuntime[] }) {
        if (config.servers !== undefined) RootOperation.documentServers = config.servers;
    }

    /** Clear scheme config (tests). */
    public static resetSecurity() {
        RootOperation.securitySchemes = {};
        RootOperation.defaultSecurity = undefined;
        RootOperation.authHeaderOverride = undefined;
        RootOperation.authHeaderName = "Authorization";
        RootOperation[OPTIONS].authScheme = undefined;
        RootOperation[OPTIONS].documentSecurity = undefined;
    }

    /** Clear servers + baseUrl (tests). */
    public static resetServers() {
        RootOperation.documentServers = [];
        RootOperation[OPTIONS].baseUrl = undefined;
        RootOperation[OPTIONS].serverVariables = undefined;
        RootOperation[OPTIONS].baseUrlExplicitVariables = false;
    }

    private applyStringCredential = (
        value: string,
        requirement?: SecurityRequirement,
    ): AppliedAuth => {
        const headerOnly = (name: string): AppliedAuth => ({
            ...emptyAppliedAuth(),
            headers: { [name]: value },
        });
        if (RootOperation.authHeaderOverride) {
            return headerOnly(RootOperation.authHeaderOverride);
        }
        const schemes = RootOperation.securitySchemes;
        const schemeNames = Object.keys(schemes);
        if (schemeNames.length === 0) {
            return headerOnly(RootOperation.authHeaderName);
        }
        const req =
            requirement ??
            RootOperation.defaultSecurity ??
            ({ [schemeNames[0]]: [] } as SecurityRequirement);
        // String credentials are a single value — place on the first scheme in the
        // requirement only. AND requirements with multiple schemes need a scheme map.
        const firstSchemeName = Object.keys(req)[0];
        if (!firstSchemeName) return emptyAppliedAuth();
        const scheme = schemes[firstSchemeName];
        if (!scheme) {
            // Unknown scheme name — fall back to default header.
            return headerOnly(RootOperation.authHeaderName);
        }
        // May be empty for mutualTLS (no string credential placement).
        return applySecurityCredential(scheme, value);
    };

    private applyAuthResult = (
        result: AuthResult,
        requirement?: SecurityRequirement,
    ): AppliedAuth | undefined => {
        if (result === undefined || result === null) return undefined;
        if (typeof result === "string") {
            return this.applyStringCredential(result, requirement);
        }
        // Object: scheme-name map if all keys match known schemes; else raw headers.
        const keys = Object.keys(result);
        const schemes = RootOperation.securitySchemes;
        if (
            keys.length > 0 &&
            Object.keys(schemes).length > 0 &&
            keys.every((k) => k in schemes)
        ) {
            let applied = emptyAppliedAuth();
            for (const [schemeName, value] of Object.entries(result)) {
                if (typeof value !== "string") continue;
                applied = mergeAppliedAuth(
                    applied,
                    applySecurityCredential(schemes[schemeName], value),
                );
            }
            return applied;
        }
        return { ...emptyAppliedAuth(), headers: result };
    };

    private resolveFnOrPromisOrPrimitiveAuth = (
        arg: FnOrPromisOrPrimitive,
        requirement?: SecurityRequirement,
    ): AppliedAuth | Promise<AppliedAuth | undefined> | undefined => {
        if (typeof arg === "string") {
            return this.applyStringCredential(arg, requirement);
        }
        if (typeof arg === "function") {
            const tokenOrPromise = arg();
            if (tokenOrPromise instanceof Promise) {
                return tokenOrPromise.then((t) => this.applyAuthResult(t, requirement));
            }
            return this.applyAuthResult(tokenOrPromise, requirement);
        }
        return this.applyAuthResult(arg, requirement);
    };

    /**
     * Resolve auth placement for this request.
     * 1. Global `auth` resolver (with optional per-call source)
     * 2. Per-call `.auth(token|headers|fn)` when no global resolver
     * 3. Static `authToken` from init
     *
     * `requirement === null` means explicit optional security (`security: []`) — no placement.
     */
    private resolveAuth = async (
        authArg?: AuthSource,
        requirement?: SecurityRequirement | null,
    ): Promise<AppliedAuth | undefined> => {
        if (requirement === null) return undefined;
        const authFn = RootOperation[OPTIONS]._auth_fn;
        if (authFn) {
            const result = await authFn(authArg);
            return this.applyAuthResult(result, requirement);
        }
        if (authArg !== undefined && authArg !== null) {
            if (
                typeof authArg === "string" ||
                typeof authArg === "function" ||
                (typeof authArg === "object" && authArg !== null && !(authArg instanceof Request))
            ) {
                return this.resolveFnOrPromisOrPrimitiveAuth(
                    authArg as FnOrPromisOrPrimitive,
                    requirement,
                );
            }
            return undefined;
        }
        if (RootOperation[OPTIONS]._auth_token !== undefined) {
            return this.applyStringCredential(
                RootOperation[OPTIONS]._auth_token,
                requirement,
            );
        }
        return undefined;
    };

    constructor(public authArg?: AuthSource) { }

    public setAuth(auth: AuthSource) {
        this.authArg = auth;
        return this;
    }

    public static [OPTIONS] = {
        headers: {} as Record<string, string>,
        _auth_fn: undefined as AuthResolver | undefined,
        /** Static token for CLI/scripts — never set this per SSR request. */
        _auth_token: undefined as string | undefined,
        /** Absolute origin override; when set, ignores OpenAPI servers. */
        baseUrl: undefined as string | undefined,
        /** Overrides for `{var}` placeholders in the selected / init base URL. */
        serverVariables: undefined as Record<string, string> | undefined,
        /** True when baseUrl came from init object form — do not apply OAS variable defaults. */
        baseUrlExplicitVariables: false as boolean,
        /** Preferred security scheme name for OR-branch selection. */
        authScheme: undefined as string | undefined,
        /** Document-level security OR list (when configured). */
        documentSecurity: undefined as SecurityRequirement[] | undefined,
        fetcher: undefined as unknown as (
            input: string | URL | globalThis.Request,
            init?: RequestInit,
        ) => Promise<Response>,
        sseFetchTransform: undefined as unknown as (
            input: string | URL | globalThis.Request,
            init?: RequestInit,
        ) => Promise<[string | URL | globalThis.Request, RequestInit | undefined]>
            | [string | URL | globalThis.Request, RequestInit | undefined],
        scalars: {
            DateTime: (value: string) => new Date(value),
            DateTimeISO: (value: string) => new Date(value),
            Date: (value: string) => new Date(value),
            Time: (value: string) => new Date(value),
            JSON: (value: string) => JSON.parse(value),
        },
    };

    private rootCollector: OperationSelectionCollector | undefined = undefined;
    public registerRootCollector(collector: OperationSelectionCollector) {
        this.rootCollector = collector;
    }

    private buildRequestUrl(request: OpenAPIRequest): {
        finalPath: string;
        cookies: string;
        encodedHeaders: Record<string, string>;
    } {
        let finalPath = request.path.replace(/\{([^}]+)\}/g, (_, key) => {
            const meta = request.paramMeta?.[key];
            const encoded = encodePathParam(
                request.params.path[key],
                meta?.style ?? "simple",
                meta?.explode ?? false,
            );
            // matrix/label styles already include their prefix; strip the `{param}` token.
            if ((meta?.style === "matrix" || meta?.style === "label") && encoded.startsWith(meta.style === "matrix" ? ";" : ".")) {
                return encoded;
            }
            return encodeURIComponent(encoded).replace(/%2C/g, ",");
        });
        const qs = new URLSearchParams();
        for (const [key, value] of Object.entries(request.params.query ?? {})) {
            const meta = request.paramMeta?.[key];
            appendQueryParam(qs, key, value, meta?.style ?? "form", meta?.explode ?? true);
        }
        const finalQuery = qs.toString();
        finalPath = `${finalPath.replace(/\{.*?\}$/, "")}${finalQuery ? `?${finalQuery}` : ""}`;

        const cookieParts: string[] = [];
        for (const [key, value] of Object.entries(request.cookie ?? {})) {
            if (value === undefined || value === null) continue;
            const meta = request.paramMeta?.[key];
            // Auth-applied cookies are plain strings; encodeCookieParam handles those as name=value.
            const encoded = encodeCookieParam(
                key,
                value,
                meta?.style ?? "form",
                meta?.explode ?? true,
            );
            if (encoded) cookieParts.push(encoded);
        }

        const encodedHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(request.header ?? {})) {
            if (value === undefined || value === null) continue;
            const meta = request.paramMeta?.[key];
            encodedHeaders[key] = encodeHeaderParam(
                value,
                meta?.style ?? "simple",
                meta?.explode ?? false,
            );
        }

        return { finalPath, cookies: cookieParts.join("; "), encodedHeaders };
    }

    private resolveFullUrl(request: OpenAPIRequest, finalPath: string): string {
        const origin = resolveRequestOrigin(request.servers, {
            baseUrl: RootOperation[OPTIONS].baseUrl,
            serverVariables: RootOperation[OPTIONS].serverVariables,
            documentServers: RootOperation.documentServers,
            explicitVariablesOnly: RootOperation[OPTIONS].baseUrlExplicitVariables,
        });
        return joinOriginAndPath(origin, finalPath);
    }

    /** Prefer OR-branch containing `preferred`, else undefined (caller supplies fallback). */
    private preferRequirement(
        list: SecurityRequirement[],
        preferred: string | undefined,
    ): SecurityRequirement | undefined {
        if (!preferred) return undefined;
        return list.find((req) => preferred in req);
    }

    /**
     * Resolve the security requirement for this operation.
     * - `undefined` security on the op → document default (OR list / single)
     * - `[]` → `null` (explicitly optional; no credential placement)
     * - otherwise → OR-branch matching `OPTIONS.authScheme`, else first branch
     */
    private requirementForRequest(
        request: OpenAPIRequest,
    ): SecurityRequirement | undefined | null {
        const preferred = RootOperation[OPTIONS].authScheme;
        if (request.security !== undefined) {
            if (request.security.length === 0) return null;
            return this.preferRequirement(request.security, preferred) ?? request.security[0];
        }
        const docOr = RootOperation[OPTIONS].documentSecurity;
        if (docOr?.length) {
            const match = this.preferRequirement(docOr, preferred);
            if (match) return match;
        }
        return RootOperation.defaultSecurity;
    }

    public async execute(headers: Record<string, string> = {}) {
        if (!this.rootCollector) {
            throw new Error("RootOperation has no registered collector");
        }

        type selection = ReturnType<typeof OperationSelectionCollector.prototype.renderSelections>;
        const varsByLocation = (sel: selection, loc: string) =>
            Object.fromEntries(
                Object.entries(sel.variableDefinitions)
                    .filter(([_, v]) => v.location === loc)
                    .map(([k]) => [k, sel.variables[k]]),
            );
        const pickBody = (sel: selection) => {
            const defs = sel.variableDefinitions;
            const bodyEntries = Object.entries(defs).filter(([_, v]) => v.location === "body");
            if (bodyEntries.length === 0) return undefined;
            if (bodyEntries.length === 1 && Object.keys(defs).length === 1) return sel.variables;
            if (bodyEntries.length === 1 && "$body" in defs && "$body" in sel.variables) {
                return sel.variables["$body"];
            }
            return Object.fromEntries(bodyEntries.map(([k]) => [k, sel.variables[k]]));
        };

        const operations: {
            [key: string]: {
                selection: selection;
                rootSlw: SelectionWrapperImpl<string, string, number, any>;
            };
        } = {};
        for (const [opName, opSelection] of this.rootCollector?.selections.entries()) {
            if (opSelection[SLW_LAZY_FLAG]) continue;

            const rootSlw = opSelection;
            const selection = rootSlw[SLW_PARENT_COLLECTOR]!.renderSelections([], [rootSlw]);

            operations[opName] = {
                selection,
                rootSlw,
            };
        }

        const ops = Object.entries(operations).reduce(
            (acc, [opName, { selection, rootSlw }]) => ({
                ...acc,
                [opName]: {
                    path: rootSlw[ROOT_OP_META]!.path,
                    method: rootSlw[ROOT_OP_META]!.method,
                    isEventStream: rootSlw[ROOT_OP_META]!.isEventStream,
                    requestContentType: rootSlw[ROOT_OP_META]!.requestContentType,
                    security: rootSlw[ROOT_OP_META]!.security,
                    servers: rootSlw[ROOT_OP_META]!.servers,
                    paramMeta: selection.variableDefinitions as Record<string, ParamEncodingMeta>,
                    header: varsByLocation(selection, "header"),
                    params: {
                        path: varsByLocation(selection, "path"),
                        query: varsByLocation(selection, "query"),
                    },
                    body: pickBody(selection),
                    cookie: varsByLocation(selection, "cookie"),
                },
            }),
            {} as Record<string, OpenAPIRequest>,
        );

        const staticHeaders = {
            ...RootOperation[OPTIONS].headers,
            ...headers,
        };

        const results = Object.fromEntries(
            await Promise.all([
                ...Object.entries(ops).map(async ([opName, op]) => {
                    const applied = await this.resolveAuth(
                        this.authArg,
                        this.requirementForRequest(op),
                    );
                    const requestWithAuth: OpenAPIRequest = {
                        ...op,
                        params: {
                            ...op.params,
                            query: { ...op.params.query, ...(applied?.query ?? {}) },
                        },
                        cookie: { ...op.cookie, ...(applied?.cookie ?? {}) },
                    };
                    const requestHeaders = {
                        ...staticHeaders,
                        ...(applied?.headers ?? {}),
                    };
                    return [
                        opName,
                        op.isEventStream
                            ? await this.subscribeOperation(requestWithAuth, requestHeaders)
                            : await this.executeOperation(requestWithAuth, requestHeaders),
                    ] as const;
                }),
            ]),
        );

        return results;
    }

    private async executeOperation(request: OpenAPIRequest, headers: Record<string, string> = {}) {
        const { finalPath, cookies, encodedHeaders } = this.buildRequestUrl(request);
        const bodyContentType =
            request.requestContentType ??
            Object.values(request.paramMeta ?? {}).find((m) => m.location === "body")?.contentType;
        const { payload, contentTypeHeader } = encodeRequestBody(request.body, bodyContentType);
        const url = this.resolveFullUrl(request, finalPath);

        const res = await (RootOperation[OPTIONS].fetcher ?? globalThis.fetch)(url, {
            method: request.method,
            headers: {
                ...(contentTypeHeader ? { "Content-Type": contentTypeHeader } : {}),
                ...encodedHeaders,
                ...(cookies ? { Cookie: cookies } : {}),
                ...headers,
            },
            body: payload,
        });

        if (res && typeof res === "object" && "ok" in res && res.ok === false) {
            const errText = typeof res.text === "function" ? await res.text() : "";
            throw new Error(`${res.statusText ?? "Request failed"}: ${errText}`);
        }

        // Prefer content-type when present; fall back to `.json()` for minimal fetch mocks in tests.
        const responseType =
            res?.headers && typeof res.headers.get === "function"
                ? (res.headers.get("content-type") ?? "")
                : "";
        if (!responseType) {
            if (typeof res?.json === "function") return (await res.json()) as any;
            if (typeof res?.text === "function") {
                const text = await res.text();
                if (!text) return undefined as any;
                try {
                    return JSON.parse(text) as any;
                } catch {
                    return text as any;
                }
            }
            return res as any;
        }
        if (responseType.includes("application/json") || responseType.includes("+json")) {
            const text = await res.text();
            if (!text) return undefined as any;
            try {
                return JSON.parse(text) as any;
            } catch {
                return text as any;
            }
        }
        if (responseType.includes("text/")) {
            return (await res.text()) as any;
        }
        if (typeof res.arrayBuffer === "function") {
            return (await res.arrayBuffer()) as any;
        }
        return (await res.json()) as any;
    }

    /**
     * SSE for OpenAPI operations whose success content is text/event-stream.
     * Yields bare JSON payloads from `data:` lines (not a GraphQL envelope).
     */
    private async subscribeOperation(
        request: OpenAPIRequest,
        headers: Record<string, string> = {},
    ): Promise<{
        generator: AsyncGenerator<any, void, unknown>;
        abortController: AbortController | undefined;
        [SLW_IS_ASYNC_ITERABLE]: true;
    }> {
        const abortState = { controller: undefined as AbortController | undefined };
        const { finalPath, cookies, encodedHeaders } = this.buildRequestUrl(request);
        const resolvedUrl = this.resolveFullUrl(request, finalPath);

        const generator = (async function* () {
            let reader: import("stream/web").ReadableStreamDefaultReader<any> | undefined = undefined;

            try {
                abortState.controller = new AbortController();

                const defaultUrl = resolvedUrl;
                const defaultInit: RequestInit = {
                    method: request.method,
                    headers: {
                        ...(request.body ? { "Content-Type": "application/json" } : {}),
                        ...encodedHeaders,
                        ...(cookies ? { Cookie: cookies } : {}),
                        ...headers,
                        Accept: "text/event-stream",
                    },
                    body: request.body ? JSON.stringify(request.body) : undefined,
                    signal: abortState.controller.signal,
                };

                const transform =
                    RootOperation[OPTIONS].sseFetchTransform ??
                    ((url: string | URL | Request, options?: RequestInit) => [url, options] as const);
                const transformed = await transform(defaultUrl, defaultInit);
                const [url, options] = transformed as [
                    string | URL | Request,
                    RequestInit | undefined,
                ];

                const response = await (RootOperation[OPTIONS].fetcher ?? globalThis.fetch)(url, {
                    ...options,
                    signal: abortState.controller.signal,
                    headers: {
                        ...options?.headers,
                        Accept: "text/event-stream",
                    },
                });

                if (!response.ok) {
                    throw new Error(`${response.statusText}: ${await response.text()}`);
                }

                reader = response.body!.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const events = buffer.split("\n\n");
                    buffer = events.pop() || "";

                    for (const event of events) {
                        if (!event.trim()) continue;

                        const eventName = event.match(/^event: (.*)$/m)?.[1];
                        const rawdata = event.match(/^data: (.*)$/m)?.[1];

                        if ((eventName === null && rawdata === "") || !rawdata) continue;
                        if (eventName === "complete") break;

                        try {
                            yield JSON.parse(rawdata);
                        } catch (e) {
                            // Non-JSON data lines: yield raw string
                            yield rawdata;
                        }
                    }
                }

                return;
            } catch (error) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    console.error(error);
                }
            } finally {
                abortState.controller?.abort();
                if (reader) {
                    await reader.cancel().catch(() => { });
                }
            }
            return;
        })();

        return {
            generator,
            get abortController() {
                return abortState.controller;
            },
            [SLW_IS_ASYNC_ITERABLE]: true,
        };
    }
}

export type OperationSelectionCollectorRef = {
    ref: OperationSelectionCollector;
};
export class OperationSelectionCollector {
    constructor(
        public readonly name?: string,
        public readonly parent?: OperationSelectionCollector | OperationSelectionCollectorRef,
        public readonly op?: RootOperation,
    ) {
        if (op) op.registerRootCollector(this);
    }

    private executed = false;
    private operationResult: any | undefined = undefined;

    /** Path → resolved data / proxied arrays (stable identity for frameworks). */
    public cache: {
        data: Map<string, any>;
        proxiedArray: Map<string, any[]>;
    } = {
            data: new Map(),
            proxiedArray: new Map(),
        };

    public async execute(headers: Record<string, string> = RootOperation[OPTIONS].headers) {
        if (!this.op) {
            throw new Error("OperationSelectionCollector is not registered to a root operation");
        }
        this.operationResult = await this.op.execute(headers);
        this.executed = true;
        return this.operationResult;
    }
    public get isExecuted() {
        return this.executed;
    }

    public readonly selections = new Map<string, SelectionWrapperImpl<string, string, number, any>>();
    public registerSelection(id: string, selection: SelectionWrapperImpl<string, string, number, any, any>) {
        this.selections.set(id, selection);
    }

    public renderSelections(
        path: string[] = [],
        renderOnlyTheseSelections: SelectionWrapperImpl<string, string, number, any>[] = [],
    ) {
        const varDefs: Record<string, ParamEncodingMeta> = {};
        const variables: Record<string, any> = {};

        for (const [key, value] of [...this.selections.entries()].filter(
            ([k, v]) =>
                renderOnlyTheseSelections.length === 0 ||
                renderOnlyTheseSelections.find((r) => r[SLW_UID] === v[SLW_UID]),
        )) {
            const subPath = [...path, key];
            const { variableDefinitions: fieldVarDefs, variables: fieldVars } = value[SLW_RENDER_WITH_ARGS]();

            Object.assign(variables, fieldVars);
            Object.assign(varDefs, fieldVarDefs);

            value[SLW_REGISTER_PATH](subPath);

            if (value[SLW_PARENT_COLLECTOR] === undefined) {
                // do nothing
            } else if (value[SLW_COLLECTOR] instanceof OperationSelectionCollector) {
                const { variableDefinitions: subVarDefs, variables: subVars } =
                    value[SLW_COLLECTOR].renderSelections(subPath);

                Object.assign(variables, subVars);
                Object.assign(varDefs, subVarDefs);
            }
        }

        return {
            variableDefinitions: varDefs,
            variables,
        };
    }

    private utilGet = (obj: Record<string, any>, path: (string | number)[]) => path.reduce((o, p) => o?.[p], obj);
    public getOperationResultPath<T>(
        path: (string | number)[] = [],
        type?: string,
        opResultDataOverride?: any,
    ): T {
        if (!this.op) {
            throw new Error("OperationSelectionCollector is not registered to a root operation");
        }

        let result = opResultDataOverride ?? this.operationResult;

        if (path.length === 0) return result as T;

        result = this.utilGet(result, path) as T;

        const typeName = type?.replaceAll("!", "");
        if (typeName && result && typeName in RootOperation[OPTIONS].scalars) {
            let depth = 0;
            let finalResult = result instanceof Array ? [...result] : result;

            while (result instanceof Array) {
                result = result[0];
                depth++;
            }

            const deepParse = (res: any | any[], depth: number, parse: (v: string) => any) => {
                if (depth === 0) {
                    return parse(res);
                }
                return res.map((rarr: any) => deepParse(rarr, depth - 1, parse));
            };

            return deepParse(
                finalResult,
                depth,
                RootOperation[OPTIONS].scalars[typeName as keyof (typeof RootOperation)[typeof OPTIONS]["scalars"]] ??
                ((value: string) => JSON.parse(value)),
            ) as T;
        }

        return result as T;
    }
}

export const SLW_UID = Symbol("SLW_UID");
export const SLW_FIELD_NAME = Symbol("SLW_FIELD_NAME");
export const SLW_FIELD_TYPENAME = Symbol("SLW_FIELD_TYPENAME");
export const SLW_FIELD_ARR_DEPTH = Symbol("SLW_FIELD_ARR_DEPTH");

export const ROOT_OP_META = Symbol("ROOT_OP_META");

export const SLW_VALUE = Symbol("SLW_VALUE");
export const SLW_ARGS = Symbol("SLW_ARGS");
export const SLW_ARGS_META = Symbol("SLW_ARGS_META");
export const SLW_PARENT_SLW = Symbol("SLW_PARENT_SLW");
export const SLW_LAZY_FLAG = Symbol("SLW_LAZY_FLAG");

export const OP = Symbol("OP");
export const ROOT_OP_COLLECTOR = Symbol("ROOT_OP_COLLECTOR");
export const SLW_PARENT_COLLECTOR = Symbol("SLW_PARENT_COLLECTOR");
export const SLW_COLLECTOR = Symbol("SLW_COLLECTOR");
export const SLW_OP_PATH = Symbol("SLW_OP_PATH");
export const SLW_REGISTER_PATH = Symbol("SLW_REGISTER_PATH");
export const SLW_RENDER_WITH_ARGS = Symbol("SLW_RENDER_WITH_ARGS");

export const SLW_OP_RESULT_DATA_OVERRIDE = Symbol("SLW_OP_RESULT_DATA_OVERRIDE");
export const SLW_RECREATE_VALUE_CALLBACK = Symbol("SLW_RECREATE_VALUE_CALLBACK");
export const SLW_NEEDS_CLONE = Symbol("SLW_NEEDS_CLONE");
export const SLW_CLONE = Symbol("SLW_CLONE");
export const SLW_IS_ASYNC_ITERABLE = Symbol("SLW_IS_ASYNC_ITERABLE");

export const OP_SCALAR_RESULT = Symbol("OP_SCALAR_RESULT");
export const SLW_IS_SCALAR_OP = Symbol("SLW_IS_SCALAR_OP");

export class SelectionWrapperImpl<
    fieldName extends string,
    typeNamePure extends string,
    typeArrDepth extends number,
    valueT extends any = any,
    argsT extends Record<string, any> | any | undefined = undefined,
> {
    private generateUniqueId(): string {
        return performance.now().toString(36) + Math.random().toString(36).substring(2);
    }
    [SLW_CLONE](
        overrides: {
            SLW_OP_PATH?: string;
            OP_RESULT_DATA?: any;
            SLW_NEEDS_CLONE?: boolean;
        } = {},
    ) {
        const slw = new SelectionWrapper(
            this[SLW_FIELD_NAME],
            this[SLW_FIELD_TYPENAME],
            this[SLW_FIELD_ARR_DEPTH],
            this[SLW_VALUE],
            this[SLW_COLLECTOR],
            this[SLW_PARENT_COLLECTOR],
            this[SLW_ARGS],
            this[SLW_ARGS_META],
            this[SLW_RECREATE_VALUE_CALLBACK],
            this[SLW_IS_SCALAR_OP],
        );
        slw[ROOT_OP_META] = this[ROOT_OP_META];
        slw[SLW_PARENT_SLW] = this[SLW_PARENT_SLW];
        slw[SLW_OP_PATH] = overrides.SLW_OP_PATH ?? this[SLW_OP_PATH];
        slw[SLW_NEEDS_CLONE] = overrides.SLW_NEEDS_CLONE ? true : this[SLW_NEEDS_CLONE] ? false : true;
        if (overrides.OP_RESULT_DATA !== undefined) {
            slw[SLW_OP_RESULT_DATA_OVERRIDE] = overrides.OP_RESULT_DATA;
        } else if (this[SLW_OP_RESULT_DATA_OVERRIDE] !== undefined) {
            slw[SLW_OP_RESULT_DATA_OVERRIDE] = this[SLW_OP_RESULT_DATA_OVERRIDE];
        }
        // Keep ROOT_OP_COLLECTOR from the new construction; for clones under same op, re-bind to source collector
        if (this[ROOT_OP_COLLECTOR]) {
            slw[ROOT_OP_COLLECTOR] = this[ROOT_OP_COLLECTOR];
        }
        return slw;
    }

    readonly [SLW_UID] = this.generateUniqueId();
    [ROOT_OP_COLLECTOR]?: OperationSelectionCollectorRef;
    readonly [SLW_PARENT_COLLECTOR]?: OperationSelectionCollector;
    readonly [SLW_COLLECTOR]?: OperationSelectionCollector;

    [SLW_FIELD_NAME]?: fieldName;
    [SLW_FIELD_TYPENAME]?: typeNamePure;
    [SLW_FIELD_ARR_DEPTH]?: typeArrDepth;
    [SLW_VALUE]?: valueT;

    [ROOT_OP_META]?: {
        path: string;
        method: "get" | "post" | "put" | "delete" | "patch" | "head" | "options" | "trace";
        isEventStream?: boolean;
        requestContentType?: string;
        security?: SecurityRequirement[];
        servers?: ServerRuntime[];
    };

    [SLW_ARGS]?: argsT;
    [SLW_ARGS_META]?: Record<string, ParamEncodingMeta>;

    [SLW_PARENT_SLW]?: SelectionWrapperImpl<string, string, number, any, any>;
    [SLW_LAZY_FLAG]?: boolean;

    [SLW_RECREATE_VALUE_CALLBACK]?: () => valueT;
    [SLW_OP_RESULT_DATA_OVERRIDE]?: any;
    [SLW_NEEDS_CLONE]?: boolean;

    [SLW_IS_SCALAR_OP]?: boolean;

    constructor(
        fieldName?: fieldName,
        typeNamePure?: typeNamePure,
        typeArrDepth?: typeArrDepth,
        value?: valueT,
        collector?: OperationSelectionCollector,
        parent?: OperationSelectionCollector | OperationSelectionCollectorRef,
        args?: argsT,
        argsMeta?: Record<string, ParamEncodingMeta>,
        reCreateValueCallback?: () => valueT,
        isScalarOp?: boolean,
    ) {
        this[SLW_FIELD_NAME] = fieldName;
        this[SLW_FIELD_TYPENAME] = typeNamePure;
        this[SLW_FIELD_ARR_DEPTH] = typeArrDepth;
        this[SLW_VALUE] = value;

        this[SLW_ARGS] = args;
        this[SLW_ARGS_META] = argsMeta;

        if (parent instanceof OperationSelectionCollector) {
            this[SLW_PARENT_COLLECTOR] = parent;
        } else if (parent && "ref" in parent) {
            this[SLW_PARENT_COLLECTOR] = parent.ref;
        }

        if (collector instanceof OperationSelectionCollector) {
            this[SLW_COLLECTOR] = collector;

            let rootCollector = collector;
            while (rootCollector?.parent instanceof OperationSelectionCollector) {
                rootCollector = rootCollector.parent;
            }
            if (rootCollector.parent && "ref" in rootCollector.parent) {
                this[ROOT_OP_COLLECTOR] = rootCollector.parent;
            }
        }

        if (reCreateValueCallback) {
            this[SLW_RECREATE_VALUE_CALLBACK] = reCreateValueCallback;
        }
        if (isScalarOp !== undefined) {
            this[SLW_IS_SCALAR_OP] = isScalarOp;
        }
    }

    [SLW_OP_PATH]?: string;
    [SLW_REGISTER_PATH](path: string[]) {
        if (!this[SLW_OP_PATH]) this[SLW_OP_PATH] = path.join(".");
    }
    [SLW_RENDER_WITH_ARGS]() {
        if (this[SLW_ARGS]) {
            const args = this[SLW_ARGS];
            const argsMeta = this[SLW_ARGS_META]!;

            if (typeof args !== "object" || Array.isArray(args)) {
                return {
                    variables: args,
                    variableDefinitions: argsMeta,
                };
            }

            return {
                variables: args ?? {},
                variableDefinitions: argsMeta?.["$body"]
                    ? (argsMeta ?? {})
                    : args
                        ? Object.keys(args).reduce(
                            (acc, key) => {
                                const meta = argsMeta?.[key];
                                if (meta) acc[key] = meta;
                                return acc;
                            },
                            {} as Record<string, ParamEncodingMeta>,
                        )
                        : {},
            };
        }
        return {
            variables: {},
            variableDefinitions: {} as Record<string, ParamEncodingMeta>,
        };
    }
}
export class SelectionWrapper<
    fieldName extends string,
    typeNamePure extends string,
    typeArrDepth extends number,
    valueT extends any = any,
    argsT extends Record<string, any> | any | undefined = undefined,
> extends Proxy<SelectionWrapperImpl<fieldName, typeNamePure, typeArrDepth, valueT, argsT>> {
    constructor(
        fieldName?: fieldName,
        typeNamePure?: typeNamePure,
        typeArrDepth?: typeArrDepth,
        value?: valueT,
        collector?: OperationSelectionCollector,
        parent?: OperationSelectionCollector | OperationSelectionCollectorRef,
        args?: argsT,
        argsMeta?: Record<string, ParamEncodingMeta>,
        reCreateValueCallback?: () => valueT,
        isScalarOp?: boolean,
    ) {
        super(
            new SelectionWrapperImpl<fieldName, typeNamePure, typeArrDepth, valueT, argsT>(
                fieldName,
                typeNamePure,
                typeArrDepth,
                value,
                collector,
                parent,
                args,
                argsMeta,
                reCreateValueCallback,
                isScalarOp,
            ),
            (() => {
                const getCache = (t: SelectionWrapperImpl<fieldName, typeNamePure, typeArrDepth, valueT, argsT>) => {
                    if (t[SLW_OP_RESULT_DATA_OVERRIDE] || !t[ROOT_OP_COLLECTOR]) {
                        return { data: new Map(), proxiedArray: new Map() };
                    }
                    return t[ROOT_OP_COLLECTOR].ref.cache;
                };

                const getResultDataForTarget = (
                    t: SelectionWrapperImpl<fieldName, typeNamePure, typeArrDepth, valueT, argsT>,
                    overrideOpPath?: string,
                ): valueT | undefined => {
                    if (!t[ROOT_OP_COLLECTOR]) return undefined;
                    const cache = getCache(t);
                    const path = overrideOpPath ?? t[SLW_OP_PATH] ?? undefined;

                    if (path && cache.data.has(path) && !t[SLW_NEEDS_CLONE]) return cache.data.get(path);

                    const data = t[ROOT_OP_COLLECTOR].ref.getOperationResultPath<valueT>(
                        (path?.split(".") ?? []).map((p) => (!isNaN(+p) ? +p : p)),
                        t[SLW_FIELD_TYPENAME],
                        t[SLW_OP_RESULT_DATA_OVERRIDE],
                    );

                    if (path && !t[SLW_OP_RESULT_DATA_OVERRIDE]) cache.data.set(path, data);
                    return data;
                };

                return {
                    ownKeys(target) {
                        if (target[SLW_FIELD_ARR_DEPTH]) {
                            return Reflect.ownKeys(new Array(target[SLW_FIELD_ARR_DEPTH]));
                        }
                        return Reflect.ownKeys(value ?? {});
                    },
                    getOwnPropertyDescriptor(target, prop) {
                        if (target[SLW_FIELD_ARR_DEPTH]) {
                            return Reflect.getOwnPropertyDescriptor(new Array(target[SLW_FIELD_ARR_DEPTH]), prop);
                        }
                        return Reflect.getOwnPropertyDescriptor(value ?? {}, prop);
                    },
                    has(target, prop) {
                        if (prop === Symbol.for("nodejs.util.inspect.custom")) return true;
                        if (prop === Symbol.iterator && typeArrDepth) {
                            const dataArr = getResultDataForTarget(target);
                            if (Array.isArray(dataArr)) return true;
                            if (dataArr === undefined || dataArr === null) return false;
                        }
                        if (target[SLW_FIELD_ARR_DEPTH]) {
                            return Reflect.has(new Array(target[SLW_FIELD_ARR_DEPTH]), prop);
                        }
                        return Reflect.has(value ?? {}, prop);
                    },
                    get: (target, prop) => {
                        if (prop === "$lazy") {
                            const that = this;
                            function lazy(
                                this: {
                                    parentSlw: SelectionWrapperImpl<
                                        fieldName,
                                        typeNamePure,
                                        typeArrDepth,
                                        valueT,
                                        argsT
                                    >;
                                    key: string;
                                },
                                args?: argsT,
                            ) {
                                const { parentSlw, key } = this;
                                const newRootOpCollectorRef = {
                                    ref: new OperationSelectionCollector(
                                        undefined,
                                        undefined,
                                        new RootOperation(
                                            that[ROOT_OP_COLLECTOR]?.ref.op?.authArg,
                                        ),
                                    ),
                                };

                                const newThisCollector = new OperationSelectionCollector(
                                    undefined,
                                    newRootOpCollectorRef,
                                );
                                const r = that[SLW_RECREATE_VALUE_CALLBACK]?.bind(newThisCollector)();

                                const newThat = new SelectionWrapper(
                                    that[SLW_FIELD_NAME],
                                    that[SLW_FIELD_TYPENAME],
                                    that[SLW_FIELD_ARR_DEPTH],
                                    r,
                                    newThisCollector,
                                    that[SLW_PARENT_COLLECTOR] ? newRootOpCollectorRef : undefined,
                                    that[SLW_ARGS],
                                    that[SLW_ARGS_META],
                                    that[SLW_RECREATE_VALUE_CALLBACK],
                                    that[SLW_IS_SCALAR_OP],
                                );
                                Object.keys(r!).forEach((key) => (newThat as valueT)[key as keyof valueT]);

                                newThat[ROOT_OP_META] = that[ROOT_OP_META];

                                newThat[SLW_PARENT_SLW] = parentSlw;
                                parentSlw[SLW_COLLECTOR]?.registerSelection(key, newThat);
                                newThat[SLW_ARGS] = {
                                    ...(that[SLW_ARGS] ?? {}),
                                    ...(args as any),
                                } as argsT;

                                newThat[SLW_OP_PATH] = that[SLW_OP_PATH];

                                newRootOpCollectorRef.ref.registerSelection(newThat[SLW_FIELD_NAME]!, newThat);

                                const isScalar = newThat[SLW_PARENT_COLLECTOR] === undefined;

                                return new Promise((resolve, reject) => {
                                    newRootOpCollectorRef.ref
                                        .execute()
                                        .catch(reject)
                                        .then((_data) => {
                                            if (_data === undefined || _data === null) {
                                                return resolve(_data);
                                            }

                                            const fieldName = newThat[SLW_FIELD_NAME]!;
                                            const d = _data[fieldName];

                                            if (d && typeof d === "object" && SLW_IS_ASYNC_ITERABLE in d) {
                                                return resolve(newThat);
                                            }
                                            if (typeof d === "object" && d && fieldName in d) {
                                                const retval = d[fieldName];
                                                if (retval === undefined || retval === null) {
                                                    return resolve(retval);
                                                }
                                                const ret = isScalar
                                                    ? getResultDataForTarget(newThat as any)
                                                    : proxify(retval, newThat);
                                                return resolve(ret);
                                            }

                                            // One-shot body is the op value directly under opName
                                            if (d === undefined || d === null) {
                                                return resolve(d);
                                            }
                                            if (typeof d === "object" && !isScalar) {
                                                return resolve(proxify(d, newThat));
                                            }
                                            return resolve(
                                                isScalar ? getResultDataForTarget(newThat as any) : newThat,
                                            );
                                        });
                                });
                            }
                            target[SLW_LAZY_FLAG] = true;
                            lazy[SLW_LAZY_FLAG] = true;
                            return lazy;
                        }
                        if (prop === SLW_VALUE && target[SLW_IS_SCALAR_OP]) {
                            return (target[SLW_VALUE] as any)[OP_SCALAR_RESULT];
                        }
                        if (
                            prop === SLW_UID ||
                            prop === SLW_FIELD_NAME ||
                            prop === SLW_FIELD_TYPENAME ||
                            prop === SLW_FIELD_ARR_DEPTH ||
                            prop === ROOT_OP_META ||
                            prop === SLW_ARGS ||
                            prop === SLW_ARGS_META ||
                            prop === SLW_PARENT_SLW ||
                            prop === SLW_LAZY_FLAG ||
                            prop === ROOT_OP_COLLECTOR ||
                            prop === SLW_PARENT_COLLECTOR ||
                            prop === SLW_COLLECTOR ||
                            prop === SLW_OP_PATH ||
                            prop === SLW_VALUE ||
                            prop === SLW_REGISTER_PATH ||
                            prop === SLW_RENDER_WITH_ARGS ||
                            prop === SLW_RECREATE_VALUE_CALLBACK ||
                            prop === SLW_OP_RESULT_DATA_OVERRIDE ||
                            prop === SLW_CLONE ||
                            prop === SLW_NEEDS_CLONE ||
                            prop === SLW_IS_SCALAR_OP
                        ) {
                            return target[
                                prop as keyof SelectionWrapperImpl<fieldName, typeNamePure, typeArrDepth, valueT>
                            ];
                        }
                        if (prop === SLW_VALUE) {
                            return value;
                        }
                        if (prop === "then") {
                            return this;
                        }

                        let slw_value = target[SLW_VALUE] as Record<string, any> | undefined;

                        if (target[ROOT_OP_COLLECTOR]?.ref.isExecuted) {
                            if (prop === Symbol.asyncIterator) {
                                const asyncGenRootPath = target[SLW_OP_PATH]?.split(".")?.[0];
                                const asyncGen = getResultDataForTarget(target, asyncGenRootPath) as {
                                    generator: AsyncGenerator<valueT, any, any>;
                                    abortController: AbortController | undefined;
                                };
                                const isScalar = target[SLW_PARENT_COLLECTOR] === undefined;

                                return function () {
                                    return {
                                        return() {
                                            asyncGen.abortController?.abort();
                                            return asyncGen.generator.return(undefined).then((val) => {
                                                return {
                                                    done: val.done,
                                                    value: val.value,
                                                };
                                            });
                                        },

                                        next() {
                                            return asyncGen.generator.next().then((val) => {
                                                // Wrap each event as { [opName]: payload } so SLW_OP_PATH works
                                                const wrapped = {
                                                    [asyncGenRootPath!]: val.value,
                                                };
                                                const clonedSlw = target[SLW_CLONE]({
                                                    SLW_OP_PATH: asyncGenRootPath,
                                                    OP_RESULT_DATA: isScalar
                                                        ? wrapped
                                                        : wrapped,
                                                    SLW_NEEDS_CLONE: true,
                                                });
                                                let out: any = clonedSlw;
                                                if (!isScalar && val.value && typeof val.value === "object") {
                                                    out = proxify(val.value, clonedSlw);
                                                } else if (isScalar) {
                                                    out = getResultDataForTarget(clonedSlw as any, asyncGenRootPath);
                                                }
                                                return {
                                                    done: val.done,
                                                    value: out,
                                                };
                                            });
                                        },
                                    };
                                };
                            }

                            if (!Object.hasOwn(slw_value ?? {}, String(prop))) {
                                const _data = getResultDataForTarget(target);
                                const path = target[SLW_OP_PATH]!;

                                // Async-iterable root: not a plain object
                                if (_data && typeof _data === "object" && SLW_IS_ASYNC_ITERABLE in _data) {
                                    return undefined;
                                }

                                if (typeArrDepth && Array.isArray(_data)) {
                                    if (!isNaN(+String(prop))) {
                                        const elm = target[SLW_CLONE]({
                                            SLW_OP_PATH: path + "." + String(prop),
                                            OP_RESULT_DATA: target[SLW_OP_RESULT_DATA_OVERRIDE],
                                        });
                                        const d = _data[Number(prop)];
                                        if (typeof d === "undefined" || d === null) {
                                            return d;
                                        }
                                        return typeof d === "object" ? proxify(d, elm) : elm;
                                    }

                                    const data = _data as valueT[] | undefined;
                                    if (data === undefined) return undefined;
                                    if (data === null) return null;

                                    const cache = getCache(target);
                                    const proxiedData =
                                        cache.proxiedArray.get(path) ??
                                        Array.from({ length: data.length }, (_, i) =>
                                            typeof data[i] === "object" && data[i] !== null
                                                ? proxify(
                                                    data[i],
                                                    target[SLW_CLONE]({
                                                        SLW_OP_PATH: path + "." + String(i),
                                                        OP_RESULT_DATA: target[SLW_OP_RESULT_DATA_OVERRIDE],
                                                    }),
                                                )
                                                : target[SLW_CLONE]({
                                                    SLW_OP_PATH: path + "." + String(i),
                                                    OP_RESULT_DATA: target[SLW_OP_RESULT_DATA_OVERRIDE],
                                                }),
                                        );

                                    if (!cache.proxiedArray.has(path)) {
                                        cache.proxiedArray.set(path, proxiedData);
                                    }

                                    const proto = Object.getPrototypeOf(proxiedData);
                                    if (Object.hasOwn(proto, prop)) {
                                        const v = (proxiedData as any)[prop];
                                        if (typeof v === "function") return v.bind(proxiedData);
                                        return v;
                                    }

                                    return (proxiedData as any)[prop];
                                }

                                const data = _data as valueT | undefined;
                                if (data === undefined) return undefined;
                                if (data === null) return null;

                                const proto = Object.getPrototypeOf(data);
                                if (Object.hasOwn(proto, prop)) {
                                    const v = (data as any)[prop];
                                    if (typeof v === "function") return v.bind(data);
                                    return v;
                                }

                                return (data as any)[prop];
                            }

                            let slw = slw_value?.[String(prop)];
                            if (slw === undefined) return undefined;
                            if (slw === null) return null;
                            if (typeof slw !== "object") return slw;

                            let slwOpPathIsIndexAccessOrInArray = false;
                            let targetOpPathArr = target[SLW_OP_PATH]?.split(".") ?? [];
                            while (targetOpPathArr.length) {
                                if (!isNaN(+targetOpPathArr.pop()!)) {
                                    slwOpPathIsIndexAccessOrInArray = true;
                                    break;
                                }
                            }
                            if (
                                slw instanceof SelectionWrapperImpl &&
                                (slwOpPathIsIndexAccessOrInArray ||
                                    (target[SLW_OP_RESULT_DATA_OVERRIDE] && !slw[SLW_OP_RESULT_DATA_OVERRIDE]))
                            ) {
                                if (target[SLW_NEEDS_CLONE]) {
                                    slw = slw[SLW_CLONE]({
                                        SLW_OP_PATH: target[SLW_OP_PATH] + "." + String(prop),
                                        OP_RESULT_DATA: target[SLW_OP_RESULT_DATA_OVERRIDE],
                                        SLW_NEEDS_CLONE: true,
                                    });
                                } else {
                                    slw[SLW_OP_PATH] = target[SLW_OP_PATH] + "." + String(prop);
                                    slw[SLW_OP_RESULT_DATA_OVERRIDE] = target[SLW_OP_RESULT_DATA_OVERRIDE];
                                }
                            }

                            if (slw instanceof SelectionWrapperImpl && slw[SLW_FIELD_ARR_DEPTH]) {
                                const dataArr = getResultDataForTarget(slw) as unknown[] | undefined | null;
                                if (dataArr === undefined) return undefined;
                                if (dataArr === null) return null;
                                if (!dataArr?.length) {
                                    return [];
                                }
                                if (slw[SLW_PARENT_COLLECTOR]) {
                                    return proxify(dataArr, slw);
                                }
                            } else if (slw instanceof SelectionWrapperImpl) {
                                const data = getResultDataForTarget(slw) as unknown | undefined | null;
                                if (data === undefined) return undefined;
                                if (data === null) return null;
                                if (data && typeof data === "object" && SLW_IS_ASYNC_ITERABLE in (data as object)) {
                                    return slw;
                                }
                                if (slw[SLW_PARENT_COLLECTOR] && typeof data === "object") {
                                    return proxify(data, slw);
                                }
                            }

                            if (slw instanceof SelectionWrapperImpl) {
                                return getResultDataForTarget(slw);
                            } else if (slw[SLW_LAZY_FLAG]) {
                                return slw;
                            }

                            return getResultDataForTarget(target);
                        }

                        if (
                            Object.hasOwn(slw_value ?? {}, String(prop)) &&
                            slw_value?.[String(prop)] instanceof SelectionWrapperImpl
                        ) {
                            if (target[SLW_COLLECTOR]) {
                                target[SLW_COLLECTOR].registerSelection(String(prop), slw_value[String(prop)]);
                            }
                            if (!slw_value[String(prop)][SLW_PARENT_SLW]) {
                                slw_value[String(prop)][SLW_PARENT_SLW] = target;
                            }
                        }
                        if (slw_value?.[String(prop)]?.[SLW_LAZY_FLAG]) {
                            if (!slw_value[String(prop)][SLW_PARENT_SLW]) {
                                const lazyFn = slw_value[String(prop)];
                                slw_value[String(prop)] = lazyFn.bind({
                                    parentSlw: target,
                                    key: String(prop),
                                });
                                slw_value[String(prop)][SLW_PARENT_SLW] = target;
                                slw_value[String(prop)][SLW_LAZY_FLAG] = true;
                            }
                        }

                        return slw_value?.[String(prop)] ?? undefined;
                    },
                };
            })(),
        );
    }
}
