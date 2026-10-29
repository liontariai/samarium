import type { Dialect, FeatureId } from "../types.ts";

export type FeatureWeight = "common" | "uncommon" | "rare";
export type SamariumRelevance = "high" | "medium" | "low";
export type FeatureObject =
    | "Document"
    | "Info"
    | "Server"
    | "Paths"
    | "PathItem"
    | "Operation"
    | "Parameter"
    | "RequestBody"
    | "MediaType"
    | "Encoding"
    | "Response"
    | "Header"
    | "Schema"
    | "Components"
    | "Security"
    | "Link"
    | "Callback"
    | "Webhook"
    | "Reference"
    | "Serialization";

export type FeatureDef = {
    id: FeatureId;
    oas: Dialect[];
    object: FeatureObject;
    keywords: string[];
    weight: FeatureWeight;
    samariumRelevance: SamariumRelevance;
    /** True once a combinator can emit this atom. */
    implemented: boolean;
    phase: 1 | 2 | 3 | 4 | 5;
};

function f(
    id: FeatureId,
    oas: Dialect[],
    object: FeatureObject,
    keywords: string[],
    extra: Partial<Pick<FeatureDef, "weight" | "samariumRelevance" | "implemented" | "phase">> = {},
): FeatureDef {
    return {
        id,
        oas,
        object,
        keywords,
        weight: extra.weight ?? "common",
        samariumRelevance: extra.samariumRelevance ?? "high",
        implemented: extra.implemented ?? false,
        phase: extra.phase ?? 2,
    };
}

const both: Dialect[] = ["3.0", "3.1"];

