import { stringify as yamlStringify } from "yaml";
import { componentRef } from "../dialects/index.ts";
import { HTTP_METHODS } from "../ast/index.ts";
import type {
    ComponentsIR,
    EncodingIR,
    ExampleIR,
    HeaderIR,
    InfoIR,
    MediaTypeIR,
    OpenAPIDocument,
    OperationIR,
    ParameterIR,
    PathItemIR,
    Ref,
    RequestBodyIR,
    ResponseIR,
    SchemaIR,
    SecuritySchemeIR,
    ServerIR,
} from "../ast/index.ts";

function omitUndef<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) out[k] = v;
    }
    return out;
}

function extensionsLast(base: Record<string, unknown>, ext?: Record<string, unknown>): Record<string, unknown> {
    if (!ext) return base;
    for (const [k, v] of Object.entries(ext)) {
        if (k.startsWith("x-")) base[k] = v;
    }
    return base;
}

function fromRef<T>(r: Ref<T>, inline: (v: T) => unknown): unknown {
    if (r.kind === "ref") {
        return { $ref: componentRef(r.target.table, r.target.name) };
    }
    return inline(r.value);
}

function xmlToJson(xml?: { name?: string; wrapped?: boolean; attribute?: boolean }): unknown {
    if (!xml) return undefined;
    return omitUndef({ name: xml.name, wrapped: xml.wrapped, attribute: xml.attribute });
}

function discriminatorToJson(d?: { propertyName: string; mapping?: Record<string, string> }): unknown {
    if (!d) return undefined;
    return omitUndef({ propertyName: d.propertyName, mapping: d.mapping });
}

function schemaToJson(schema: SchemaIR): unknown {
    if (schema.kind === "ref") {
        const o: Record<string, unknown> = { $ref: componentRef(schema.target.table, schema.target.name) };
        if (schema.description) o.description = schema.description;
        if (schema.summary) o.summary = schema.summary;
        return o;
    }
    if (schema.kind === "not") {
        return extensionsLast(omitUndef({ not: fromRef(schema.schema, schemaToJson), description: schema.description }), schema.extensions);
    }
    if (schema.kind === "composition") {
        return extensionsLast(
            omitUndef({
                [schema.combiner]: schema.schemas.map((s) => fromRef(s, schemaToJson)),
                discriminator: discriminatorToJson(schema.discriminator),
                nullable: schema.nullable,
                description: schema.description,
            }),
            schema.extensions,
        );
    }
    if (schema.kind === "primitive") {
        return extensionsLast(
            omitUndef({
                type: schema.types ?? schema.type,
                format: schema.format,
                enum: schema.enum,
                const: schema.const,
                nullable: schema.nullable,
                minLength: schema.minLength,
                maxLength: schema.maxLength,
                pattern: schema.pattern,
                minimum: schema.minimum,
                maximum: schema.maximum,
                exclusiveMinimum: schema.exclusiveMinimum,
                exclusiveMaximum: schema.exclusiveMaximum,
                multipleOf: schema.multipleOf,
                default: schema.default,
                example: schema.example,
                examples: schema.examples,
                readOnly: schema.readOnly,
                writeOnly: schema.writeOnly,
                deprecated: schema.deprecated,
                description: schema.description,
            }),
            schema.extensions,
        );
    }
    if (schema.kind === "array") {
        return extensionsLast(
            omitUndef({
                type: "array",
                prefixItems: schema.prefixItems?.map((s) => fromRef(s, schemaToJson)),
                items: fromRef(schema.items, schemaToJson),
                minItems: schema.minItems,
                maxItems: schema.maxItems,
                uniqueItems: schema.uniqueItems,
                xml: xmlToJson(schema.xml),
                nullable: schema.nullable,
                description: schema.description,
            }),
            schema.extensions,
        );
    }
    const properties: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema.properties)) {
        properties[k] = fromRef(v, schemaToJson);
    }
    const patternProperties = schema.patternProperties
        ? Object.fromEntries(Object.entries(schema.patternProperties).map(([k, v]) => [k, fromRef(v, schemaToJson)]))
        : undefined;
    return extensionsLast(
        omitUndef({
            type: "object",
            properties,
            required: schema.required,
            additionalProperties:
                schema.additionalProperties === undefined
                    ? undefined
                    : typeof schema.additionalProperties === "boolean"
                      ? schema.additionalProperties
                      : fromRef(schema.additionalProperties, schemaToJson),
            patternProperties,
            propertyNames: schema.propertyNames ? fromRef(schema.propertyNames, schemaToJson) : undefined,
            dependentRequired: schema.dependentRequired,
            discriminator: discriminatorToJson(schema.discriminator),
            xml: xmlToJson(schema.xml),
            readOnly: schema.readOnly,
            writeOnly: schema.writeOnly,
            deprecated: schema.deprecated,
            if: schema.if ? fromRef(schema.if, schemaToJson) : undefined,
            then: schema.then ? fromRef(schema.then, schemaToJson) : undefined,
            else: schema.else ? fromRef(schema.else, schemaToJson) : undefined,
            nullable: schema.nullable,
            description: schema.description,
        }),
        schema.extensions,
    );
}

