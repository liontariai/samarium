import fs from "fs";
import { describe, it } from "bun:test";
import type { OpenAPI3 } from "openapi-typescript";

import thingsboardJson from "@tests/openapi/schemas/thingsboard.json";
import testapiJson from "@tests/openapi/schemas/testapi.json";
import spotifyJson from "@tests/openapi/schemas/spotify.json";
import reelgoodJson from "@tests/openapi/schemas/reelgood.json";

import { GeneratorSelectionTypeFlavorDefault } from "@/openapi/flavors/default/generator-flavor";
import { Generator } from "@/openapi/builder/generator";

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
