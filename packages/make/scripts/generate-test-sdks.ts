/**
 * Generate GraphQL + OpenAPI test SDK fixtures with `runtime: "external"` so
 * they import the shared wrapper module (traps / class identity work in tests).
 *
 * Usage:
 *   bun scripts/generate-test-sdks.ts
 *   bun scripts/generate-test-sdks.ts --only=books
 *   bun scripts/generate-test-sdks.ts --flavor=openapi
 *   bun scripts/generate-test-sdks.ts --check
 *   bun scripts/generate-test-sdks.ts --refresh-spacex  # re-introspect SpaceX schema
 */
import {
    buildClientSchema,
    buildSchema,
    getIntrospectionQuery,
    printSchema,
    type GraphQLSchema,
    type IntrospectionQuery,
} from "graphql";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import type { OpenAPI3 } from "openapi-typescript";
import { Generator as GraphqlGenerator } from "../src/graphql/builder/generator";
import { GeneratorSelectionTypeFlavorDefault as GraphqlFlavor } from "../src/graphql/flavors/default/generator-flavor";
import { Generator as OpenapiGenerator } from "../src/openapi/builder/generator";
import { GeneratorSelectionTypeFlavorDefault as OpenapiFlavor } from "../src/openapi/flavors/default/generator-flavor";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAKE_ROOT = path.resolve(__dirname, "..");
const GRAPHQL_TESTS_ROOT = path.join(MAKE_ROOT, "src/graphql/flavors/default/__tests__");
const OPENAPI_TESTS_ROOT = path.join(MAKE_ROOT, "src/openapi/flavors/default/__tests__");

type Flavor = "graphql" | "openapi";

type GraphqlFixture = {
    flavor: "graphql";
    id: string;
    /** Relative to GraphQL __tests__/ */
    schemaPath: string;
    /** Relative to GraphQL __tests__/ */
    outPath: string;
    authHeaderName?: string;
    /**
     * If set, schema can be refreshed from live introspection
     * (`--refresh-spacex` or `--refresh-all-remote`).
     */
    introspectionUrl?: string;
};

type OpenapiFixture = {
    flavor: "openapi";
    id: string;
    /** Relative to OpenAPI __tests__/ */
    schemaPath: string;
    /** Relative to OpenAPI __tests__/ */
    outPath: string;
    authHeaderName?: string;
    /** Skip Prettier — used for huge real-world specs. */
    skipFormat?: boolean;
};

type Fixture = GraphqlFixture | OpenapiFixture;

/** Catalog of fixtures to generate for GraphQL flavor tests. */
export const graphqlTestFixtures: GraphqlFixture[] = [
    {
        flavor: "graphql",
        id: "books",
        schemaPath: "schemas/books.graphql",
        outPath: "examples/books.generated.ts",
    },
    {
        flavor: "graphql",
        id: "dates",
        schemaPath: "schemas/dates.graphql",
        outPath: "examples/dates.generated.ts",
    },
    {
        flavor: "graphql",
        id: "unions",
        schemaPath: "schemas/unions.graphql",
        outPath: "examples/unions.generated.ts",
    },
    {
        flavor: "graphql",
        id: "directives",
        schemaPath: "schemas/directives.graphql",
        outPath: "examples/directives.generated.ts",
    },
    {
        flavor: "graphql",
        id: "contentful",
        schemaPath: "schemas/contentful.graphql",
        outPath: "examples/contentful.generated.ts",
        authHeaderName: "Authorization",
    },
    {
        flavor: "graphql",
        id: "spacex",
        schemaPath: "schemas/spacex.graphql",
        outPath: "examples/spacex.generated.ts",
        introspectionUrl: "https://spacex-production.up.railway.app/graphql",
    },
];

