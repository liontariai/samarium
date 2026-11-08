import {
    buildASTSchema,
    buildSchema,
    parse,
    print,
    validateSchema,
    type GraphQLError,
    type GraphQLSchema,
} from "graphql";
import {
    BUILTIN_SCALARS,
    type GraphQLDocument,
    type NamedTypeIR,
    type TypeRef,
    unwrapNamed,
} from "../ast/index.ts";
import { toSdl } from "../ser/index.ts";
import type { SemanticError, Verdict } from "../types.ts";

const BUILTIN = new Set<string>(BUILTIN_SCALARS);

export function parseSdl(text: string): { ok: true; sdl: string } | { ok: false; error: string } {
    try {
        parse(text);
        return { ok: true, sdl: text };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}

export function buildFromSdl(sdl: string): { ok: true; schema: GraphQLSchema } | { ok: false; errors: unknown[] } {
    try {
        const schema = buildSchema(sdl);
        return { ok: true, schema };
    } catch (e) {
        return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
    }
}

function collectTypeNames(doc: GraphQLDocument): Map<string, NamedTypeIR> {
    const map = new Map<string, NamedTypeIR>();
    for (const t of doc.types) map.set(t.name, t);
    return map;
}

function walkTypeRef(
    t: TypeRef,
    path: string,
    known: Set<string>,
    errors: SemanticError[],
    depth: number,
    maxDepth: number,
): void {
    if (depth > maxDepth) {
        errors.push({ code: "TYPE_DEPTH", path, message: `type nesting exceeds ${maxDepth}` });
        return;
    }
    if (t.kind === "named") {
        if (!BUILTIN.has(t.name) && !known.has(t.name)) {
            errors.push({ code: "DANGLING_TYPE", path, message: `unknown type ${t.name}` });
        }
        if (t.name.startsWith("__")) {
            errors.push({ code: "RESERVED_NAME", path, message: `reserved type name ${t.name}` });
        }
        return;
    }
    walkTypeRef(t.of, path, known, errors, depth + 1, maxDepth);
}

function isInputCompatible(name: string, types: Map<string, NamedTypeIR>): boolean {
    if (BUILTIN.has(name)) return true;
    const t = types.get(name);
    if (!t) return false;
    return t.kind === "inputObject" || t.kind === "enum" || t.kind === "scalar";
}

function isOutputCompatible(name: string, types: Map<string, NamedTypeIR>): boolean {
    if (BUILTIN.has(name)) return true;
    const t = types.get(name);
    if (!t) return false;
    return t.kind === "object" || t.kind === "interface" || t.kind === "union" || t.kind === "enum" || t.kind === "scalar";
}

export function semanticCheck(doc: GraphQLDocument, maxDepth = 8): { ok: boolean; errors: SemanticError[] } {
    const errors: SemanticError[] = [];
    const types = collectTypeNames(doc);
    const known = new Set([...types.keys(), ...BUILTIN]);

    // Unique names
    const seen = new Set<string>();
    for (const t of doc.types) {
        if (seen.has(t.name)) {
            errors.push({ code: "DUP_TYPE", path: t.name, message: `duplicate type ${t.name}` });
        }
        seen.add(t.name);
        if (t.name.startsWith("__")) {
            errors.push({ code: "RESERVED_NAME", path: t.name, message: `reserved type name ${t.name}` });
        }
    }

    const dirSeen = new Set<string>();
    for (const d of doc.directives) {
        if (dirSeen.has(d.name)) {
            errors.push({ code: "DUP_DIRECTIVE", path: d.name, message: `duplicate directive @${d.name}` });
        }
        dirSeen.add(d.name);
        if (!d.locations.length) {
            errors.push({ code: "DIR_LOCATIONS", path: d.name, message: `directive @${d.name} has no locations` });
        }
    }

    for (const t of doc.types) {
        if (t.kind === "object" || t.kind === "interface") {
            const fieldNames = new Set<string>();
            for (const f of t.fields) {
                if (fieldNames.has(f.name)) {
                    errors.push({ code: "DUP_FIELD", path: `${t.name}.${f.name}`, message: "duplicate field" });
                }
                fieldNames.add(f.name);
                walkTypeRef(f.type, `${t.name}.${f.name}`, known, errors, 0, maxDepth);
                const outName = unwrapNamed(f.type);
                if (!isOutputCompatible(outName, types) && !BUILTIN.has(outName)) {
                    // dangling already reported
                } else if (types.has(outName) && !isOutputCompatible(outName, types)) {
                    errors.push({
                        code: "OUTPUT_TYPE",
                        path: `${t.name}.${f.name}`,
                        message: `field type ${outName} is not an output type`,
                    });
                }
                const argNames = new Set<string>();
                for (const a of f.args ?? []) {
                    if (argNames.has(a.name)) {
                        errors.push({ code: "DUP_ARG", path: `${t.name}.${f.name}(${a.name})`, message: "duplicate arg" });
                    }
                    argNames.add(a.name);
                    walkTypeRef(a.type, `${t.name}.${f.name}.${a.name}`, known, errors, 0, maxDepth);
                    const inName = unwrapNamed(a.type);
                    if (types.has(inName) && !isInputCompatible(inName, types)) {
                        errors.push({
                            code: "INPUT_TYPE",
                            path: `${t.name}.${f.name}.${a.name}`,
                            message: `arg type ${inName} is not an input type`,
                        });
                    }
                }
            }
            for (const iface of t.interfaces ?? []) {
                const it = types.get(iface);
                if (!it || it.kind !== "interface") {
                    errors.push({
                        code: "BAD_IMPLEMENTS",
                        path: t.name,
                        message: `${t.name} implements non-interface ${iface}`,
                    });
                    continue;
                }
                for (const req of it.fields) {
                    if (!t.fields.some((f) => f.name === req.name)) {
                        errors.push({
                            code: "MISSING_INTERFACE_FIELD",
                            path: `${t.name}.${req.name}`,
                            message: `${t.name} missing interface field ${req.name}`,
                        });
                    }
                }
            }
        }
        if (t.kind === "union") {
            if (t.members.length < 1) {
                errors.push({ code: "EMPTY_UNION", path: t.name, message: "union has no members" });
            }
            for (const m of t.members) {
                const mt = types.get(m);
                if (!mt || mt.kind !== "object") {
                    errors.push({
                        code: "UNION_MEMBER",
                        path: t.name,
                        message: `union member ${m} must be an object type`,
                    });
                }
            }
        }
        if (t.kind === "enum") {
            if (t.values.length < 1) {
                errors.push({ code: "EMPTY_ENUM", path: t.name, message: "enum has no values" });
            }
            const vs = new Set<string>();
            for (const v of t.values) {
                if (vs.has(v.name)) {
                    errors.push({ code: "DUP_ENUM_VALUE", path: `${t.name}.${v.name}`, message: "duplicate enum value" });
                }
                vs.add(v.name);
            }
        }
        if (t.kind === "inputObject") {
            const fieldNames = new Set<string>();
            for (const f of t.fields) {
                if (fieldNames.has(f.name)) {
                    errors.push({ code: "DUP_FIELD", path: `${t.name}.${f.name}`, message: "duplicate input field" });
                }
                fieldNames.add(f.name);
                walkTypeRef(f.type, `${t.name}.${f.name}`, known, errors, 0, maxDepth);
                const inName = unwrapNamed(f.type);
                if (types.has(inName) && !isInputCompatible(inName, types)) {
                    errors.push({
                        code: "INPUT_TYPE",
                        path: `${t.name}.${f.name}`,
                        message: `input field type ${inName} is not an input type`,
                    });
                }
                if (t.isOneOf) {
                    if (f.type.kind === "nonNull") {
                        errors.push({
                            code: "ONEOF_NULLABLE",
                            path: `${t.name}.${f.name}`,
                            message: "@oneOf fields must be nullable",
                        });
                    }
                    if (f.defaultValue !== undefined) {
                        errors.push({
                            code: "ONEOF_DEFAULT",
                            path: `${t.name}.${f.name}`,
                            message: "@oneOf fields must not have defaults",
                        });
                    }
                }
            }
        }
    }

    const schema = doc.schema ?? { query: "Query" };
    const query = schema.query ?? "Query";
    const qType = types.get(query);
    if (!qType || qType.kind !== "object") {
        errors.push({ code: "QUERY_ROOT", path: query, message: `Query root ${query} must be an object type` });
    }
    if (schema.mutation) {
        const m = types.get(schema.mutation);
        if (!m || m.kind !== "object") {
            errors.push({
                code: "MUTATION_ROOT",
                path: schema.mutation,
                message: `Mutation root must be an object type`,
            });
        }
    }
    if (schema.subscription) {
        const s = types.get(schema.subscription);
        if (!s || s.kind !== "object") {
            errors.push({
                code: "SUBSCRIPTION_ROOT",
                path: schema.subscription,
                message: `Subscription root must be an object type`,
            });
        }
    }

    for (const e of doc.extensions ?? []) {
        if (e.kind === "object" || e.kind === "interface" || e.kind === "inputObject" || e.kind === "enum" || e.kind === "union") {
            if (!types.has(e.name) && e.kind !== "schema") {
                errors.push({ code: "EXT_UNKNOWN", path: e.name, message: `extend unknown type ${e.name}` });
            }
        }
    }

    return { ok: errors.length === 0, errors };
}

function formatGqlErrors(errs: readonly GraphQLError[]): unknown[] {
    return errs.map((e) => e.message);
}

export async function validate(input: GraphQLDocument | string): Promise<Verdict> {
    const sdl = typeof input === "string" ? input : toSdl(input);
    const doc = typeof input === "string" ? null : input;

    const parsed = parseSdl(sdl);
    if (!parsed.ok) {
        return {
            parse: false,
            structural: { ok: false, errors: [parsed.error] },
            semantic: { ok: false, errors: [{ code: "PARSE", path: "/", message: parsed.error }] },
            roundTrip: { ok: false, errors: [] },
            acceptedAsValidFixture: false,
        };
    }

    let structuralOk = false;
    let structuralErrors: unknown[] = [];
    let schema: GraphQLSchema | undefined;
    try {
        const ast = parse(sdl);
        schema = buildASTSchema(ast, { assumeValidSDL: false });
        const errs = validateSchema(schema);
        structuralOk = errs.length === 0;
        structuralErrors = formatGqlErrors(errs);
    } catch (e) {
        structuralOk = false;
        structuralErrors = [e instanceof Error ? e.message : String(e)];
    }

    const semantic = doc ? semanticCheck(doc) : { ok: true, errors: [] as SemanticError[] };

    let roundTripOk = false;
    let roundTripErrors: unknown[] = [];
    try {
        const rebuilt = buildSchema(sdl);
        print(parse(sdl));
        const again = validateSchema(rebuilt);
        roundTripOk = again.length === 0;
        roundTripErrors = formatGqlErrors(again);
        if (structuralOk && !roundTripOk) {
            // disagreement tagged — still accept if structural+semantic ok, but record
            roundTripErrors = [...roundTripErrors, { tag: "roundTripDisagreement" }];
        }
    } catch (e) {
        roundTripOk = false;
        roundTripErrors = [e instanceof Error ? e.message : String(e)];
    }

    // Accept when structural + semantic pass; round-trip disagreements alone do not reject
    // if structural already validated (mirrors oas-gen tagging disagreements).
    const acceptedAsValidFixture = structuralOk && semantic.ok;

    return {
        parse: true,
        structural: { ok: structuralOk, errors: structuralErrors },
        semantic,
        roundTrip: { ok: roundTripOk, errors: roundTripErrors },
        acceptedAsValidFixture,
    };
}
