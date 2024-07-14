import { Generator, Flavors } from "../lib/codegen";
import { introspectGraphQLSchema } from "./util/introspect";

import fs from "fs";

export const generate = async (
    remote: { url: string; headers?: string[] },
    flavor: keyof typeof Flavors,
    output: string,
) => {
    const schema = await introspectGraphQLSchema(remote.url, remote.headers);
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

    fs.writeFileSync(output, code.replace("[ENDPOINT]", remote.url));
};
