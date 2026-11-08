import type {
    AppliedDirective,
    ArgIR,
    DirectiveDefIR,
    EnumValueIR,
    ExtensionIR,
    FieldIR,
    GraphQLDocument,
    InputFieldIR,
    NamedTypeIR,
    TypeRef,
} from "../ast/index.ts";

function escapeString(value: string): string {
    return JSON.stringify(value);
}

function printValue(value: unknown): string {
    if (value === null) return "null";
    if (typeof value === "string") return escapeString(value);
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return `[${value.map(printValue).join(", ")}]`;
    if (typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>).map(
            ([k, v]) => `${k}: ${printValue(v)}`,
        );
        return `{ ${entries.join(", ")} }`;
    }
    return "null";
}

export function printTypeRef(t: TypeRef): string {
    if (t.kind === "named") return t.name;
    if (t.kind === "list") return `[${printTypeRef(t.of)}]`;
    return `${printTypeRef(t.of)}!`;
}

function printDescription(desc: string | undefined, indent = ""): string {
    if (!desc) return "";
    if (!desc.includes("\n") && desc.length < 70) return `${indent}"${desc.replace(/"/g, '\\"')}"\n`;
    return `${indent}"""\n${indent}${desc}\n${indent}"""\n`;
}

function printDirectives(dirs: AppliedDirective[] | undefined): string {
    if (!dirs?.length) return "";
    return dirs
        .map((d) => {
            const args = d.args
                ? `(${Object.entries(d.args)
                      .map(([k, v]) => `${k}: ${printValue(v)}`)
                      .join(", ")})`
                : "";
            return ` @${d.name}${args}`;
        })
        .join("");
}

function printArgs(args: ArgIR[] | undefined): string {
    if (!args?.length) return "";
    const inner = args
        .map((a) => {
            const def = a.defaultValue !== undefined ? ` = ${printValue(a.defaultValue)}` : "";
            return `${a.name}: ${printTypeRef(a.type)}${def}${printDirectives(a.directives)}`;
        })
        .join(", ");
    return `(${inner})`;
}

function printField(f: FieldIR, indent = "  "): string {
    let out = printDescription(f.description, indent);
    out += `${indent}${f.name}${printArgs(f.args)}: ${printTypeRef(f.type)}`;
    if (f.deprecationReason != null) {
        out += ` @deprecated(reason: ${escapeString(f.deprecationReason)})`;
    }
    out += printDirectives(f.directives);
    return out;
}

function printInputField(f: InputFieldIR, indent = "  "): string {
    let out = printDescription(f.description, indent);
    const def = f.defaultValue !== undefined ? ` = ${printValue(f.defaultValue)}` : "";
    out += `${indent}${f.name}: ${printTypeRef(f.type)}${def}`;
    out += printDirectives(f.directives);
    return out;
}

function printEnumValue(v: EnumValueIR, indent = "  "): string {
    let out = printDescription(v.description, indent);
    out += `${indent}${v.name}`;
    if (v.deprecationReason != null) {
        out += ` @deprecated(reason: ${escapeString(v.deprecationReason)})`;
    }
    out += printDirectives(v.directives);
    return out;
}

function printDirectiveDef(d: DirectiveDefIR): string {
    let out = printDescription(d.description);
    const args = d.args?.length
        ? `(${d.args
              .map((a) => {
                  const def = a.defaultValue !== undefined ? ` = ${printValue(a.defaultValue)}` : "";
                  return `${a.name}: ${printTypeRef(a.type)}${def}`;
              })
              .join(", ")})`
        : "";
    const repeatable = d.isRepeatable ? " repeatable" : "";
    out += `directive @${d.name}${args}${repeatable} on ${d.locations.join(" | ")}`;
    return out;
}