function exampleToJson(ex: ExampleIR): unknown {
    return extensionsLast(
        omitUndef({
            summary: ex.summary,
            description: ex.description,
            value: ex.value,
            externalValue: ex.externalValue,
        }),
        ex.extensions,
    );
}

function encodingToJson(enc: EncodingIR): unknown {
    const headers = enc.headers
        ? Object.fromEntries(Object.entries(enc.headers).map(([k, v]) => [k, fromRef(v, headerToJson)]))
        : undefined;
    return extensionsLast(
        omitUndef({
            contentType: enc.contentType,
            headers,
            style: enc.style,
            explode: enc.explode,
            allowReserved: enc.allowReserved,
        }),
        enc.extensions,
    );
}

function mediaToJson(mt: MediaTypeIR): unknown {
    const examples = mt.examples
        ? Object.fromEntries(Object.entries(mt.examples).map(([k, v]) => [k, fromRef(v, exampleToJson)]))
        : undefined;
    const encoding = mt.encoding
        ? Object.fromEntries(Object.entries(mt.encoding).map(([k, v]) => [k, encodingToJson(v)]))
        : undefined;
    return extensionsLast(
        omitUndef({
            schema: mt.schema ? fromRef(mt.schema, schemaToJson) : undefined,
            example: mt.example,
            examples,
            encoding,
        }),
        mt.extensions,
    );
}

function parameterToJson(p: ParameterIR): unknown {
    const content = p.content
        ? Object.fromEntries(Object.entries(p.content).map(([k, v]) => [k, mediaToJson(v)]))
        : undefined;
    const examples = p.examples
        ? Object.fromEntries(Object.entries(p.examples).map(([k, v]) => [k, fromRef(v, exampleToJson)]))
        : undefined;
    return extensionsLast(
        omitUndef({
            name: p.name,
            in: p.in,
            description: p.description,
            required: p.required,
            deprecated: p.deprecated,
            allowEmptyValue: p.allowEmptyValue,
            style: p.style,
            explode: p.explode,
            allowReserved: p.allowReserved,
            schema: p.schema ? fromRef(p.schema, schemaToJson) : undefined,
            content,
            example: p.example,
            examples,
        }),
        p.extensions,
    );
}

function headerToJson(h: HeaderIR): unknown {
    const content = h.content
        ? Object.fromEntries(Object.entries(h.content).map(([k, v]) => [k, mediaToJson(v)]))
        : undefined;
    const examples = h.examples
        ? Object.fromEntries(Object.entries(h.examples).map(([k, v]) => [k, fromRef(v, exampleToJson)]))
        : undefined;
    return extensionsLast(
        omitUndef({
            description: h.description,
            required: h.required,
            deprecated: h.deprecated,
            style: h.style,
            explode: h.explode,
            schema: h.schema ? fromRef(h.schema, schemaToJson) : undefined,
            content,
            example: h.example,
            examples,
        }),
        h.extensions,
    );
}

function responseToJson(r: ResponseIR): unknown {
    const headers = r.headers
        ? Object.fromEntries(Object.entries(r.headers).map(([k, v]) => [k, fromRef(v, headerToJson)]))
        : undefined;
    const content = r.content
        ? Object.fromEntries(Object.entries(r.content).map(([k, v]) => [k, mediaToJson(v)]))
        : undefined;
    const links = r.links
        ? Object.fromEntries(
              Object.entries(r.links).map(([k, v]) => [
                  k,
                  fromRef(v, (link) =>
                      omitUndef({
                          operationId: link.operationId,
                          operationRef: link.operationRef,
                          parameters: link.parameters,
                          requestBody: link.requestBody,
                          description: link.description,
                          server: link.server ? serverToJson(link.server) : undefined,
                      }),
                  ),
              ]),
          )
        : undefined;
    return extensionsLast(omitUndef({ description: r.description, headers, content, links }), r.extensions);
}

function requestBodyToJson(b: RequestBodyIR): unknown {
    const content = Object.fromEntries(Object.entries(b.content).map(([k, v]) => [k, mediaToJson(v)]));
    return extensionsLast(omitUndef({ description: b.description, required: b.required, content }), b.extensions);
}

