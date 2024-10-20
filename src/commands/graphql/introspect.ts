import { printSchema } from "graphql";
import { introspectGraphQLSchema } from "./util/introspect";

import fs from "fs";

export const introspect = async (
    remote: { url: string; headers?: string[] },
    output: string,
) => {
    const schema = await introspectGraphQLSchema(remote.url, remote.headers);
    const sdl = printSchema(schema);

    fs.writeFileSync(output, sdl);
};
