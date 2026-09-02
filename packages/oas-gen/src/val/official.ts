import Ajv2020 from "ajv/dist/2020.js";
import AjvDraft04 from "ajv-draft-04";
import addFormats from "ajv-formats";
import type { ErrorObject, ValidateFunction } from "ajv";
import type { Dialect, LayerResult } from "../types.ts";
import schema30 from "../../vendor/oas-schemas/oas-3.0-2024-10-18.json" with { type: "json" };
import schema31raw from "../../vendor/oas-schemas/oas-3.1-2025-11-23.json" with { type: "json" };

let validate30: ValidateFunction | undefined;
let validate31: ValidateFunction | undefined;

/**
 * AJV still resolves `$dynamicRef: "#meta"` to the document root instead of
 * `$defs/schema` ($dynamicAnchor). The documented workaround (OAI #2689 / AJV #1745)
 * is to rewrite those to a static `$ref` before compile. Vendor file stays pristine.
 */
function schema31ForAjv(): object {
    const cloned = structuredClone(schema31raw) as unknown;
    const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            for (const x of node) walk(x);
            return;
        }
        const rec = node as Record<string, unknown>;
        if (rec.$dynamicRef === "#meta") {
            delete rec.$dynamicRef;
            rec.$ref = "#/$defs/schema";
        }
        for (const v of Object.values(rec)) walk(v);
    };
    walk(cloned);
    return cloned as object;
}

function addMediaRange(ajv: { addFormat: (name: string, fmt: string | RegExp) => unknown }): void {
    ajv.addFormat("media-range", /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+(\s*;\s*.+)?$/);
}

function compile30(): ValidateFunction {
    if (validate30) return validate30;
    const ajv = new AjvDraft04({
        allErrors: true,
        strict: false,
        validateFormats: true,
    });
    addFormats(ajv);
    addMediaRange(ajv);
    validate30 = ajv.compile(schema30);
    return validate30;
}

function compile31(): ValidateFunction {
    if (validate31) return validate31;
    const ajv = new Ajv2020({
        allErrors: true,
        strict: false,
        validateFormats: true,
        unevaluated: true,
    });
    addFormats(ajv);
    addMediaRange(ajv);
    validate31 = ajv.compile(schema31ForAjv());
    return validate31;
}

function formatErrors(errors: ErrorObject[] | null | undefined): unknown[] {
    if (!errors?.length) return [];
    return errors.map((e) => ({
        instancePath: e.instancePath,
        schemaPath: e.schemaPath,
        keyword: e.keyword,
        message: e.message,
        params: e.params,
    }));
}

export function validateOfficialSchema(doc: unknown, dialect: Dialect): LayerResult {
    const validate = dialect === "3.0" ? compile30() : compile31();
    const ok = validate(doc) as boolean;
    return { ok, errors: ok ? [] : formatErrors(validate.errors) };
}
