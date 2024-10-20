import fs from "fs";
import path from "path";
import { printLogo } from "./logo";
import { confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import detectIndent from "detect-indent";

export const detectAndReplacePlaceholders = async (
    str: string,
    descriptor: string,
    showLogo: boolean = false,
) => {
    // detect placeholders in the str, e.g. /slug/<name>/other or /slug/[name]/other
    const regex = /<([^>]+)>|\[([^\]]+)\]/g;
    let match;
    const placeholders = [];
    while ((match = regex.exec(str))) {
        placeholders.push(match[1] ?? match[2]);
    }
    if (placeholders.length > 0) {
        if (!showLogo) {
            printLogo();
            showLogo = false;
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

export const requestUrlFromUser = async (message: string) => {
    let url = "";

    while (!url) {
        url = await input({
            message,
        });
        try {
            new URL(url);
        } catch (e) {
            console.log("Invalid URL");
            url = "";
        }
    }

    return url;
};

export const requestAuthHeaderFromUser = async () => {
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

    return [headerKey, headerValue];
};

export const selectAndCreateDirectory = async (pathArr: string[] = ["."]) => {
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

    return pathArr;
};

export const requestFilenameFromUser = async (message: string) => {
    let filename = await input({
        message,
        default: "sdk.ts",
    });
    if (!filename.endsWith(".ts")) {
        filename += ".ts";
    }
    return filename;
};

export const chalkSyntaxHighlights = {
    import: chalk.rgb(185, 126, 180),
    name: chalk.rgb(156, 220, 254),
    from: chalk.rgb(185, 126, 180),
    string: chalk.rgb(206, 145, 120),
};

export const detectAndConfigureTSConfig = async (
    filename: string,
    outpath: string,
) => {
    let tsConfigAdded = false;
    if (
        fs.existsSync("tsconfig.json") &&
        (await confirm({
            message: `
File 'tsconfig.json' detected. Do you want to add an import alias for the generated file?`,
            default: false,
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
        tsConfigAdded = true;
    }

    return tsConfigAdded;
};
