import { posix } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Rng } from "../rng.ts";
import { shuffleKeys } from "./chaos.ts";
import { stringifyJson, stringifyYaml } from "./stringify";

export type MultiFileExt = "yaml" | "json";

function isObj(x: unknown): x is Record<string, unknown> {
    return !!x && typeof x === "object" && !Array.isArray(x);
}

function clone<T>(x: T): T {
    return structuredClone(x);
}

function parseFile(text: string): unknown {
    const t = text.replace(/^\uFEFF/, "");
    try {
        return JSON.parse(t);
    } catch {
        return parseYaml(t);
    }
}

function resolveHref(fromFile: string, href: string): string {
    let h = href.replace(/^file:\/\//, "");
    if (h.startsWith("/")) return posix.normalize(h.replace(/^\/+/, ""));
    return posix.normalize(posix.join(posix.dirname(fromFile), h));
}

/**
 * Split selected component objects into sidecar files and point at them with
 * relative (`./…`) and path-absolute (`/…`) `$ref`s. IR stays a single document;
 * this is serialization-only.
 */
export function splitToFiles(
    root: Record<string, unknown>,
    opts: {
        ext: MultiFileExt;
        yamlFlow?: boolean;
        shuffle?: boolean;
        rng?: Rng;
    },
): { files: Record<string, string>; features: string[] } {
    const json = clone(root);
    const features: string[] = [];
    const components = isObj(json.components) ? json.components : undefined;
    const ext = opts.ext;
    const sidecars: Record<string, unknown> = {};

    const dump = (value: unknown): string => {
        const v = opts.shuffle && opts.rng ? shuffleKeys(value, opts.rng) : value;
        return ext === "json" ? stringifyJson(v) : stringifyYaml(v, opts.yamlFlow === true);
    };

    if (components && isObj(components.schemas)) {
        const names = Object.keys(components.schemas).filter((n) => n !== "Error" && n !== "Unused.Model");
        const pick = names[0];
        if (pick) {
            const file = `schemas/${pick}.${ext}`;
            sidecars[file] = components.schemas[pick];
            components.schemas[pick] = { $ref: `./${file}` };
            features.push("ref.external", "multifile.relative");
        }
    }

    if (components && isObj(components.parameters)) {
        const names = Object.keys(components.parameters);
        const pick = names[0];
        if (pick) {
            const file = `params/${pick}.${ext}`;
            sidecars[file] = components.parameters[pick];
            components.parameters[pick] = { $ref: `/${file}` };
            features.push("ref.external", "multifile.absolute");
        }
    }

    if (components && isObj(components.requestBodies)) {
        const names = Object.keys(components.requestBodies);
        const pick = names[0];
        if (pick) {
            const file = `requestBodies/${pick}.${ext}`;
            sidecars[file] = components.requestBodies[pick];
            components.requestBodies[pick] = { $ref: `./${file}` };
            features.push("ref.external", "multifile.relative");
        }
    }

    const rootName = ext === "json" ? "openapi.json" : "openapi.yaml";
    const rootValue = opts.shuffle && opts.rng ? shuffleKeys(json, opts.rng) : json;
    const files: Record<string, string> = {
        [rootName]: ext === "json" ? stringifyJson(rootValue) : stringifyYaml(rootValue, opts.yamlFlow === true),
    };
    for (const [path, value] of Object.entries(sidecars)) {
        files[path] = dump(value);
    }
    return { files, features: [...new Set(features)] };
}

function resolvePointer(doc: unknown, ref: string): unknown {
    if (!ref.startsWith("#/")) return doc;
    const parts = ref
        .slice(2)
        .split("/")
        .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
    let cur: unknown = doc;
    for (const p of parts) {
        if (!isObj(cur) && !Array.isArray(cur)) return undefined;
        cur = (cur as Record<string, unknown>)[p];
        if (cur === undefined) return undefined;
    }
    return cur;
}

/**
 * Inline file `$ref`s from a generated `files` map into a single OpenAPI document.
 * Internal `#/` pointers are left intact.
 */
export function bundleFiles(files: Record<string, string>, rootName?: string): Record<string, unknown> {
    const root =
        rootName ??
        (files["openapi.yaml"] != null ? "openapi.yaml" : files["openapi.json"] != null ? "openapi.json" : Object.keys(files)[0]);
    if (!root || files[root] == null) {
        throw new Error("bundleFiles: missing root document");
    }
    const parsed: Record<string, unknown> = {};
    for (const [k, text] of Object.entries(files)) {
        parsed[k] = parseFile(text);
    }
    const visiting = new Set<string>();

    const load = (file: string, pointer: string): unknown => {
        const key = posix.normalize(file);
        const doc = parsed[key];
        if (doc === undefined) {
            throw new Error(`bundleFiles: missing file "${key}"`);
        }
        const target = pointer ? resolvePointer(doc, pointer) : doc;
        return walk(target, key);
    };

    const walk = (node: unknown, fromFile: string): unknown => {
        if (Array.isArray(node)) return node.map((x) => walk(x, fromFile));
        if (!isObj(node)) return node;
        if (typeof node.$ref === "string") {
            const ref = node.$ref;
            if (ref.startsWith("#")) {
                const out: Record<string, unknown> = { $ref: ref };
                for (const [k, v] of Object.entries(node)) {
                    if (k === "$ref") continue;
                    out[k] = walk(v, fromFile);
                }
                return out;
            }
            const hash = ref.indexOf("#");
            const href = hash >= 0 ? ref.slice(0, hash) : ref;
            const pointer = hash >= 0 ? ref.slice(hash) : "";
            const file = resolveHref(fromFile, href);
            const token = `${file}${pointer}`;
            if (visiting.has(token)) return { $ref: `#/__cycle/${token}` };
            visiting.add(token);
            try {
                const inlined = load(file, pointer);
                if (isObj(inlined)) {
                    const merged: Record<string, unknown> = { ...inlined };
                    for (const [k, v] of Object.entries(node)) {
                        if (k === "$ref") continue;
                        merged[k] = walk(v, fromFile);
                    }
                    return merged;
                }
                return inlined;
            } finally {
                visiting.delete(token);
            }
        }
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(node)) out[k] = walk(v, fromFile);
        return out;
    };

    const bundled = walk(parsed[root], root);
    if (!isObj(bundled)) throw new Error("bundleFiles: root is not an object");
    return bundled;
}
