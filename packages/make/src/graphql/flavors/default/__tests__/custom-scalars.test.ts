import { describe, expect, it } from "bun:test";
import path from "node:path";
import { collectCriticalTypeErrors } from "@/openapi/flavors/default/__tests__/utils/typecheck";
import * as examplesCustomScalars from "./examples/custom-scalars.generated";

describe("GraphQL custom scalars (ScalarTypeMapWithCustom)", () => {
    it("generates an overridable JToken alias without pinning any on the interface", () => {
        expect(typeof examplesCustomScalars._makeRootOperationInput).toBe("function");
        expect(collectCriticalTypeErrors(path.join(import.meta.dir, "examples/custom-scalars.generated.ts"))).toEqual(
            [],
        );
    });

    it("lets a user JToken augmentation override the any default", () => {
        expect(collectCriticalTypeErrors(path.join(import.meta.dir, "scalar-override.check.ts"))).toEqual([]);
    });
});
