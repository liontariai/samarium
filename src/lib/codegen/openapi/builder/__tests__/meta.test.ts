import fs from "fs";
import { expect, describe, it } from "bun:test";
import { gatherMeta, gatherMetaForType } from "../meta";
import type { OpenAPI3 } from "openapi-typescript";

import testapiJson from "./examples/testapi.json";
import thingsboardJson from "./examples/thingsboard.json";

import { Collector } from "../collector";
import { inspect } from "util"; // or directly
import prettier from "prettier";

describe.only("gatherMetaForType", () => {
    it("should gather meta for object types", async () => {
        const schema = thingsboardJson as unknown as OpenAPI3;

        const collector = new Collector();
        const schemaMeta = gatherMeta(schema, {}, collector);

        // fs.writeFileSync(
        //     "./schemaMeta.ts",
        //     await prettier.format(
        //         `export default ${inspect(schemaMeta, { depth: 10 })
        //             .replace(/\.\.\. .* more items/gm, "")
        //             .replace(/<ref .*>/g, "")
        //             .replace(/\[Circular .*\]/g, '"Circular"')
        //             .replace(/\n/g, "")}`,
        //         {
        //             parser: "typescript",
        //             tabWidth: 4,
        //         },
        //     ),
        // );
    });
});