/** Contract for “whole spec.” Phase 1 combinators tick `implemented: true`. */
export const FEATURES: FeatureDef[] = [
    // Document
    f("doc.openapi.3.0", ["3.0"], "Document", ["openapi"], { implemented: true, phase: 1 }),
    f("doc.openapi.3.1", ["3.1"], "Document", ["openapi"], { implemented: true, phase: 1 }),
    f("doc.jsonSchemaDialect", ["3.1"], "Document", ["jsonSchemaDialect"], { weight: "rare", samariumRelevance: "low" }),
    f("doc.extension", both, "Document", ["x-*"], { implemented: true, phase: 4, weight: "uncommon", samariumRelevance: "medium" }),
    f("ser.json", both, "Serialization", [], { implemented: true, phase: 1, samariumRelevance: "medium" }),
    f("ser.yaml", both, "Serialization", [], { implemented: true, phase: 1, samariumRelevance: "medium" }),
    f("ser.key-order.shuffle", both, "Serialization", [], { implemented: true, phase: 5, weight: "uncommon", samariumRelevance: "medium" }),
    f("ser.yaml.flow", both, "Serialization", [], { implemented: true, phase: 5, weight: "rare", samariumRelevance: "low" }),
    f("ser.unicode", both, "Serialization", [], { implemented: true, phase: 5, weight: "uncommon", samariumRelevance: "medium" }),
    f("doc.optional.omitted", both, "Document", [], { implemented: true, phase: 1, samariumRelevance: "medium" }),
    f("doc.optional.present-empty", both, "Document", [], { weight: "rare", samariumRelevance: "low" }),
    f("doc.optional.present-default", both, "Document", [], { weight: "rare", samariumRelevance: "low" }),

    // Info
    f("info.title", both, "Info", ["title"], { implemented: true, phase: 1 }),
    f("info.version", both, "Info", ["version"], { implemented: true, phase: 1 }),
    f("info.description", both, "Info", ["description"], { implemented: true, phase: 1 }),
    f("info.termsOfService", both, "Info", ["termsOfService"], { weight: "uncommon", samariumRelevance: "low" }),
    f("info.contact", both, "Info", ["contact"], { implemented: true, phase: 1, weight: "uncommon", samariumRelevance: "low" }),
    f("info.license", both, "Info", ["license"], { implemented: true, phase: 1, weight: "uncommon", samariumRelevance: "low" }),
    f("info.license.identifier", ["3.1"], "Info", ["identifier"], { weight: "rare", samariumRelevance: "low" }),

    // Servers
    f("servers.literal", both, "Server", ["url"], { implemented: true, phase: 1 }),
    f("servers.templated", both, "Server", ["url", "variables"], { implemented: true, phase: 4, weight: "uncommon" }),
    f("servers.document", both, "Server", ["servers"], { implemented: true, phase: 1 }),
    f("servers.path-item", both, "Server", ["servers"], { weight: "uncommon" }),
    f("servers.operation", both, "Server", ["servers"], { weight: "uncommon" }),

    // Paths / Path Item
    f("path.static", both, "Paths", [], { implemented: true, phase: 1 }),
    f("path.single-param", both, "Paths", [], { implemented: true, phase: 1 }),
    f("path.multi-param", both, "Paths", [], { implemented: true, phase: 1 }),
    f("path.segment.dot-dash", both, "Paths", [], { implemented: true, phase: 1, weight: "uncommon" }),
    f("path-item.ref", both, "PathItem", ["$ref"], { implemented: true, phase: 3, weight: "uncommon" }),
    f("path-item.ref.components", ["3.1"], "PathItem", ["pathItems"], { implemented: true, phase: 3, weight: "rare" }),
    f("path-item.parameters", both, "PathItem", ["parameters"], { implemented: true, phase: 1 }),
    f("op.method.get", both, "Operation", ["get"], { implemented: true, phase: 1 }),
    f("op.method.put", both, "Operation", ["put"], { implemented: true, phase: 1 }),
    f("op.method.post", both, "Operation", ["post"], { implemented: true, phase: 1 }),
    f("op.method.delete", both, "Operation", ["delete"], { implemented: true, phase: 1 }),
    f("op.method.options", both, "Operation", ["options"], { weight: "uncommon", samariumRelevance: "medium" }),
    f("op.method.head", both, "Operation", ["head"], { weight: "uncommon", samariumRelevance: "medium" }),
    f("op.method.patch", both, "Operation", ["patch"], { implemented: true, phase: 1 }),
    f("op.method.trace", both, "Operation", ["trace"], { weight: "rare", samariumRelevance: "low" }),
    f("paths.empty-with-webhooks", ["3.1"], "Paths", ["webhooks"], { weight: "rare", samariumRelevance: "medium" }),

    // Operation
    f("op.operationId", both, "Operation", ["operationId"], { implemented: true, phase: 1 }),
    f("op.operationId.absent", both, "Operation", ["operationId"], { weight: "uncommon" }),
    f("op.operationId.unicode", both, "Operation", ["operationId"], { weight: "rare", samariumRelevance: "medium" }),
    f("op.operationId.dotted", both, "Operation", ["operationId"], { weight: "uncommon" }),
    f("op.tags", both, "Operation", ["tags"], { implemented: true, phase: 1 }),
    f("op.deprecated", both, "Operation", ["deprecated"], { implemented: true, phase: 4, weight: "uncommon", samariumRelevance: "medium" }),
    f("op.externalDocs", both, "Operation", ["externalDocs"], { implemented: true, phase: 4, weight: "uncommon", samariumRelevance: "low" }),
    f("op.parameters.inline", both, "Operation", ["parameters"], { implemented: true, phase: 1 }),
    f("op.parameters.ref", both, "Operation", ["$ref"], { implemented: true, phase: 4, weight: "uncommon" }),
    f("op.parameters.inherited", both, "Operation", ["parameters"], { implemented: true, phase: 1 }),
    f("op.requestBody", both, "Operation", ["requestBody"], { implemented: true, phase: 1 }),
    f("op.requestBody.ref", both, "Operation", ["$ref"], { implemented: true, phase: 5, weight: "uncommon" }),
    f("op.requestBody.required", both, "Operation", ["required"], { implemented: true, phase: 1 }),
    f("op.responses.default", both, "Operation", ["default"], { implemented: true, phase: 4, weight: "uncommon" }),
    f("op.responses.2xx", both, "Operation", ["200"], { implemented: true, phase: 1 }),
    f("op.responses.4xx", both, "Operation", ["400"], { implemented: true, phase: 1 }),
    f("op.responses.pattern", both, "Operation", ["2XX"], { weight: "rare" }),
    f("op.callbacks", both, "Operation", ["callbacks"], { implemented: true, phase: 3, weight: "rare" }),
    f("op.security.override", both, "Operation", ["security"], { implemented: true, phase: 1, weight: "uncommon" }),
    f("op.security.optional", both, "Operation", ["security"], { implemented: true, phase: 3, weight: "uncommon" }),
    f("op.servers.override", both, "Operation", ["servers"], { weight: "uncommon" }),

    // Parameter
    f("param.in.path", both, "Parameter", ["in"], { implemented: true, phase: 1 }),
    f("param.in.query", both, "Parameter", ["in"], { implemented: true, phase: 1 }),
    f("param.in.header", both, "Parameter", ["in"], { implemented: true, phase: 2 }),
    f("param.in.cookie", both, "Parameter", ["in"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("param.schema", both, "Parameter", ["schema"], { implemented: true, phase: 1 }),
    f("param.content", both, "Parameter", ["content"], { implemented: true, phase: 2, weight: "rare" }),
    f("param.content.multipart", both, "Parameter", ["content"], { weight: "rare" }),
    f("param.style.matrix", both, "Parameter", ["style"], { implemented: true, phase: 2, weight: "rare" }),
    f("param.style.label", both, "Parameter", ["style"], { implemented: true, phase: 2, weight: "rare" }),
    f("param.style.form", both, "Parameter", ["style"], { implemented: true, phase: 1 }),
    f("param.style.simple", both, "Parameter", ["style"], { implemented: true, phase: 1 }),
    f("param.style.spaceDelimited", both, "Parameter", ["style"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("param.style.pipeDelimited", both, "Parameter", ["style"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("param.style.deepObject", both, "Parameter", ["style"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("param.explode", both, "Parameter", ["explode"], { implemented: true, phase: 1 }),
    f("param.allowEmptyValue", both, "Parameter", ["allowEmptyValue"], { implemented: true, phase: 2, weight: "rare", samariumRelevance: "low" }),
    f("param.allowReserved", both, "Parameter", ["allowReserved"], { implemented: true, phase: 2, weight: "rare", samariumRelevance: "low" }),
    f("param.array", both, "Parameter", ["type"], { implemented: true, phase: 2 }),
    f("param.object", both, "Parameter", ["type"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("param.examples", both, "Parameter", ["examples"], { implemented: true, phase: 2, weight: "uncommon", samariumRelevance: "medium" }),
    f("param.example", both, "Parameter", ["example"], { implemented: true, phase: 2, weight: "uncommon", samariumRelevance: "medium" }),
    f("param.header.reserved", both, "Parameter", ["name"], { weight: "rare", samariumRelevance: "medium" }),

    // Request body / media
    f("media.application/json", both, "MediaType", ["content"], { implemented: true, phase: 1 }),
    f("media.application/xml", both, "MediaType", ["content"], { implemented: true, phase: 2, weight: "uncommon", samariumRelevance: "medium" }),
    f("media.text/plain", both, "MediaType", ["content"], { implemented: true, phase: 1 }),
    f("media.application/octet-stream", both, "MediaType", ["content"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("media.application/x-www-form-urlencoded", both, "MediaType", ["content"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("media.multipart/form-data", both, "MediaType", ["encoding"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("media.multi-content", both, "MediaType", ["content"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("encoding.multipart", both, "Encoding", ["encoding"], { implemented: true, phase: 2, weight: "uncommon" }),

    // Response / header
    f("response.headers", both, "Header", ["headers"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("response.links", both, "Link", ["links"], { implemented: true, phase: 3, weight: "rare" }),
    f("response.204", both, "Response", ["204"], { implemented: true, phase: 1, weight: "uncommon" }),
    f("response.description", both, "Response", ["description"], { implemented: true, phase: 1 }),

    // Schema
    f("schema.type.string", both, "Schema", ["type"], { implemented: true, phase: 1 }),
    f("schema.type.number", both, "Schema", ["type"], { implemented: true, phase: 1 }),
    f("schema.type.integer", both, "Schema", ["type"], { implemented: true, phase: 1 }),
    f("schema.type.boolean", both, "Schema", ["type"], { implemented: true, phase: 1 }),
    f("schema.type.object", both, "Schema", ["type"], { implemented: true, phase: 1 }),
    f("schema.type.array", both, "Schema", ["type"], { implemented: true, phase: 1 }),
    f("schema.type.null", ["3.1"], "Schema", ["type"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.type.array-union", ["3.1"], "Schema", ["type"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.format.date-time", both, "Schema", ["format"], { implemented: true, phase: 2 }),
    f("schema.format.date", both, "Schema", ["format"], { implemented: true, phase: 2 }),
    f("schema.format.time", both, "Schema", ["format"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.format.email", both, "Schema", ["format"], { implemented: true, phase: 2 }),
    f("schema.format.uuid", both, "Schema", ["format"], { implemented: true, phase: 2 }),
    f("schema.format.uri", both, "Schema", ["format"], { implemented: true, phase: 2 }),
    f("schema.format.hostname", both, "Schema", ["format"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.format.ipv4", both, "Schema", ["format"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.format.ipv6", both, "Schema", ["format"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.format.byte", both, "Schema", ["format"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.format.binary", both, "Schema", ["format"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.format.password", both, "Schema", ["format"], { implemented: true, phase: 2, weight: "uncommon", samariumRelevance: "low" }),
    f("schema.format.int32", both, "Schema", ["format"], { implemented: true, phase: 2 }),
    f("schema.format.int64", both, "Schema", ["format"], { implemented: true, phase: 2 }),
    f("schema.format.float", both, "Schema", ["format"], { implemented: true, phase: 2 }),
    f("schema.format.double", both, "Schema", ["format"], { implemented: true, phase: 2 }),
    f("schema.enum", both, "Schema", ["enum"], { implemented: true, phase: 2 }),
    f("schema.const", ["3.1"], "Schema", ["const"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.min-max", both, "Schema", ["minimum", "maximum"], { implemented: true, phase: 2 }),
    f("schema.exclusive", both, "Schema", ["exclusiveMinimum"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.multipleOf", both, "Schema", ["multipleOf"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.string.length", both, "Schema", ["minLength", "maxLength"], { implemented: true, phase: 2 }),
    f("schema.string.pattern", both, "Schema", ["pattern"], { implemented: true, phase: 2 }),
    f("schema.array.bounds", both, "Schema", ["minItems", "maxItems"], { implemented: true, phase: 2 }),
    f("schema.array.uniqueItems", both, "Schema", ["uniqueItems"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.array.prefixItems", ["3.1"], "Schema", ["prefixItems"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.object.properties", both, "Schema", ["properties"], { implemented: true, phase: 1 }),
    f("schema.object.required", both, "Schema", ["required"], { implemented: true, phase: 1 }),
    f("schema.object.additionalProperties", both, "Schema", ["additionalProperties"], { implemented: true, phase: 2 }),
    f("schema.object.patternProperties", ["3.1"], "Schema", ["patternProperties"], { implemented: true, phase: 2, weight: "rare" }),
    f("schema.object.propertyNames", ["3.1"], "Schema", ["propertyNames"], { implemented: true, phase: 2, weight: "rare" }),
    f("schema.dependentRequired", ["3.1"], "Schema", ["dependentRequired"], { implemented: true, phase: 2, weight: "rare", samariumRelevance: "medium" }),
    f("schema.dependentSchemas", ["3.1"], "Schema", ["dependentSchemas"], { phase: 2, weight: "rare", samariumRelevance: "medium" }),
    f("schema.allOf", both, "Schema", ["allOf"], { implemented: true, phase: 2 }),
    f("schema.anyOf", both, "Schema", ["anyOf"], { implemented: true, phase: 2 }),
    f("schema.oneOf", both, "Schema", ["oneOf"], { implemented: true, phase: 2 }),
    f("schema.not", both, "Schema", ["not"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.if-then-else", ["3.1"], "Schema", ["if", "then", "else"], { implemented: true, phase: 2, weight: "rare" }),
    f("schema.discriminator", both, "Schema", ["discriminator"], { implemented: true, phase: 2 }),
    f("schema.readOnly", both, "Schema", ["readOnly"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.writeOnly", both, "Schema", ["writeOnly"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.deprecated", both, "Schema", ["deprecated"], { implemented: true, phase: 2, weight: "uncommon", samariumRelevance: "medium" }),
    f("schema.xml", both, "Schema", ["xml"], { implemented: true, phase: 2, weight: "rare", samariumRelevance: "low" }),
    f("schema.default", both, "Schema", ["default"], { implemented: true, phase: 2, weight: "uncommon", samariumRelevance: "medium" }),
    f("schema.example", ["3.0"], "Schema", ["example"], { implemented: true, phase: 2, weight: "uncommon", samariumRelevance: "medium" }),
    f("schema.examples", ["3.1"], "Schema", ["examples"], { implemented: true, phase: 2, weight: "uncommon", samariumRelevance: "medium" }),
    f("schema.recursive-ref", both, "Schema", ["$ref"], { implemented: true, phase: 1, weight: "uncommon" }),
    f("schema.ref.sibling", ["3.1"], "Schema", ["$ref"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("schema.nullable", ["3.0"], "Schema", ["nullable"], { implemented: true, phase: 2 }),

    // Components
    f("components.schemas", both, "Components", ["schemas"], { implemented: true, phase: 1 }),
    f("components.unused", both, "Components", [], { implemented: true, phase: 1, weight: "uncommon" }),
    f("components.name.dot-dash", both, "Components", [], { implemented: false, phase: 1, weight: "uncommon" }),

    // Security
    f("security.apiKey.header", both, "Security", ["apiKey"], { implemented: true, phase: 3 }),
    f("security.apiKey.query", both, "Security", ["apiKey"], { implemented: true, phase: 3 }),
    f("security.apiKey.cookie", both, "Security", ["apiKey"], { implemented: true, phase: 3, weight: "uncommon" }),
    f("security.http.basic", both, "Security", ["http"], { implemented: true, phase: 3 }),
    f("security.http.bearer", both, "Security", ["http"], { implemented: true, phase: 1 }),
    f("security.http.digest", both, "Security", ["http"], { implemented: true, phase: 3, weight: "uncommon" }),
    f("security.oauth2.implicit", both, "Security", ["oauth2"], { implemented: true, phase: 3, weight: "uncommon" }),
    f("security.oauth2.password", both, "Security", ["oauth2"], { implemented: true, phase: 3, weight: "uncommon" }),
    f("security.oauth2.clientCredentials", both, "Security", ["oauth2"], { implemented: true, phase: 3 }),
    f("security.oauth2.authorizationCode", both, "Security", ["oauth2"], { implemented: true, phase: 3 }),
    f("security.openIdConnect", both, "Security", ["openIdConnect"], { implemented: true, phase: 3, weight: "uncommon" }),
    f("security.mutualTLS", ["3.1"], "Security", ["mutualTLS"], { implemented: true, phase: 3, weight: "rare" }),
    f("security.requirement.and", both, "Security", ["security"], { implemented: true, phase: 3, weight: "uncommon" }),
    f("security.requirement.or", both, "Security", ["security"], { implemented: true, phase: 1 }),

    // Links / callbacks / webhooks
    f("link.operationId", both, "Link", ["operationId"], { implemented: true, phase: 3, weight: "rare" }),
    f("link.operationRef", both, "Link", ["operationRef"], { implemented: true, phase: 3, weight: "rare" }),
    f("link.runtime-expression", both, "Link", ["parameters"], { implemented: true, phase: 3, weight: "rare" }),
    f("callback.expression", both, "Callback", ["callbacks"], { implemented: true, phase: 3, weight: "rare" }),
    f("webhook.map", ["3.1"], "Webhook", ["webhooks"], { implemented: true, phase: 3 }),

    // References
    f("ref.local.components", both, "Reference", ["$ref"], { implemented: true, phase: 1 }),
    f("ref.json-pointer.escaped", both, "Reference", ["$ref"], { implemented: true, phase: 5, weight: "rare" }),
    f("ref.external", both, "Reference", ["$ref"], { implemented: true, phase: 5, weight: "uncommon" }),
    f("ref.path-item", both, "Reference", ["$ref"], { implemented: true, phase: 3, weight: "uncommon" }),
    f("ref.cyclic-schema", both, "Reference", ["$ref"], { implemented: true, phase: 2, weight: "uncommon" }),
    f("ref.sibling.description", ["3.1"], "Reference", ["description"], { implemented: true, phase: 2, weight: "uncommon" }),

    // Multi-document
    f("multifile.relative", both, "Reference", ["$ref"], { implemented: true, phase: 5, weight: "uncommon" }),
    f("multifile.absolute", both, "Reference", ["$ref"], { implemented: true, phase: 5, weight: "rare", samariumRelevance: "medium" }),
];

export const FEATURE_BY_ID: Map<FeatureId, FeatureDef> = new Map(FEATURES.map((x) => [x.id, x]));

export function featuresForDialect(dialect: Dialect): FeatureDef[] {
    return FEATURES.filter((x) => x.oas.includes(dialect));
}

export function implementedFeatures(dialect?: Dialect): FeatureDef[] {
    return FEATURES.filter((x) => x.implemented && (dialect == null || x.oas.includes(dialect)));
}

export const PHASE1_PROFILES = ["minimal", "core-rest"] as const;
export const PHASE2_PROFILES = ["minimal", "core-rest", "schema-heavy", "param-matrix", "media-matrix"] as const;
export const PHASE3_PROFILES = [
    ...PHASE2_PROFILES,
    "security-matrix",
    "callback-webhook",
] as const;
export const PHASE4_PROFILES = [...PHASE3_PROFILES, "messy"] as const;
export const PHASE5_PROFILES = [...PHASE4_PROFILES, "ref-graph", "multi-file"] as const;
export const PHASE6_PROFILES = [...PHASE5_PROFILES, "full-random"] as const;
