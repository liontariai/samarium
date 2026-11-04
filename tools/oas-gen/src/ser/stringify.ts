import { stringify as yamlStringify } from "yaml";

export function stringifyJson(value: unknown): string {
    return JSON.stringify(value, null, 2) + "\n";
}

export function stringifyYaml(value: unknown, flow = false): string {
    return yamlStringify(value, {
        indent: 2,
        lineWidth: flow ? 0 : 120,
        collectionStyle: flow ? "flow" : "block",
        defaultStringType: "PLAIN",
        defaultKeyType: "PLAIN",
    });
}
