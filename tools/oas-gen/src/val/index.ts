import { parse as parseYaml } from "yaml";
import type { Dialect, LayerResult, SemanticError, Verdict } from "../types.ts";
import { COMPONENT_KEY_RE, LEGAL_STYLE, RESERVED_HEADER_NAMES, dialectTable } from "../dialects/index.ts";
import { pathTemplateTokens } from "../cons/repair.ts";
import { validateOfficialSchema } from "./official.ts";
import { dereference } from "./dereference.ts";

export function parseDocument(input: unknown): { ok: boolean; value?: unknown; error?: unknown } {
    if (input !== null && typeof input === "object") {
        return { ok: true, value: input };
    }
    if (typeof input !== "string") {
        return { ok: false, error: "document must be an object or a JSON/YAML string" };
    }
    const text = input.replace(/^\uFEFF/, "");
    try {
        return { ok: true, value: JSON.parse(text) };
    } catch {
        try {
            return { ok: true, value: parseYaml(text) };
        } catch (e) {
            return { ok: false, error: e };
        }
    }
}

function isObj(x: unknown): x is Record<string, unknown> {
    return !!x && typeof x === "object" && !Array.isArray(x);
}

function pointer(parts: Array<string | number>): string {
    return "/" + parts.map((p) => String(p).replace(/~/g, "~0").replace(/\//g, "~1")).join("/");
}

function resolveRef(doc: Record<string, unknown>, ref: string): unknown {
    if (!ref.startsWith("#/")) return undefined;
    const parts = ref
        .slice(2)
        .split("/")
        .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
    let cur: unknown = doc;
    for (const p of parts) {
        if (!isObj(cur) && !Array.isArray(cur)) return undefined;
        cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
}

function collectJsonRefs(node: unknown, acc: Array<{ ref: string; path: string }>, path: Array<string | number>): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
        node.forEach((x, i) => collectJsonRefs(x, acc, [...path, i]));
        return;
    }
    const obj = node as Record<string, unknown>;
    if (typeof obj.$ref === "string") acc.push({ ref: obj.$ref, path: pointer([...path, "$ref"]) });
    for (const [k, v] of Object.entries(obj)) {
        if (k === "$ref") continue;
        collectJsonRefs(v, acc, [...path, k]);
    }
}

function mediaTypeOk(mt: string): boolean {
    return /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(mt) || mt === "*/*";
}

const RUNTIME_EXPR = /^\$request\.(path|query|header|body)(\.[A-Za-z0-9_]+|\#\/.*)?$|^\$response\.(header|body)(\.[A-Za-z0-9_]+|\#\/.*)?$|^\$url$|^\$method$|^\$statusCode$|^\$request\.body\#\/.*$/;

function isRuntimeExpr(s: string): boolean {
    if (s.startsWith("$request.") || s.startsWith("$response.") || s === "$url" || s === "$method" || s === "$statusCode") {
        return true;
    }
    return RUNTIME_EXPR.test(s);
}

function paramList(node: unknown): Array<{ p: Record<string, unknown>; path: string }> {
    if (!Array.isArray(node)) return [];
    return node
        .map((p, i) => (isObj(p) ? { p, path: String(i) } : undefined))
        .filter((x): x is { p: Record<string, unknown>; path: string } => !!x);
}

function resolveParam(doc: Record<string, unknown>, p: Record<string, unknown>): Record<string, unknown> | undefined {
    if (typeof p.$ref === "string") {
        const t = resolveRef(doc, p.$ref);
        return isObj(t) ? t : undefined;
    }
    return p;
}

export function semanticCheck(doc: unknown, dialect: Dialect): { ok: boolean; errors: SemanticError[] } {
    const errors: SemanticError[] = [];
    const err = (code: string, path: string, message: string) => errors.push({ code, path, message });
    if (!isObj(doc)) {
        err("not-object", "/", "document is not an object");
        return { ok: false, errors };
    }

    const table = dialectTable(dialect);
    const info = doc.info;
    if (!isObj(info)) err("info.required", "/info", "info is required");
    else {
        if (typeof info.title !== "string" || !info.title) err("info.title", "/info/title", "info.title is required");
        if (typeof info.version !== "string" || !info.version) err("info.version", "/info/version", "info.version is required");
        if (isObj(info.license) && info.license.url && info.license.identifier) {
            err("info.license.xor", "/info/license", "license.url and license.identifier must not both be set");
        }
        if (isObj(info.license) && info.license.identifier && dialect === "3.0") {
            err("dialect.keyword", "/info/license/identifier", "license.identifier is OAS 3.1 only");
        }
    }

    if (doc.jsonSchemaDialect !== undefined && !table.allows.jsonSchemaDialect) {
        err("dialect.keyword", "/jsonSchemaDialect", "jsonSchemaDialect is OAS 3.1 only");
    }
    if (doc.webhooks !== undefined && !table.allows.webhooks) {
        err("dialect.keyword", "/webhooks", "webhooks is OAS 3.1 only");
    }

    const components = isObj(doc.components) ? doc.components : {};
    const schemeNames = new Set(Object.keys(isObj(components.securitySchemes) ? (components.securitySchemes as object) : {}));

    const checkComponentKeys = (tableName: string, map: unknown) => {
        if (!isObj(map)) return;
        for (const k of Object.keys(map)) {
            if (!COMPONENT_KEY_RE.test(k)) {
                err("components.key", `/components/${tableName}/${k}`, `component key must match ${COMPONENT_KEY_RE}`);
            }
        }
    };
    for (const t of [
        "schemas",
        "parameters",
        "responses",
        "requestBodies",
        "headers",
        "examples",
        "securitySchemes",
        "links",
        "callbacks",
        "pathItems",
    ]) {
        checkComponentKeys(t, components[t]);
    }
    if (components.pathItems !== undefined && !table.allows.pathItemsComponents) {
        err("dialect.keyword", "/components/pathItems", "components.pathItems is OAS 3.1 only");
    }

    const refs: Array<{ ref: string; path: string }> = [];
    collectJsonRefs(doc, refs, []);
    for (const { ref, path } of refs) {
        if (ref.startsWith("#/")) {
            if (resolveRef(doc, ref) === undefined) {
                err("ref.dangling", path, `internal $ref not found: ${ref}`);
            }
        }
    }

    const checkSecurity = (reqs: unknown, path: string) => {
        if (!Array.isArray(reqs)) return;
        reqs.forEach((req, i) => {
            if (!isObj(req)) return;
            for (const [name, scopes] of Object.entries(req)) {
                if (!schemeNames.has(name)) {
                    err("security.unknown", `${path}/${i}/${name}`, `security requirement references unknown scheme "${name}"`);
                    continue;
                }
                const scheme = isObj(components.securitySchemes)
                    ? (components.securitySchemes as Record<string, unknown>)[name]
                    : undefined;
                if (!isObj(scheme)) continue;
                if ((scheme.type === "oauth2" || scheme.type === "openIdConnect") && Array.isArray(scopes)) {
                    const declared = new Set<string>();
                    if (isObj(scheme.flows)) {
                        for (const flow of Object.values(scheme.flows)) {
                            if (isObj(flow) && isObj(flow.scopes)) {
                                for (const s of Object.keys(flow.scopes)) declared.add(s);
                            }
                        }
                    }
                    if (scheme.type === "openIdConnect") {
                        // OIDC scopes are not declared on the scheme; skip existence check
                    } else {
                        for (const s of scopes) {
                            if (typeof s === "string" && !declared.has(s)) {
                                err("security.scope", `${path}/${i}/${name}`, `unknown OAuth2 scope "${s}"`);
                            }
                        }
                    }
                }
            }
        });
    };
    checkSecurity(doc.security, "/security");

    const definedTags = new Set<string>();
    if (Array.isArray(doc.tags)) {
        for (const t of doc.tags) {
            if (isObj(t) && typeof t.name === "string") definedTags.add(t.name);
        }
    }

    const opIds = new Map<string, string>();
    const paths = isObj(doc.paths) ? doc.paths : {};

    const checkParamStyle = (p: Record<string, unknown>, path: string) => {
        const inn = p.in;
        if (inn !== "path" && inn !== "query" && inn !== "header" && inn !== "cookie") return;
        if (typeof p.style === "string") {
            const legal = LEGAL_STYLE[inn];
            if (!legal.includes(p.style)) {
                err("param.style", `${path}/style`, `style "${p.style}" is not legal for in=${inn}`);
            }
        }
        const hasSchema = p.schema !== undefined;
        const hasContent = p.content !== undefined;
        if (hasSchema && hasContent) {
            err("param.schema-xor-content", path, "parameter must not have both schema and content");
        }
        if (!hasSchema && !hasContent && p.$ref === undefined) {
            err("param.schema-xor-content", path, "parameter must have schema or content");
        }
        if (inn === "header" && typeof p.name === "string" && RESERVED_HEADER_NAMES.has(p.name.toLowerCase())) {
            err("param.header.reserved", `${path}/name`, `header parameter SHOULD not be named ${p.name}`);
        }
        if (inn === "path" && p.required !== true) {
            err("param.path.required", `${path}/required`, "path parameters must have required: true");
        }
        if (isObj(p.content)) {
            for (const mt of Object.keys(p.content)) {
                if (!mediaTypeOk(mt)) err("media.type", `${path}/content/${mt}`, `malformed media type "${mt}"`);
            }
        }
    };

    const checkEncoding = (content: unknown, path: string) => {
        if (!isObj(content)) return;
        for (const [mt, media] of Object.entries(content)) {
            if (!mediaTypeOk(mt)) err("media.type", `${path}/${mt}`, `malformed media type "${mt}"`);
            if (!isObj(media) || !isObj(media.encoding)) continue;
            if (!mt.includes("multipart") && !mt.includes("urlencoded")) continue;
            const schema = media.schema;
            const propNames = new Set<string>();
            if (isObj(schema) && isObj(schema.properties)) {
                for (const k of Object.keys(schema.properties)) propNames.add(k);
            }
            if (isObj(schema) && typeof schema.$ref === "string") {
                const target = resolveRef(doc, schema.$ref);
                if (isObj(target) && isObj(target.properties)) {
                    for (const k of Object.keys(target.properties)) propNames.add(k);
                }
            }
            for (const encKey of Object.keys(media.encoding)) {
                if (propNames.size && !propNames.has(encKey)) {
                    err("encoding.key", `${path}/${mt}/encoding/${encKey}`, "encoding key is not a schema property");
                }
            }
        }
    };

    const walkSchema = (schema: unknown, path: string) => {
        if (!isObj(schema)) return;
        if (schema.nullable === true && dialect === "3.1") {
            // legal-ish in the wild but tagged as dialect mismatch in strict 3.1 mode
            err("dialect.keyword", `${path}/nullable`, "nullable is OAS 3.0; use type unions in 3.1");
        }
        if (schema.const !== undefined && !table.allows.schemaConst) {
            err("dialect.keyword", `${path}/const`, "const is OAS 3.1 only");
        }
        if (Array.isArray(schema.type) && !table.allows.typeArray) {
            err("dialect.keyword", `${path}/type`, "type arrays are OAS 3.1 only");
        }
        if (schema.webhooks) {
            /* not on schema */
        }
        if (isObj(schema.discriminator) && typeof schema.discriminator.propertyName === "string") {
            const prop = schema.discriminator.propertyName;
            const props = isObj(schema.properties) ? schema.properties : undefined;
            const oneOf = Array.isArray(schema.oneOf) ? schema.oneOf : Array.isArray(schema.anyOf) ? schema.anyOf : [];
            if (props && !(prop in props)) {
                const inUnion = oneOf.some(
                    (alt) => isObj(alt) && isObj(alt.properties) && prop in alt.properties,
                );
                if (!inUnion) {
                    err("discriminator.property", `${path}/discriminator/propertyName`, `property "${prop}" not found on schema`);
                }
            }
            if (isObj(schema.discriminator.mapping)) {
                for (const [k, v] of Object.entries(schema.discriminator.mapping)) {
                    if (typeof v === "string" && v.startsWith("#/") && resolveRef(doc, v) === undefined) {
                        err("discriminator.mapping", `${path}/discriminator/mapping/${k}`, `mapping $ref not found: ${v}`);
                    }
                }
            }
        }
        for (const key of ["allOf", "anyOf", "oneOf"]) {
            const arr = schema[key];
            if (Array.isArray(arr)) arr.forEach((s, i) => walkSchema(s, `${path}/${key}/${i}`));
        }
        if (schema.not) walkSchema(schema.not, `${path}/not`);
        if (isObj(schema.properties)) {
            for (const [k, v] of Object.entries(schema.properties)) walkSchema(v, `${path}/properties/${k}`);
        }
        if (schema.items && typeof schema.items === "object") walkSchema(schema.items, `${path}/items`);
        if (schema.$ref) return;
    };

    if (isObj(components.schemas)) {
        for (const [name, schema] of Object.entries(components.schemas)) {
            walkSchema(schema, `/components/schemas/${name}`);
        }
    }

    const checkOp = (op: Record<string, unknown>, path: string, pathItemParams: unknown, template: string[]) => {
        checkSecurity(op.security, `${path}/security`);
        if (typeof op.operationId === "string") {
            const prev = opIds.get(op.operationId);
            if (prev) err("operationId.unique", `${path}/operationId`, `duplicate operationId "${op.operationId}" (also at ${prev})`);
            else opIds.set(op.operationId, `${path}/operationId`);
        }
        if (Array.isArray(op.tags)) {
            for (const t of op.tags) {
                if (typeof t === "string" && definedTags.size && !definedTags.has(t)) {
                    err("tags.undefined", `${path}/tags`, `operation tag "${t}" is not listed in document tags`);
                }
            }
        }

        const resolved: Array<{ p: Record<string, unknown>; path: string }> = [];
        for (const { p, path: i } of paramList(pathItemParams)) {
            const r = resolveParam(doc, p);
            if (r) resolved.push({ p: r, path: `${path}/../parameters/${i}` });
        }
        for (const { p, path: i } of paramList(op.parameters)) {
            const r = resolveParam(doc, p);
            if (r) resolved.push({ p: r, path: `${path}/parameters/${i}` });
        }

        const identity = new Set<string>();
        const pathParams = new Set<string>();
        for (const { p, path: pp } of resolved) {
            checkParamStyle(p, pp);
            if (typeof p.name === "string" && typeof p.in === "string") {
                const k = `${p.name}|${p.in}`;
                if (identity.has(k)) err("param.duplicate", pp, `duplicate parameter (${p.name}, ${p.in})`);
                identity.add(k);
                if (p.in === "path") pathParams.add(p.name);
            }
        }
        const tokens = new Set(template);
        for (const t of tokens) {
            if (!pathParams.has(t)) {
                err("path.param.missing", path, `path template {${t}} has no required path parameter`);
            }
        }
        for (const n of pathParams) {
            if (!tokens.has(n)) {
                err("path.param.extra", path, `path parameter "${n}" is not in the path template`);
            }
        }

        if (isObj(op.requestBody)) {
            const rb = typeof op.requestBody.$ref === "string" ? resolveRef(doc, op.requestBody.$ref) : op.requestBody;
            if (isObj(rb) && isObj(rb.content)) checkEncoding(rb.content, `${path}/requestBody/content`);
        }

        if (!isObj(op.responses) || Object.keys(op.responses).length === 0) {
            err("responses.required", `${path}/responses`, "responses is required and must not be empty");
        } else {
            for (const [code, resp] of Object.entries(op.responses)) {
                const r = isObj(resp) && typeof resp.$ref === "string" ? resolveRef(doc, resp.$ref) : resp;
                if (!isObj(r)) continue;
                if (typeof r.description !== "string") {
                    err("response.description", `${path}/responses/${code}/description`, "Response Object requires description");
                }
                if (isObj(r.content)) checkEncoding(r.content, `${path}/responses/${code}/content`);
                if (isObj(r.links)) {
                    for (const [lk, link] of Object.entries(r.links)) {
                        if (!isObj(link)) continue;
                        if (isObj(link.parameters)) {
                            for (const [pk, pv] of Object.entries(link.parameters)) {
                                if (typeof pv === "string" && pv.startsWith("$") && !isRuntimeExpr(pv)) {
                                    err("link.expression", `${path}/responses/${code}/links/${lk}/parameters/${pk}`, `invalid runtime expression`);
                                }
                            }
                        }
                    }
                }
            }
        }

        if (isObj(op.callbacks)) {
            for (const [ck, cb] of Object.entries(op.callbacks)) {
                void ck;
                if (!isObj(cb)) continue;
                const resolved = typeof cb.$ref === "string" ? resolveRef(doc, cb.$ref) : cb;
                if (!isObj(resolved)) continue;
                for (const expr of Object.keys(resolved)) {
                    if (expr === "$ref") continue;
                    if (expr.includes("$") && !expr.includes("$request") && !expr.includes("$response")) {
                        err("callback.expression", `${path}/callbacks`, `callback path is not a valid runtime expression: ${expr}`);
                    }
                }
            }
        }

        if (Array.isArray(op.servers)) {
            op.servers.forEach((s, i) => checkServer(s, `${path}/servers/${i}`, err));
        }
    };

    if (isObj(doc.paths)) {
        for (const [p, item] of Object.entries(doc.paths)) {
            if (!p.startsWith("/")) err("paths.key", `/paths/${p}`, "path keys must start with /");
            if (!isObj(item)) continue;
            const tokens = pathTemplateTokens(p);
            const methods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;
            for (const m of methods) {
                if (isObj(item[m])) checkOp(item[m] as Record<string, unknown>, `/paths/${p}/${m}`, item.parameters, tokens);
            }
            if (Array.isArray(item.servers)) {
                item.servers.forEach((s, i) => checkServer(s, `/paths/${p}/servers/${i}`, err));
            }
        }
    }

    if (Array.isArray(doc.servers)) {
        doc.servers.forEach((s, i) => checkServer(s, `/servers/${i}`, err));
    }

    // Header reserved names are SHOULD — we record them but they already went into errors.
    // Strict-valid profile treats them as failures (included above).

    return { ok: errors.length === 0, errors };
}

function checkServer(
    s: unknown,
    path: string,
    err: (code: string, path: string, message: string) => void,
): void {
    if (!s || typeof s !== "object") return;
    const server = s as Record<string, unknown>;
    if (typeof server.url !== "string") {
        err("server.url", `${path}/url`, "server.url is required");
        return;
    }
    const tokens = pathTemplateTokens(server.url);
    const vars = isObj(server.variables) ? server.variables : {};
    for (const t of tokens) {
        if (!(t in vars)) err("server.variable", `${path}/variables`, `URL token {${t}} has no variables entry`);
        else if (isObj(vars[t])) {
            const v = vars[t] as Record<string, unknown>;
            if (typeof v.default !== "string") err("server.variable.default", `${path}/variables/${t}/default`, "variable default is required");
            if (Array.isArray(v.enum) && typeof v.default === "string" && !v.enum.includes(v.default)) {
                err("server.variable.enum", `${path}/variables/${t}`, "variable default must be in enum");
            }
        }
    }
}

export async function validate(doc: unknown, dialect: Dialect): Promise<Verdict> {
    const parsed = parseDocument(doc);
    if (!parsed.ok) {
        const empty: LayerResult = { ok: false, errors: [parsed.error] };
        return {
            parse: false,
            officialSchema: empty,
            semantic: { ok: false, errors: [{ code: "parse", path: "/", message: String(parsed.error) }] },
            dereference: empty,
            acceptedAsValidFixture: false,
        };
    }
    const value = parsed.value;
    const officialSchema = validateOfficialSchema(value, dialect);
    const semantic = semanticCheck(value, dialect);
    const deref = await dereference(value);
    return {
        parse: true,
        officialSchema,
        semantic,
        dereference: deref,
        acceptedAsValidFixture: officialSchema.ok && semantic.ok && deref.ok,
    };
}

export { validateOfficialSchema } from "./official.ts";
export { dereference } from "./dereference.ts";
