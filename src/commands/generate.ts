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
    });

    fs.writeFileSync(output, code.replace("[ENDPOINT]", remote.url));
};
