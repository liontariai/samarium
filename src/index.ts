import packageJson from "../package.json";

import { Command } from "commander";
import { introspect } from "./commands/introspect";
import { generate } from "./commands/generate";
import { ui } from "./commands/ui";

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
        await ui().catch((error) => {});
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
    .description("Introspect a GraphQL schema")
    .action(
        async (
            url: string,
            output: string,
            { header: headers }: { header?: string[] } = {},
        ) => {
            await introspect({ url, headers }, output);
        },
    );

program
    .command("generate <url> <output>")
    .alias("g")
    .option(
        "-h, --header [header]",
        "Header to send with the request, e.g. 'Authorization=Bearer 1234'",
        collect,
        [],
    )
    .description("Generate code from a GraphQL schema")
    .action(
        async (
            url: string,
            output: string,
            { header: headers }: { header?: string[] } = {},
        ) => {
            await generate({ url, headers }, "default", output);
        },
    );

program.parse(process.argv);
