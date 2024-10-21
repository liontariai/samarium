import { introspectOpenAPISchema } from "./util/introspect";

import fs from "fs";

export const introspect = async (
    remote: { url: string; headers?: string[] },
    output: string,
) => {
    const schema = await introspectOpenAPISchema(remote.url, remote.headers);

    fs.writeFileSync(output, JSON.stringify(schema, null, 2));
};
