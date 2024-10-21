import type { GraphQLSchema } from "graphql";
import { GraphQLGenerator, Flavors } from "@samarium.sdk/make";
import { introspectGraphQLSchema } from "./util/introspect";

import fs from "fs";
import { detectAndReplacePlaceholders } from "@/lib/cli/util";

export const generate = async (
    remote: { url: string; headers?: string[] },
    flavor: keyof (typeof Flavors)["GraphQL"],
    output: string,
    options: {
        endpoint?: string;
        authHeaderName?: string;
    } = {},
) => {
    let showLogo = true;

    remote.url = await detectAndReplacePlaceholders(
        "GraphQL",
        remote.url,
        "The URL",
        showLogo,
    );
    if (remote.headers?.length) {
        for (const header of remote.headers) {
            const output = await detectAndReplacePlaceholders(
                "GraphQL",
                header,
                "The header",
                showLogo,
            );
            remote.headers[remote.headers.indexOf(header)] = output;
        }
    }
    if (options.endpoint) {
        options.endpoint = await detectAndReplacePlaceholders(
            "GraphQL",
            options.endpoint,
            "The endpoint",
            showLogo,
        );
    }
    if (options.authHeaderName) {
        options.authHeaderName = await detectAndReplacePlaceholders(
            "GraphQL",
            options.authHeaderName,
            "The auth header name",
            showLogo,
        );
    }
    output = await detectAndReplacePlaceholders(
        "GraphQL",
        output,
        "The output file",
        showLogo,
    );

    let schema: GraphQLSchema | undefined;
    try {
        schema = await introspectGraphQLSchema(remote.url, remote.headers);
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
    const generator = new GraphQLGenerator.Generator(Flavors.GraphQL[flavor]);
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
        code.replace("[ENDPOINT]", options.endpoint ?? remote.url),
    );
};
