import { OpenAPIGenerator, Flavors } from "@/lib/codegen";
import { introspectOpenAPISchema } from "./util/introspect";

import fs from "fs";
import { detectAndReplacePlaceholders } from "@/lib/cli/util";
import type { OpenAPI3 } from "openapi-typescript";

export const generate = async (
    remote: { url: string; headers?: string[] },
    flavor: keyof (typeof Flavors)["OpenAPI"],
    output: string,
    options: {
        endpoint?: string;
        authHeaderName?: string;
    } = {},
) => {
    let showLogo = true;

    remote.url = await detectAndReplacePlaceholders(
        "OpenAPI",
        remote.url,
        "The URL",
        showLogo,
    );
    if (remote.headers?.length) {
        for (const header of remote.headers) {
            const output = await detectAndReplacePlaceholders(
                "OpenAPI",
                header,
                "The header",
                showLogo,
            );
            remote.headers[remote.headers.indexOf(header)] = output;
        }
    }
    if (options.endpoint) {
        options.endpoint = await detectAndReplacePlaceholders(
            "OpenAPI",
            options.endpoint,
            "The endpoint",
            showLogo,
        );
    }
    if (options.authHeaderName) {
        options.authHeaderName = await detectAndReplacePlaceholders(
            "OpenAPI",
            options.authHeaderName,
            "The auth header name",
            showLogo,
        );
    }
    output = await detectAndReplacePlaceholders(
        "OpenAPI",
        output,
        "The output file",
        showLogo,
    );

    let schema: OpenAPI3 | undefined;
    try {
        schema = await introspectOpenAPISchema(remote.url, remote.headers);
    } catch (e: any) {
        if (e.response?.status === 401 || e.response?.status === 403) {
            console.error(
                `Introspection failed: HTTP ${e.response.status} Unauthorized. Please check your headers.`,
            );
            return;
        }
        console.error("Failed to introspect schema", e);
        return;
    }
    const generator = new OpenAPIGenerator.Generator(Flavors.OpenAPI[flavor]);
    const code = await generator.generate({
        schema,
        options: {},
        authConfig: remote.headers
            ? {
                  headerName:
                      remote.headers.length === 1
                          ? remote.headers[0].split("=")[0]
                          : "Authorization",
              }
            : undefined,
    });

    // ensure the output file ends with .ts
    if (!output.endsWith(".ts")) {
        output += ".ts";
    }
    // ensure the output directory exists
    fs.mkdirSync(output.split("/").slice(0, -1).join("/"), { recursive: true });

    fs.writeFileSync(
        output,
        code.replace(
            "[ENDPOINT]",
            options.endpoint ?? schema.servers?.[0]?.url ?? remote.url,
        ),
    );
};
