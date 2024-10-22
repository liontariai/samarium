import packageJson from "../package.json";

import { Command } from "commander";
import * as GraphQLCommands from "./commands/graphql";
import * as OpenAPICommands from "./commands/openapi";
import { select } from "@inquirer/prompts";

function collect(value: string, previous: string[]) {
    return previous.concat([value]);
}

const program = new Command();

program
    .name("samarium") // Name of the CLI
    .description("CLI Description") // Description of the CLI
    .version(packageJson.version); // Version of the CLI

program
    .command("ui", { isDefault: true })
    .description("Start the assistant UI")
    .action(async () => {
        const choice = (await select({
            message: "Do you want to compile GraphQL or OpenAPI?",
            choices: [
                {
                    name: "GraphQL",
                    value: "GraphQL",
                    description: "GraphQL",
                },
                { name: "OpenAPI", value: "OpenAPI", description: "OpenAPI" },
            ],
        })) as "GraphQL" | "OpenAPI";

        if (choice === "GraphQL") {
            await GraphQLCommands.ui().catch((error) => {});
        } else {
            await OpenAPICommands.ui().catch((error) => {});
        }
    });

// Example command
program
    .command("introspect <url> <output>")
    .option(
        "-h, --header [header]",
        "Header to send with the request, e.g. 'Authorization=Bearer 1234'",
        collect,
        [],
    )
    .description(
        "This command is deprecated. Use the explicit command instead: introspect-gql or introspect-openapi",
    )
    .action(
        async (
            url: string,
            output: string,
            { header: headers }: { header?: string[] } = {},
        ) => {
            const choice = (await select({
                message: "Do you want to introspect GraphQL or OpenAPI?",
                choices: [
                    {
                        name: "GraphQL",
                        value: "GraphQL",
                        description: "GraphQL",
                    },
                    {
                        name: "OpenAPI",
                        value: "OpenAPI",
                        description: "OpenAPI",
                    },
                ],
            })) as "GraphQL" | "OpenAPI";

            if (choice === "GraphQL") {
                await GraphQLCommands.introspect({ url, headers }, output);
            } else {
                await OpenAPICommands.introspect({ url, headers }, output);
            }
        },
    );

program
    .command("introspect-gql <url> <output>")
    .option(
        "-h, --header [header]",
        "Header to send with the request, e.g. 'Authorization=Bearer 1234'",
        collect,
        [],
    )
    .description("Introspect a GraphQL schema")
    .action(
        async (
            url: string,
            output: string,
            { header: headers }: { header?: string[] } = {},
        ) => {
            await GraphQLCommands.introspect({ url, headers }, output);
        },
    );

program
    .command("introspect-openapi <url> <output>")
    .option(
        "-h, --header [header]",
        "Header to send with the request, e.g. 'Authorization=Bearer 1234'",
        collect,
        [],
    )
    .description("Introspect an OpenAPI schema")
    .action(
        async (
            url: string,
            output: string,
            { header: headers }: { header?: string[] } = {},
        ) => {
            await OpenAPICommands.introspect({ url, headers }, output);
        },
    );

program
    .command("generate <url> <output>")
    .alias("g")
    .description(
        "This command is deprecated. Use the explicit command instead: generate-gql or generate-openapi",
    )
    .option(
        "-h, --header [header]",
        "Header to send with the request, e.g. 'Authorization=Bearer 1234'",
        collect,
        [],
    )
    .option(
        "--endpoint [endpoint]",
        "Endpoint to use in the generated code, defaults to the schema introspection URL",
    )
    .option(
        "--auth-header-name [authHeaderName]",
        "Name of the header to use for authorization. Defaults to first header name, if headers are provided.",
    )
    .action(
        async (
            url: string,
            output: string,
            {
                header: headers,
                endpoint,
                authHeaderName,
            }: {
                header?: string[];
                endpoint?: string;
                authHeaderName?: string;
            } = {},
        ) => {
            const choice = (await select({
                message: "Do you want to compile GraphQL or OpenAPI?",
                choices: [
                    {
                        name: "GraphQL",
                        value: "GraphQL",
                        description: "GraphQL",
                    },
                    {
                        name: "OpenAPI",
                        value: "OpenAPI",
                        description: "OpenAPI",
                    },
                ],
            })) as "GraphQL" | "OpenAPI";

            if (choice === "GraphQL") {
                await GraphQLCommands.generate(
                    { url, headers },
                    "default",
                    output,
                    {
                        endpoint,
                        authHeaderName,
                    },
                );
            } else {
                await OpenAPICommands.generate(
                    { url, headers },
                    "default",
                    output,
                    {
                        endpoint,
                        authHeaderName,
                    },
                );
            }
        },
    );

program
    .command("generate-gql <url> <output>")
    .option(
        "-h, --header [header]",
        "Header to send with the request, e.g. 'Authorization=Bearer 1234'",
        collect,
        [],
    )
    .option(
        "--endpoint [endpoint]",
        "Endpoint to use in the generated code, defaults to the schema introspection URL",
    )
    .option(
        "--auth-header-name [authHeaderName]",
        "Name of the header to use for authorization. Defaults to first header name, if headers are provided.",
    )
    .description("Generate code from a GraphQL schema")
    .action(
        async (
            url: string,
            output: string,
            {
                header: headers,
                endpoint,
                authHeaderName,
            }: {
                header?: string[];
                endpoint?: string;
                authHeaderName?: string;
            } = {},
        ) => {
            await GraphQLCommands.generate(
                { url, headers },
                "default",
                output,
                {
                    endpoint,
                    authHeaderName,
                },
            );
        },
    );

program
    .command("generate-openapi <url> <output>")
    .alias("generate-oas")
    .option(
        "-h, --header [header]",
        "Header to send with the request, e.g. 'Authorization=Bearer 1234'",
        collect,
        [],
    )
    .option(
        "--endpoint [endpoint]",
        "Endpoint to use in the generated code, defaults to the schema introspection URL",
    )
    .option(
        "--auth-header-name [authHeaderName]",
        "Name of the header to use for authorization. Defaults to first header name, if headers are provided.",
    )
    .description("Generate code from a GraphQL schema")
    .action(
        async (
            url: string,
            output: string,
            {
                header: headers,
                endpoint,
                authHeaderName,
            }: {
                header?: string[];
                endpoint?: string;
                authHeaderName?: string;
            } = {},
        ) => {
            await OpenAPICommands.generate(
                { url, headers },
                "default",
                output,
                {
                    endpoint,
                    authHeaderName,
                },
            );
        },
    );

program.parse(process.argv);