/** Catalog of fixtures to generate for OpenAPI flavor tests. */
export const openapiTestFixtures: OpenapiFixture[] = [
    {
        flavor: "openapi",
        id: "books",
        schemaPath: "schemas/books.json",
        outPath: "examples/books.generated.ts",
    },
    {
        flavor: "openapi",
        id: "dates",
        schemaPath: "schemas/dates.json",
        outPath: "examples/dates.generated.ts",
    },
    {
        flavor: "openapi",
        id: "unions",
        schemaPath: "schemas/unions.json",
        outPath: "examples/unions.generated.ts",
    },
    {
        flavor: "openapi",
        id: "auth",
        schemaPath: "schemas/auth.json",
        outPath: "examples/auth.generated.ts",
        authHeaderName: "Authorization",
    },
    {
        flavor: "openapi",
        id: "events",
        schemaPath: "schemas/events.json",
        outPath: "examples/events.generated.ts",
    },
    {
        flavor: "openapi",
        id: "testapi",
        schemaPath: "schemas/testapi.json",
        outPath: "examples/testapi.generated.ts",
    },
    {
        flavor: "openapi",
        id: "reelgood",
        schemaPath: "schemas/reelgood.json",
        outPath: "examples/reelgood.generated.ts",
        authHeaderName: "x-api-key",
    },
    {
        flavor: "openapi",
        id: "spotify",
        schemaPath: "schemas/spotify.json",
        outPath: "examples/spotify.generated.ts",
        authHeaderName: "Authorization",
        skipFormat: true,
    },
    {
        flavor: "openapi",
        id: "thingsboard",
        schemaPath: "schemas/thingsboard.json",
        outPath: "examples/thingsboard.generated.ts",
        authHeaderName: "X-Authorization",
        skipFormat: true,
    },
];

const GRAPHQL_WRAPPER_MODULE = "@/graphql/flavors/default/wrapper";
const OPENAPI_WRAPPER_MODULE = "@/openapi/flavors/default/wrapper";

const HEADER = `// @generated by packages/make/scripts/generate-test-sdks.ts — do not edit by hand
// runtime: external (imports SelectionWrapper / RootOperation from shared wrapper module)
`;

function testsRootFor(fixture: Fixture): string {
    return fixture.flavor === "graphql" ? GRAPHQL_TESTS_ROOT : OPENAPI_TESTS_ROOT;
}

