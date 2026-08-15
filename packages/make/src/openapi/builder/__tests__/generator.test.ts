import fs from "fs";
import { describe, it } from "bun:test";
import type { OpenAPI3 } from "openapi-typescript";

import thingsboardJson from "../../flavors/default/__tests__/schemas/thingsboard.json";
import testapiJson from "../../flavors/default/__tests__/schemas/testapi.json";
import spotifyJson from "../../flavors/default/__tests__/schemas/spotify.json";
import reelgoodJson from "../../flavors/default/__tests__/schemas/reelgood.json";

import { GeneratorSelectionTypeFlavorDefault } from "../../flavors/default/generator-flavor";
import { Generator } from "../generator";

describe.skip("generate", () => {
    it("should generate code", async () => {
        const schema = reelgoodJson as unknown as OpenAPI3;

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
