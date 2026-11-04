import { describe, expect, it } from "bun:test";
import { parse as parseYaml } from "yaml";
import { generate } from "../src/generate.ts";
import { documentToJson, toJsonString, toYamlString } from "../src/ser/index.ts";

describe("serialize", () => {
    it("JSON then YAML parse agrees on openapi/info/paths keys", () => {
        const spec = generate({ seed: 7, dialect: "3.0", profile: "core-rest", format: "both" });
        const fromIr = documentToJson(spec.ir) as Record<string, unknown>;
        const fromJson = JSON.parse(toJsonString(spec.ir)) as Record<string, unknown>;
        const fromYaml = parseYaml(toYamlString(spec.ir)) as Record<string, unknown>;
        expect(fromJson.openapi).toBe(fromIr.openapi);
        expect(fromYaml.openapi).toBe(fromIr.openapi);
        expect(Object.keys(fromJson.paths as object).sort()).toEqual(Object.keys(fromIr.paths as object).sort());
        expect(Object.keys(fromYaml.paths as object).sort()).toEqual(Object.keys(fromIr.paths as object).sort());
    });

    it("stable key order starts with openapi, info", () => {
        const spec = generate({ seed: 1, dialect: "3.1", profile: "minimal" });
        const keys = Object.keys(documentToJson(spec.ir));
        expect(keys[0]).toBe("openapi");
        expect(keys[1]).toBe("info");
    });

    it("same seed is deterministic", () => {
        const a = generate({ seed: 42, dialect: "3.1", profile: "core-rest" });
        const b = generate({ seed: 42, dialect: "3.1", profile: "core-rest" });
        expect(a.meta.hash).toBe(b.meta.hash);
        expect(toJsonString(a.ir)).toBe(toJsonString(b.ir));
    });
});
