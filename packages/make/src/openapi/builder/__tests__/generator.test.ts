import fs from "fs";
import { describe, it } from "bun:test";
import type { OpenAPI3 } from "openapi-typescript";

import thingsboardJson from "./examples/thingsboard.json";
import testapiJson from "./examples/testapi.json";

import { GeneratorSelectionTypeFlavorDefault } from "../../flavors/default/generator-flavor";
import { Generator } from "../generator";

describe.only("generate", () => {
    it("should generate code", async () => {
        const schema = thingsboardJson as unknown as OpenAPI3;

        const generator = new Generator(GeneratorSelectionTypeFlavorDefault);
        const code = await generator.generate({
            schema,
            options: {},
            authConfig: {
                headerName: "Authorization",
            },
        });

        // fs.writeFileSync("./code.ts", code);
    });
});
