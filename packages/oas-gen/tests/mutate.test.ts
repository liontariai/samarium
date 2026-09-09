import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generate, mutate, validate } from "../src/index.ts";
import { documentToJson } from "../src/ser/index.ts";

const CORPUS = join(import.meta.dir, "../vendor/corpus");

describe("mutate", () => {
    it("safe mutations of core-rest stay valid", async () => {
        for (const dialect of ["3.0", "3.1"] as const) {
            for (let seed = 0; seed < 25; seed++) {
                const base = generate({ seed, dialect, profile: "core-rest" });
                const next = mutate(base, { seed: seed + 1000, n: 3 });
                expect(next.meta.mutations.length).toBeGreaterThan(0);
                const v = await validate(documentToJson(next.ir), dialect);
                if (!v.acceptedAsValidFixture) {
                    console.error(seed, dialect, next.meta.mutations, v.semantic.errors[0], v.officialSchema.errors[0]);
                }
                expect(v.acceptedAsValidFixture).toBe(true);
            }
        }
    });

    it("allowInvalid can break the gauntlet", async () => {
        const base = generate({ seed: 4, dialect: "3.0", profile: "core-rest" });
        let broke = false;
        for (let seed = 0; seed < 30; seed++) {
            const next = mutate(base, { seed, n: 4, allowInvalid: true });
            const v = await validate(documentToJson(next.ir), "3.0");
            if (!v.acceptedAsValidFixture) {
                broke = true;
                break;
            }
        }
        expect(broke).toBe(true);
    });

    it("corpus specs mutate and stay valid by default", async () => {
        const files = readdirSync(CORPUS).filter((f) => f.endsWith(".yaml"));
        expect(files.length).toBeGreaterThan(5);
        for (const file of files) {
            const text = readFileSync(join(CORPUS, file), "utf8");
            const next = mutate(text, { seed: 7, n: 2 });
            const dialect = file.includes("3.1") ? "3.1" : "3.0";
            const v = await validate(documentToJson(next.ir), dialect);
            if (!v.acceptedAsValidFixture) {
                console.error(file, next.meta.mutations, v.semantic.errors[0], v.officialSchema.errors[0]);
            }
            expect(v.acceptedAsValidFixture).toBe(true);
        }
    });
});
