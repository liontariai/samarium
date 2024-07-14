import { GraphQLSchema, printSchema } from "graphql";
import { introspectGraphQLSchema } from "./util/introspect";
import { Flavors, Generator } from "@/lib/codegen";

import fs from "fs";
import path from "path";
import { confirm, input, select } from "@inquirer/prompts";
import detectIndent from "detect-indent";

import packageJson from "../../package.json";
import chalk from "chalk";

const chalkSyntaxHighlights = {
    import: chalk.rgb(185, 126, 180),
    name: chalk.rgb(156, 220, 254),
    from: chalk.rgb(185, 126, 180),
    string: chalk.rgb(206, 145, 120),
};

export const ui = async () => {
    process.stdout.write("\x1Bc");
    process.stdout.write(`
 _____                                 _                   
/  ___|                               (_)                  
\\ \`--.   __ _  _ __ ___    __ _  _ __  _  _   _  _ __ ___  
 \\\`--. \\ / _\` || '_ \` _ \\  / _\` || '__|| || | | || '_ \` _ \\ 
/\\__/ /| (_| || | | | | || (_| || |   | || |_| || | | | | |
\\____/  \\__,_||_| |_| |_| \\__,_||_|   |_| \\__,_||_| |_| |_|
`);
    console.log(" ");
    console.log(`v${packageJson.version}`);
    console.log(" ");
    console.log("Welcome to the Samarium CLI Assistant");
    console.log(" ");
    console.log(
        "This assistant will help you generate a Samarium client from a GraphQL endpoint and use it in your project.",
    );
    console.log(" ");

    let url = "";

    while (!url) {
        url = await input({
            message: "Enter the graphql endpoint url:",
        });
        try {
            new URL(url);
        } catch (e) {
            console.log("Invalid URL");
            url = "";
        }
    }

    let schema: GraphQLSchema | undefined;
    let authHeaderName: string | undefined;
    try {
        schema = await introspectGraphQLSchema(url);
    } catch (e: any) {
        if (e.response?.status === 401 || e.response?.status === 403) {
            let headerKey = await select({
                message:
                    "The endpoint seems to need authorization, choose the header name, or enter a custom name:",
                default: "Authorization",
                choices: [
                    { name: "Authorization", value: "Authorization" },
                    { name: "X-Authorization", value: "X-Authorization" },
                    { name: "X-Api-Key", value: "X-Api-Key" },
                    { name: "custom", value: "custom" },
                ],
            });
            if (headerKey === "custom") {
                while (!headerKey || headerKey === "custom") {
                    headerKey = await input({
                        message: "Enter the header name:",
                    });
                }
            }

            let headerValue = "";
            while (!headerValue) {
                headerValue = await input({
                    message: "Enter the header value:",
                });
            }

            try {
                schema = await introspectGraphQLSchema(url, [
                    `${headerKey}=${headerValue}`,
                ]);
                authHeaderName = headerKey;
            } catch (e: any) {
                console.error("Error: ", e.message);
                return;
            }
        } else {
            console.log("Error: ", e.message);
            console.log("Failed to introspect schema");
            return;
        }
    }
    if (!schema) {
        console.log("Failed to introspect schema");
        return;
    }

    const pathArr: string[] = ["."];
    while (true) {
        const dirs = fs.readdirSync(pathArr.join("/"), {
            withFileTypes: true,
        });

        const nextDir = await select({
            message: `Navigate to the output directory: ${pathArr.join("/")}`,
            default: ".",
            choices: [
                {
                    name: "[create new directory]",
                    value: "[new_dir]",
                    description: "Current directory",
                },
                { name: ".", value: ".", description: "Current directory" },
                {
                    name: "..",
                    value: "..",
                    description: "Parent directory",
                },
                ...dirs
                    .filter((dir) => dir.isDirectory())
                    .map((dir) => ({
                        name: dir.name,
                        value: dir.name,
                    })),
            ],
        });
        pathArr.push(nextDir);

        if (nextDir === "[new_dir]") {
            pathArr.pop();

            const newDir = await input({
                message: "Enter the new directory name:",
            });
            fs.mkdirSync(path.resolve(...pathArr, newDir));
            pathArr.push(newDir);
            break;
        }

        if (nextDir === ".") {
            break;
        }
        if (nextDir === "..") {
            pathArr.pop();
            pathArr.pop();
            continue;
        }
    }

    let filename = await input({
        message: "Enter the output filename:",
        default: "api.ts",
    });
    if (!filename.endsWith(".ts")) {
        filename += ".ts";
    }

    const outpath = path.resolve(...pathArr, filename);

    try {
        const generator = new Generator(Flavors.default);
        const code = await generator.generate({
            schema,
            options: {},
            authConfig: authHeaderName
                ? { headerName: authHeaderName }
                : undefined,
        });

        fs.writeFileSync(outpath, code.replace("[ENDPOINT]", url));
    } catch (e: any) {
        console.error("Error: ", e.message);
        console.log("Failed to generate code");
        return;
    }

    if (
        fs.existsSync("tsconfig.json") &&
        (await confirm({
            message: `
File 'tsconfig.json' detected. Do you want to add an import alias for the generated file?`,
        }))
    ) {
        console.log(" ");

        const alias = await input({
            message: "Enter the alias name:",
            default: filename.replace(".ts", ""),
        });

        let jsonstr = fs.readFileSync("tsconfig.json", "utf-8");
        // remove comments
        jsonstr = jsonstr.replace(/\/\/.*/g, "");

        const indent = detectIndent(jsonstr).indent || "  ";

        const json = JSON.parse(jsonstr);
        const baseUrl = json.compilerOptions?.baseUrl || ".";
        const relativePath = path.relative(
            path.resolve(process.cwd(), baseUrl),
            outpath,
        );

        if (!json.compilerOptions) {
            json.compilerOptions = {};
        }
        if (!json.compilerOptions.paths) {
            json.compilerOptions.paths = {};
        }

        json.compilerOptions.paths[alias] = [relativePath];
        fs.writeFileSync("tsconfig.json", JSON.stringify(json, null, indent));

        console.log(`
${chalk.green("Done! Alias added to 'tsconfig.json'.")}
${chalk.green("Go ahead and import the generated file in your project:")}

${chalkSyntaxHighlights.import("import")} ${chalkSyntaxHighlights.name(alias)} ${chalkSyntaxHighlights.from("from")} ${chalkSyntaxHighlights.string(`"${alias}"`)};
        `);
    } else {
        console.log(`
${chalk.green(`Done! Generated file saved at ${outpath}.`)}
${chalk.green("Go ahead and import the generated file in your project:")}

${chalkSyntaxHighlights.import("import")} ${chalkSyntaxHighlights.name(filename.replace(".ts", ""))} ${chalkSyntaxHighlights.from("from")} ${chalkSyntaxHighlights.string(
            `"./${path.relative(process.cwd(), outpath.replace(".ts", ""))}"`,
        )};
        `);
    }
};