function printType(t: NamedTypeIR): string {
    let out = printDescription(t.description);
    switch (t.kind) {
        case "scalar":
            out += `scalar ${t.name}`;
            if (t.specifiedByURL) out += ` @specifiedBy(url: ${escapeString(t.specifiedByURL)})`;
            out += printDirectives(t.directives);
            return out;
        case "object": {
            const impl = t.interfaces?.length ? ` implements ${t.interfaces.join(" & ")}` : "";
            out += `type ${t.name}${impl}${printDirectives(t.directives)} {\n`;
            out += t.fields.map((f) => printField(f)).join("\n") + "\n}";
            return out;
        }
        case "interface": {
            const impl = t.interfaces?.length ? ` implements ${t.interfaces.join(" & ")}` : "";
            out += `interface ${t.name}${impl}${printDirectives(t.directives)} {\n`;
            out += t.fields.map((f) => printField(f)).join("\n") + "\n}";
            return out;
        }
        case "union":
            out += `union ${t.name}${printDirectives(t.directives)} = ${t.members.join(" | ")}`;
            return out;
        case "enum":
            out += `enum ${t.name}${printDirectives(t.directives)} {\n`;
            out += t.values.map((v) => printEnumValue(v)).join("\n") + "\n}";
            return out;
        case "inputObject": {
            const oneOf = t.isOneOf ? " @oneOf" : "";
            out += `input ${t.name}${oneOf}${printDirectives(t.directives)} {\n`;
            out += t.fields.map((f) => printInputField(f)).join("\n") + "\n}";
            return out;
        }
    }
}

function printExtension(e: ExtensionIR): string {
    switch (e.kind) {
        case "schema": {
            const lines: string[] = [];
            if (e.mutation) lines.push(`  mutation: ${e.mutation}`);
            if (e.subscription) lines.push(`  subscription: ${e.subscription}`);
            return `extend schema {\n${lines.join("\n")}\n}`;
        }
        case "object": {
            const impl = e.interfaces?.length ? ` implements ${e.interfaces.join(" & ")}` : "";
            return `extend type ${e.name}${impl} {\n${e.fields.map((f) => printField(f)).join("\n")}\n}`;
        }
        case "interface": {
            const impl = e.interfaces?.length ? ` implements ${e.interfaces.join(" & ")}` : "";
            return `extend interface ${e.name}${impl} {\n${e.fields.map((f) => printField(f)).join("\n")}\n}`;
        }
        case "inputObject":
            return `extend input ${e.name} {\n${e.fields.map((f) => printInputField(f)).join("\n")}\n}`;
        case "enum":
            return `extend enum ${e.name} {\n${e.values.map((v) => printEnumValue(v)).join("\n")}\n}`;
        case "union":
            return `extend union ${e.name} = ${e.members.join(" | ")}`;
    }
}

export function toSdl(doc: GraphQLDocument): string {
    const parts: string[] = [];

    for (const d of doc.directives) {
        parts.push(printDirectiveDef(d));
    }

    // Prefer emitting schema block when mutation/subscription present or non-default query name
    const schema = doc.schema;
    const needsSchema =
        schema &&
        (schema.mutation ||
            schema.subscription ||
            (schema.query && schema.query !== "Query") ||
            schema.description ||
            schema.directives?.length);
    if (needsSchema && schema) {
        let block = printDescription(schema.description);
        block += `schema${printDirectives(schema.directives)} {\n`;
        if (schema.query) block += `  query: ${schema.query}\n`;
        if (schema.mutation) block += `  mutation: ${schema.mutation}\n`;
        if (schema.subscription) block += `  subscription: ${schema.subscription}\n`;
        block += "}";
        parts.push(block);
    }

    for (const t of doc.types) {
        parts.push(printType(t));
    }

    for (const e of doc.extensions ?? []) {
        parts.push(printExtension(e));
    }

    return parts.filter(Boolean).join("\n\n") + "\n";
}

/** Stable text for hashing (sorted type names). */
export function toStableSdl(doc: GraphQLDocument): string {
    const sorted: GraphQLDocument = {
        schema: doc.schema,
        directives: [...doc.directives].sort((a, b) => a.name.localeCompare(b.name)),
        types: [...doc.types].sort((a, b) => a.name.localeCompare(b.name)),
        extensions: doc.extensions ? [...doc.extensions] : undefined,
    };
    return toSdl(sorted);
}