async function introspectToSdl(url: string): Promise<string> {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: getIntrospectionQuery() }),
    });
    if (!res.ok) {
        throw new Error(`Introspection failed ${url}: HTTP ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as {
        data?: IntrospectionQuery;
        errors?: unknown;
    };
    if (json.errors || !json.data) {
        throw new Error(
            `Introspection failed ${url}: ${JSON.stringify(json.errors ?? "no data")}`,
        );
    }
    const schema = buildClientSchema(json.data);
    return printSchema(schema);
}

async function loadGraphqlSchema(fixture: GraphqlFixture): Promise<GraphQLSchema> {
    const schemaAbs = path.join(GRAPHQL_TESTS_ROOT, fixture.schemaPath);
    const sdl = await readFile(schemaAbs, "utf8");
    return buildSchema(sdl);
}

async function loadOpenapiSchema(fixture: OpenapiFixture): Promise<OpenAPI3> {
    const schemaAbs = path.join(OPENAPI_TESTS_ROOT, fixture.schemaPath);
    const raw = await readFile(schemaAbs, "utf8");
    return JSON.parse(raw) as OpenAPI3;
}

async function generateGraphqlFixture(fixture: GraphqlFixture): Promise<string> {
    const schema = await loadGraphqlSchema(fixture);

    const generator = new GraphqlGenerator(GraphqlFlavor);
    const code = await generator.generate({
        schema,
        options: {},
        authConfig: fixture.authHeaderName ? { headerName: fixture.authHeaderName } : undefined,
        runtime: "external",
        externalRuntime: {
            wrapperModule: GRAPHQL_WRAPPER_MODULE,
        },
    });

    const raw = `${HEADER}// fixture: ${fixture.id}\n${code}\n`;
    return formatTypescript(raw, path.join(GRAPHQL_TESTS_ROOT, fixture.outPath));
}

async function generateOpenapiFixture(fixture: OpenapiFixture): Promise<string> {
    const schema = await loadOpenapiSchema(fixture);

    const generator = new OpenapiGenerator(OpenapiFlavor);
    const code = await generator.generate({
        schema,
        options: {},
        authConfig: fixture.authHeaderName ? { headerName: fixture.authHeaderName } : undefined,
        runtime: "external",
        externalRuntime: {
            wrapperModule: OPENAPI_WRAPPER_MODULE,
        },
    });

    const raw = `${HEADER}// fixture: ${fixture.id}\n${code}\n`;
    const outAbs = path.join(OPENAPI_TESTS_ROOT, fixture.outPath);
    return fixture.skipFormat ? raw : formatTypescript(raw, outAbs);
}

async function generateFixture(fixture: Fixture): Promise<string> {
    return fixture.flavor === "graphql"
        ? generateGraphqlFixture(fixture)
        : generateOpenapiFixture(fixture);
}

async function formatTypescript(code: string, filepath: string): Promise<string> {
    const config = (await prettier.resolveConfig(filepath)) ?? {};
    return prettier.format(code, {
        ...config,
        filepath,
        parser: "typescript",
    });
}

async function refreshRemoteSchemas(fixtures: Fixture[]) {
    for (const fixture of fixtures) {
        if (fixture.flavor !== "graphql" || !fixture.introspectionUrl) continue;
        console.log(`[introspect] ${fixture.id} ← ${fixture.introspectionUrl}`);
        const sdl = await introspectToSdl(fixture.introspectionUrl);
        const schemaAbs = path.join(GRAPHQL_TESTS_ROOT, fixture.schemaPath);
        await mkdir(path.dirname(schemaAbs), { recursive: true });
        const body =
            `# Introspected from ${fixture.introspectionUrl}\n` +
            `# Refreshed by generate-test-sdks.ts — commit when intentionally updating\n\n` +
            sdl;
        await writeFile(schemaAbs, body, "utf8");
        console.log(`[wrote] graphql/${fixture.schemaPath}`);
    }
}

function fixtureLabel(fixture: Fixture): string {
    return `${fixture.flavor}/${fixture.outPath}`;
}

async function main() {
    const args = process.argv.slice(2);
    const check = args.includes("--check");
    const refreshAllRemote = args.includes("--refresh-all-remote");
    const refreshSpacex = args.includes("--refresh-spacex");
    const onlyArg = args.find((a) => a.startsWith("--only="));
    const only = onlyArg?.slice("--only=".length);
    const flavorArg = args.find((a) => a.startsWith("--flavor="));
    const flavor = flavorArg?.slice("--flavor=".length) as Flavor | undefined;

    if (flavor && flavor !== "graphql" && flavor !== "openapi") {
        console.error(`Unknown --flavor=${flavor}. Use graphql or openapi.`);
        process.exit(1);
    }

    const catalog: Fixture[] = [
        ...(flavor !== "openapi" ? graphqlTestFixtures : []),
        ...(flavor !== "graphql" ? openapiTestFixtures : []),
    ];

    let fixtures = only ? catalog.filter((f) => f.id === only) : catalog;

    if (fixtures.length === 0) {
        console.error(
            `No fixtures matched${only ? ` --only=${only}` : ""}${flavor ? ` --flavor=${flavor}` : ""}`,
        );
        process.exit(1);
    }

    if (refreshSpacex || refreshAllRemote) {
        const remote = refreshAllRemote
            ? fixtures.filter((f) => f.flavor === "graphql" && f.introspectionUrl)
            : fixtures.filter((f) => f.flavor === "graphql" && f.id === "spacex" && f.introspectionUrl);
        await refreshRemoteSchemas(remote);
    }

    let dirty = false;

    for (const fixture of fixtures) {
        const outAbs = path.join(testsRootFor(fixture), fixture.outPath);
        const next = await generateFixture(fixture);

        if (check) {
            let prev = "";
            try {
                prev = await readFile(outAbs, "utf8");
            } catch {
                prev = "";
            }
            if (prev !== next) {
                console.error(`[dirty] ${fixtureLabel(fixture)}`);
                dirty = true;
            } else {
                console.log(`[ok] ${fixtureLabel(fixture)}`);
            }
        } else {
            await mkdir(path.dirname(outAbs), { recursive: true });
            await writeFile(outAbs, next, "utf8");
            console.log(`[wrote] ${fixtureLabel(fixture)}`);
        }
    }

    if (check && dirty) {
        console.error("\nTest SDKs are out of date. Run: bun scripts/generate-test-sdks.ts");
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
