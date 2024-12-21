import fs from "fs";
import { describe, it } from "bun:test";

import { GeneratorSelectionTypeFlavorDefault } from "../../flavors/default/generator-flavor";
import { Generator } from "../generator";
import { introspectGraphQLSchema } from "./util";

describe.only("generate", () => {
    // it("should generate code", async () => {
    //     const schema = await introspectGraphQLSchema(
    //         "http://localhost:4000/graphql",
    //     );
    //     const generator = new Generator(GeneratorSelectionTypeFlavorDefault);
    //     const code = await generator.generate({
    //         schema,
    //         options: {},
    //     });
    //     fs.writeFileSync("./code.ts", code);
    // });
});