function operationToJson(op: OperationIR): unknown {
    const parameters = op.parameters?.map((p) => fromRef(p, parameterToJson));
    const responses = Object.fromEntries(
        Object.entries(op.responses).map(([code, r]) => [code, fromRef(r, responseToJson)]),
    );
    return extensionsLast(
        omitUndef({
            tags: op.tags,
            summary: op.summary,
            description: op.description,
            operationId: op.operationId,
            parameters: parameters?.length ? parameters : undefined,
            requestBody: op.requestBody ? fromRef(op.requestBody, requestBodyToJson) : undefined,
            responses,
            callbacks: op.callbacks,
            deprecated: op.deprecated,
            security: op.security,
            servers: op.servers?.map(serverToJson),
            externalDocs: op.externalDocs,
        }),
        op.extensions,
    );
}

function pathItemToJson(item: PathItemIR): unknown {
    if (item.$ref) {
        return { $ref: componentRef(item.$ref.table, item.$ref.name) };
    }
    const methods: Record<string, unknown> = {};
    for (const m of HTTP_METHODS) {
        if (item[m]) methods[m] = operationToJson(item[m]!);
    }
    return extensionsLast(
        omitUndef({
            summary: item.summary,
            description: item.description,
            servers: item.servers?.map(serverToJson),
            parameters: item.parameters?.length ? item.parameters.map((p) => fromRef(p, parameterToJson)) : undefined,
            ...methods,
        }),
        item.extensions,
    );
}

function serverToJson(s: ServerIR): unknown {
    const variables = s.variables
        ? Object.fromEntries(
              Object.entries(s.variables).map(([k, v]) => [
                  k,
                  omitUndef({ default: v.default, enum: v.enum, description: v.description }),
              ]),
          )
        : undefined;
    return omitUndef({ url: s.url, description: s.description, variables });
}

function infoToJson(info: InfoIR): unknown {
    return extensionsLast(
        omitUndef({
            title: info.title,
            summary: info.summary,
            description: info.description,
            termsOfService: info.termsOfService,
            contact: info.contact
                ? omitUndef({ name: info.contact.name, url: info.contact.url, email: info.contact.email })
                : undefined,
            license: info.license
                ? omitUndef({ name: info.license.name, url: info.license.url, identifier: info.license.identifier })
                : undefined,
            version: info.version,
        }),
        info.extensions,
    );
}

function securitySchemeToJson(s: SecuritySchemeIR): unknown {
    return extensionsLast(
        omitUndef({
            type: s.type,
            description: s.description,
            name: s.name,
            in: s.in,
            scheme: s.scheme,
            bearerFormat: s.bearerFormat,
            flows: s.flows,
            openIdConnectUrl: s.openIdConnectUrl,
        }),
        s.extensions,
    );
}

function componentsToJson(c: ComponentsIR): unknown {
    const map = <T>(rec: Record<string, T> | undefined, fn: (v: T) => unknown) =>
        rec && Object.keys(rec).length ? Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, fn(v)])) : undefined;
    return extensionsLast(
        omitUndef({
            schemas: map(c.schemas, schemaToJson),
            responses: map(c.responses, responseToJson),
            parameters: map(c.parameters, parameterToJson),
            examples: map(c.examples, exampleToJson),
            requestBodies: map(c.requestBodies, requestBodyToJson),
            headers: map(c.headers, headerToJson),
            securitySchemes: map(c.securitySchemes, securitySchemeToJson),
            links: c.links,
            callbacks: c.callbacks,
            pathItems: map(c.pathItems, pathItemToJson),
        }),
        c.extensions,
    );
}

/** Stable key order for readable goldens and shrinks. */
export function documentToJson(doc: OpenAPIDocument): Record<string, unknown> {
    const paths = doc.paths
        ? Object.fromEntries(Object.entries(doc.paths).map(([k, v]) => [k, pathItemToJson(v)]))
        : undefined;
    const webhooks = doc.webhooks
        ? Object.fromEntries(Object.entries(doc.webhooks).map(([k, v]) => [k, pathItemToJson(v)]))
        : undefined;
    const components = doc.components ? componentsToJson(doc.components) : undefined;
    const componentsEmpty =
        components && typeof components === "object" && Object.keys(components as object).length === 0;

    return extensionsLast(
        omitUndef({
            openapi: doc.openapi,
            info: infoToJson(doc.info),
            jsonSchemaDialect: doc.jsonSchemaDialect,
            servers: doc.servers?.map(serverToJson),
            security: doc.security,
            tags: doc.tags?.map((t) => omitUndef({ name: t.name, description: t.description, externalDocs: t.externalDocs })),
            externalDocs: doc.externalDocs,
            paths,
            webhooks,
            components: componentsEmpty ? undefined : components,
        }),
        doc.extensions,
    );
}

export function toJsonString(doc: OpenAPIDocument): string {
    return JSON.stringify(documentToJson(doc), null, 2) + "\n";
}

export function toYamlString(doc: OpenAPIDocument): string {
    return yamlStringify(documentToJson(doc), {
        indent: 2,
        lineWidth: 120,
        defaultStringType: "PLAIN",
        defaultKeyType: "PLAIN",
    });
}
