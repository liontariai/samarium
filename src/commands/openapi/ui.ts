import { introspectOpenAPISchema } from "./util/introspect";
import { Flavors, OpenAPIGenerator } from "@/lib/codegen";

import fs from "fs";
import path from "path";

import chalk from "chalk";
import { printLogo } from "@/lib/cli/logo";
import {
    chalkSyntaxHighlights,
    detectAndConfigureTSConfig,
    requestAuthHeaderFromUser,
    requestFilenameFromUser,
    requestUrlFromUser,
    selectAndCreateDirectory,
} from "@/lib/cli/util";
import type { OpenAPI3 } from "openapi-typescript";

export const ui = async () => {
    printLogo();

    const url = await requestUrlFromUser(
        "Enter the url to the OpenAPI schema json file:",
    );

    let schema: OpenAPI3 | undefined;
    let authHeaderName: string | undefined;

    try {
        schema = await introspectOpenAPISchema(url);
    } catch (e: any) {
        if (e.response?.status === 401 || e.response?.status === 403) {
            const [headerKey, headerValue] = await requestAuthHeaderFromUser();

            try {
                schema = await introspectOpenAPISchema(url, [
                    `${headerKey}=${headerValue}`,
                ]);
                authHeaderName = headerKey;
            } catch (e: any) {
                console.error("Error: ", e.message);
                return;
            }
        } else {
            console.error("Error: ", e.message);
            console.error("Failed to introspect schema");
            return;
        }
    }
    if (!schema) {
        console.error("Failed to introspect schema");
        return;
    }

    const pathArr = await selectAndCreateDirectory(["."]);
    const filename = await requestFilenameFromUser(
        "Enter the output filename:",
    );

    const outpath = path.resolve(...pathArr, filename);

    try {
        const generator = new OpenAPIGenerator.Generator(
            Flavors.OpenAPI.default,
        );
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
        console.error("Failed to generate code");
        return;
    }

    if (!(await detectAndConfigureTSConfig(filename, outpath))) {
        console.log(`
${chalk.green(`Done! Generated file saved at ${outpath}.`)}
${chalk.green("Go ahead and import the generated file in your project:")}

${chalkSyntaxHighlights.import("import")} ${chalkSyntaxHighlights.name(filename.replace(".ts", ""))} ${chalkSyntaxHighlights.from("from")} ${chalkSyntaxHighlights.string(
            `"./${path.relative(process.cwd(), outpath.replace(".ts", ""))}"`,
        )};
        `);
    }

    console.log(" ");
    console.log(
        "Please star the repo if you liked it! https://github.com/liontariai/samarium",
    );
    console.log(" ");
};
