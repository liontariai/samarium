import type { GraphQLSchema } from "graphql";
import { Generator, Flavors } from "../lib/codegen";
import { introspectGraphQLSchema } from "./util/introspect";

import fs from "fs";
import { printLogo } from "@/lib/cli/logo";
import { confirm, input } from "@inquirer/prompts";

export const generate = async (
    remote: { url: string; headers?: string[] },
    flavor: keyof typeof Flavors,
    output: string,
    options: {
        endpoint?: string;
        authHeaderName?: string;
    } = {},
) => {
    let logoShown = false;
    const detectAndReplacePlaceholders = async (
        str: string,
        descriptor: string,
    ) => {
        // detect placeholders in the str, e.g. /slug/<name>/other or /slug/[name]/other
        const regex = /<([^>]+)>|\[([^\]]+)\]/g;
        let match;
        const placeholders = [];
        while ((match = regex.exec(str))) {
            placeholders.push(match[1] ?? match[2]);
        }
        if (placeholders.length > 0) {
            if (!logoShown) {
                printLogo();
                logoShown = true;
            }

            const strColoredGreenPlaceholders = str.replace(
                regex,
                (match) => `\x1b[32m${match}\x1b[0m`,
            );

            if (
                await confirm({
                    message: `${descriptor} contains placeholders: ${strColoredGreenPlaceholders} . Do you want to replace them with actual values?`,
                })
            ) {
                const values: string[] = [];
                for (const placeholder of placeholders) {
                    const value = await input({
                        message: `Enter value for placeholder ${placeholder}:`,
                    });
                    values.push(value);
                }
                str = str.replace(regex, () => values.shift() ?? "");

                console.log(`${descriptor} has been updated to: ${str}`);
                console.log(" ");
            } else {
                console.log(
                    `${descriptor} has not been updated. Using the original value: ${str}`,
                );
                console.log(" ");
            }

            return str;
        }
        return str;
    };

    remote.url = await detectAndReplacePlaceholders(remote.url, "The URL");
    if (remote.headers?.length) {
        for (const header of remote.headers) {
            const output = await detectAndReplacePlaceholders(
                header,
                "The header",
            );
            remote.headers[remote.headers.indexOf(header)] = output;
        }
    }
    if (options.endpoint) {
        options.endpoint = await detectAndReplacePlaceholders(
            options.endpoint,
            "The endpoint",
        );
    }
    if (options.authHeaderName) {
        options.authHeaderName = await detectAndReplacePlaceholders(
            options.authHeaderName,
            "The auth header name",
        );
    }
    output = await detectAndReplacePlaceholders(output, "The output file");

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
    const generator = new Generator(Flavors[flavor]);
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
