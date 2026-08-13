import { afterEach, beforeAll, describe, expect, it, jest } from "bun:test";
import {
    OPTIONS,
    ROOT_OP_COLLECTOR,
    RootOperation,
    SelectionWrapper,
} from "@/graphql/flavors/default/wrapper";
import { rootSLWFactory } from "./utils";
import * as examplesBooksSimple from "@/graphql/flavors/default/__tests__/examples/books.generated";
import * as examplesSpaceX from "@/graphql/flavors/default/__tests__/examples/spacex.generated";
import * as examplesUnions from "@/graphql/flavors/default/__tests__/examples/unions.generated";
import * as examplesDirectives from "@/graphql/flavors/default/__tests__/examples/directives.generated";
import * as examplesDates from "@/graphql/flavors/default/__tests__/examples/dates.generated";
import * as examplesContentful from "@/graphql/flavors/default/__tests__/examples/contentful.generated";

type GraphqlCall = {
    query: string;
    variables?: Record<string, unknown>;
    headers?: Record<string, string>;
};

function installMockFetch(data: unknown = { mockData: "test" }) {
    const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ data }),
    });
    RootOperation[OPTIONS].fetcher = mockFetch as any;
    return mockFetch;
}
function expectGraphqlPost(mockFetch: ReturnType<typeof jest.fn>, call: GraphqlCall, nth?: number) {
    const expected = ["[ENDPOINT]", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...RootOperation[OPTIONS].headers,
            ...call.headers,
        },
        body: JSON.stringify({
            query: call.query,
            variables: call.variables ?? {},
        }),
    }] as const;
    if (nth != null) {
        expect(mockFetch).toHaveBeenNthCalledWith(nth, ...expected);
    } else {
        expect(mockFetch).toHaveBeenCalledWith(...expected);
    }
}

function executeRoot(slw: { [ROOT_OP_COLLECTOR]?: { ref: { op?: { execute: () => Promise<any> }; execute: () => Promise<any> } } }) {
    return slw[ROOT_OP_COLLECTOR]!.ref.op!.execute();
}

async function executeRootAndExpectGraphql(
    slw: Parameters<typeof executeRoot>[0],
    mockFetch: ReturnType<typeof jest.fn>,
    calls: GraphqlCall[],
) {
    const result = await executeRoot(slw);
    expect(mockFetch).toHaveBeenCalledTimes(calls.length);
    calls.forEach((call, i) => expectGraphqlPost(mockFetch, call, i + 1));
    return result;
}

/** Re-run the collector so SLW proxies read deserialized scalar data. */
function hydrateSlw<T>(slw: T & { [ROOT_OP_COLLECTOR]?: { ref: { execute: () => Promise<any> } } }) {
    return new Promise<T>((resolve) => {
        slw[ROOT_OP_COLLECTOR]!.ref.execute().then(() => resolve(slw));
    });
}

function resetSdkOptions() {
    RootOperation[OPTIONS].fetcher = undefined as any;
    RootOperation[OPTIONS]._auth_fn = undefined;
    RootOperation[OPTIONS]._auth_token = undefined;
    RootOperation[OPTIONS].headers = {};
}

describe("Testing and validating features", () => {
    beforeAll(() => {
        RootOperation.authHeaderName = "Authorization";
    });

    afterEach(() => {
        resetSdkOptions();
    });

    it("executes multiple operations and returns results", async () => {
        const slw = rootSLWFactory(examplesBooksSimple._makeRootOperationInput, (op) => ({
            operation1: op.Query((q) => ({
                bookTitles: q.books(({ title }) => ({
                    title,
                })),
            })),
            operation2: op.Query((q) => ({
                bookAuthors: q.books(({ author }) => ({
                    author,
                })),
            })),
            mutation1: op.Mutation((m) => ({
                created: m.createBooks({
                    titles: ["book1", "book2"],
                    authors: ["author1", "author2"],
                })(({ title }) => ({
                    title,
                })),
            })),
        }));
        const mockFetch = installMockFetch();

        expect(slw[ROOT_OP_COLLECTOR]).toBeDefined();
        expect(slw[ROOT_OP_COLLECTOR]!.ref.op).toBeDefined();

        // Each operation is its own fetch (query and mutation cannot be mixed)
        const result = await executeRootAndExpectGraphql(slw, mockFetch, [
            { query: `query operation1 { bookTitles: books { title } }` },
            { query: `query operation2 { bookAuthors: books { author } }` },
            {
                query: `mutation mutation1 ($titles: [String]!, $authors: [String]!) { created: createBooks(titles: $titles, authors: $authors) { title } }`,
                variables: {
                    titles: ["book1", "book2"],
                    authors: ["author1", "author2"],
                },
            },
        ]);

        expect(result).toEqual({
            operation1: { mockData: "test" },
            operation2: { mockData: "test" },
            mutation1: { mockData: "test" },
        });
    });

    it("works with aliases", async () => {
        const slw = rootSLWFactory(examplesBooksSimple._makeRootOperationInput, (op) => ({
            operation1: op.Query((q) => ({
                bookTitles: q.books(({ title }) => ({
                    nameOfBook: title,
                })),
            })),
        }));
        const mockFetch = installMockFetch({
            bookTitles: [{ nameOfBook: "title1" }],
        });

        const result = await executeRootAndExpectGraphql(slw, mockFetch, [
            { query: `query operation1 { bookTitles: books { nameOfBook: title } }` },
        ]);

        expect(result).toEqual({
            operation1: {
                bookTitles: [{ nameOfBook: "title1" }],
            },
        });
    });

    it("selects all scalars by using the $scalars() helper", async () => {
        const slw = rootSLWFactory(examplesUnions._makeRootOperationInput, (op) => ({
            operation1: op.Query((q) => ({
                bookTitles: q.books(({ $scalars }) => ({
                    ...$scalars(),
                })),
            })),
        }));
        const mockFetch = installMockFetch();

        const result = await executeRootAndExpectGraphql(slw, mockFetch, [
            { query: `query operation1 { bookTitles: books { title author } }` },
        ]);

        expect(result).toEqual({
            operation1: { mockData: "test" },
        });
    });

    it("works with inline (implicit) fragments", async () => {
        function titleOnly(this: any) {
            return examplesBooksSimple.BookArraySelection.bind(this)((s) => ({
                titleFromFragment: s.title,
            }));
        }

        const slw = rootSLWFactory(examplesBooksSimple._makeRootOperationInput, (op) => ({
            operation1: op.Query((q) => ({
                bookTitles: q.books(({ title }) => ({
                    ...titleOnly(),
                })),
            })),
        }));
        const mockFetch = installMockFetch();

        const result = await executeRootAndExpectGraphql(slw, mockFetch, [
            { query: `query operation1 { bookTitles: books { titleFromFragment: title } }` },
        ]);

        expect(result).toEqual({
            operation1: { mockData: "test" },
        });
    });

    it("adds fragments to the operation text before the operation selection", async () => {
        function launchFragment(this: any) {
            return examplesSpaceX.LaunchSelection.bind(this)(({ id }) => ({
                id,
            }));
        }

        const slw = rootSLWFactory(examplesSpaceX._makeRootOperationInput, (op) => ({
            operation1: op.Query((q) => ({
                withFragment: q.launches({
                    limit: 10,
                })(({ $fragment }) => ({
                    ...$fragment(launchFragment)(),
                })),
            })),
        }));
        const mockFetch = installMockFetch();

        const result = await executeRootAndExpectGraphql(slw, mockFetch, [
            {
                query: `fragment launchFragment_ on Launch { id }\n query operation1 ($limit: Int) { withFragment: launches(limit: $limit) { ...launchFragment_ } }`,
                variables: { limit: 10 },
            },
        ]);

        expect(result).toEqual({
            operation1: { mockData: "test" },
        });
    });

    it("handles arguments that are being used in fragments (parameterized fragments)", async () => {
        function launchQueryFragment(this: any, limit: number) {
            return examplesSpaceX.QuerySelection.bind(this)(({ launches }) => ({
                firstNLaunches: launches({ limit })(({ id }) => ({
                    id,
                })),
            }));
        }

        const slw = rootSLWFactory(examplesSpaceX._makeRootOperationInput, (op) => ({
            operation1: op.Query(({ $fragment }) => ({
                ...$fragment(launchQueryFragment)(10),
            })),
        }));
        const mockFetch = installMockFetch();

        const result = await executeRootAndExpectGraphql(slw, mockFetch, [
            {
                query: `fragment launchQueryFragment_limit on Query { firstNLaunches: launches(limit: $limit) { id } }\n query operation1 ($limit: Int) { ...launchQueryFragment_limit }`,
                variables: { limit: 10 },
            },
        ]);

        expect(result).toEqual({
            operation1: { mockData: "test" },
        });
    });

    it("handles multiple uses of the same fragment with different arguments (parameterized fragments)", async () => {
        function titleOnly(this: any, language?: string) {
            return examplesUnions.ArticleSelection.bind(this)((s) => ({
                titleFromFragment: s.title,
                books: s.books({
                    language,
                })((s) => ({
                    ...s.$scalars(),
                })),
            }));
        }

        const slw = rootSLWFactory(examplesUnions._makeRootOperationInput, (op) => ({
            operation1: op.Query((s) => ({
                b: s.books((s) => ({
                    title: s.title,
                })),
                a_DE: s.articles((s) => ({
                    ...s.$fragment(titleOnly)("de"),
                })),
                a_EN: s.articles((s) => ({
                    ...s.$fragment(titleOnly)("en"),
                })),
            })),
        }));
        const mockFetch = installMockFetch();

        const result = await executeRootAndExpectGraphql(slw, mockFetch, [
            {
                query: `fragment titleOnly_language on Article { titleFromFragment: title books: books(language: $language) { title author } }\nfragment titleOnly_language_1 on Article { titleFromFragment: title books: books(language: $language_1) { title author } }\n query operation1 ($language: String, $language_1: String) { b: books { title } a_DE: articles { ...titleOnly_language } a_EN: articles { ...titleOnly_language_1 } }`,
                variables: {
                    language: "de",
                    language_1: "en",
                },
            },
        ]);

        expect(result).toEqual({
            operation1: { mockData: "test" },
        });
    });

    it("works with inline ...on fragments for union types", async () => {
        const slw = rootSLWFactory(examplesUnions._makeRootOperationInput, (op) => ({
            operation1: op.Query((q) => ({
                all: q.search({ title: "test" })(({ $on }) => ({
                    ...$on.Book((s) => ({
                        ...s.$scalars(),
                    })),
                    ...$on.Article((s) => ({
                        ...s.$scalars(),
                    })),
                })),
            })),
        }));
        const mockFetch = installMockFetch();

        const result = await executeRootAndExpectGraphql(slw, mockFetch, [
            {
                query: `query operation1 ($title: String) { all: search(title: $title) { ... on Book { title author } ... on Article { title publisher } } }`,
                variables: { title: "test" },
            },
        ]);

        expect(result).toEqual({
            operation1: { mockData: "test" },
        });
    });

    it("supports directives", async () => {
        const tag = examplesDirectives.$directives.tag;
        const slw = rootSLWFactory(examplesDirectives._makeRootOperationInput, (op) => ({
            operation1: op.Query((q) => ({
                bookTitles: q.books(({ title }) => ({
                    title: tag({
                        tag: "Fragment!!",
                    })(title),
                })),
            })),
        }));
        const mockFetch = installMockFetch();

        const result = await executeRootAndExpectGraphql(slw, mockFetch, [
            {
                query: `query operation1 ($tag: String) { bookTitles: books { title: title @tag(tag: $tag) } }`,
                variables: { tag: "Fragment!!" },
            },
        ]);

        expect(result).toEqual({
            operation1: { mockData: "test" },
        });
    });

    it("supports custom scalars and lazily transforms them (with custom deserialization function) when accessed (for objects)", async () => {
        const date = new Date();
        const mockFetch = installMockFetch({
            date: date.toISOString(),
        });
        examplesDates.default.init({
            fetcher: mockFetch as any,
            scalars: {
                DateTime: (v) => new Date(new Date(v).getTime() * 1.2),
            },
        });

        const slw = rootSLWFactory(examplesDates._makeRootOperationInput, (op) => ({
            operation1: op.Query((q) => ({
                date: q.date,
            })),
        }));

        const result = await executeRootAndExpectGraphql(slw, mockFetch, [
            { query: `query operation1 { date }` },
        ]);

        // execute() returns raw JSON; DateTime is still a string until the SLW is hydrated
        expect(result).toEqual({
            operation1: {
                date: date.toISOString(),
            },
        });

        const result2 = await hydrateSlw(slw);
        type Retrieved = (typeof result2) extends SelectionWrapper<infer FN, infer TTNP, infer TTAD, infer VT, infer AT>
            ? VT
            : never;
        const retrieved = result2 as unknown as Retrieved;

        expect(retrieved.operation1.date).toEqual(RootOperation[OPTIONS].scalars.DateTime(date.toISOString()));
    });

    it("supports custom scalars and lazily transforms them (with custom deserialization function) when accessed (for arrays with depth = n)", async () => {
        const date = new Date();
        const dates = [date, date];
        const nestedDates = [[date, date]];
        const nestedDates2 = [[[date], [date]]];
        const mockFetch = installMockFetch({
            dates: dates.map((d) => d.toISOString()),
            nestedDates: nestedDates.map((d) => d.map((d) => d.toISOString())),
            nestedDates2: nestedDates2.map((d) => d.map((d) => d.map((d) => d.toISOString()))),
        });
        examplesDates.default.init({
            fetcher: mockFetch as any,
            scalars: {
                DateTime: (v) => new Date(new Date(v).getTime() * 1.2),
            },
        });

        const slw = rootSLWFactory(examplesDates._makeRootOperationInput, (op) => ({
            operation1: op.Query((q) => ({
                dates: q.dates,
                nestedDates: q.nestedDates,
                nestedDates2: q.nestedDates2,
            })),
        }));

        const result = await executeRootAndExpectGraphql(slw, mockFetch, [
            { query: `query operation1 { dates nestedDates nestedDates2 }` },
        ]);

        expect(result).toEqual({
            operation1: {
                dates: dates.map((d) => d.toISOString()),
                nestedDates: nestedDates.map((d) => d.map((d) => d.toISOString())),
                nestedDates2: nestedDates2.map((d) => d.map((d) => d.map((d) => d.toISOString()))),
            },
        });

        const result2 = await hydrateSlw(slw);
        type Retrieved = (typeof result2) extends SelectionWrapper<infer FN, infer TTNP, infer TTAD, infer VT, infer AT>
            ? VT
            : never;
        const retrieved = result2 as unknown as Retrieved;

        expect(retrieved.operation1).toEqual({
            dates: dates.map((d) => RootOperation[OPTIONS].scalars.DateTime(d.toISOString())),
            nestedDates: nestedDates.map((d) => d.map((d) => RootOperation[OPTIONS].scalars.DateTime(d.toISOString()))),
            nestedDates2: nestedDates2.map((d) =>
                d.map((d) => d.map((d) => RootOperation[OPTIONS].scalars.DateTime(d.toISOString()))),
            ),
        });
    });

    it("supports lazy execution of operations, using the magic .$lazy property", async () => {
        const mockFetch = installMockFetch({
            first10Launches: [{ id: "1" }, { id: "2" }, { id: "3" }],
        });

        const { first10Launches } = await examplesSpaceX.default((op) =>
            op.Query((q) => ({
                first10Launches: q.launches({ limit: 10 })(({ id }) => ({ id })).$lazy,
            })),
        );

        expect(mockFetch).not.toHaveBeenCalled();
        expect(first10Launches).toBeInstanceOf(Function);

        const result = await first10Launches({});
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expectGraphqlPost(mockFetch, {
            query: `query launches ($limit: Int) { first10Launches: launches(limit: $limit) { id } }`,
            variables: { limit: 10 },
        });
        expect(Array.from(result)).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);

        const result2 = await first10Launches({ limit: 22 });
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expectGraphqlPost(mockFetch, {
            query: `query launches ($limit: Int) { first10Launches: launches(limit: $limit) { id } }`,
            variables: { limit: 22 },
        });
        expect(Array.from(result2)).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
    });

    describe("provides multiple ways for authentication", () => {
        const assetQuery = `query test ($id: String!, $locale: String, $locale_1: String) { test: asset(id: $id) { title: title(locale: $locale) description: description(locale: $locale_1) } }`;
        const assetVariables = {
            id: "test",
            locale: "en-US",
            locale_1: "en-US",
        };

        function queryTestAsset() {
            return examplesContentful.default((op) =>
                op.Query((q) => ({
                    test: q.asset({ id: "test" })(({ title, description }) => ({
                        title: title({ locale: "en-US" }),
                        description: description({ locale: "en-US" }),
                    })),
                })),
            );
        }

        function expectAssetCall(mockFetch: ReturnType<typeof jest.fn>, authorization?: string) {
            expectGraphqlPost(mockFetch, {
                query: assetQuery,
                variables: assetVariables,
                headers: authorization ? { Authorization: authorization } : undefined,
            });
        }

        it("sets the auth token as string with the .auth() method", async () => {
            const mockFetch = installMockFetch({
                test: { title: "test title", description: "test description" },
            });
            const authToken = "Bearer test token";
            examplesContentful.default.init({ fetcher: mockFetch as any });

            const { test } = await queryTestAsset().auth(authToken);

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("sets the auth token with a sync callback function in the .auth() method", async () => {
            const mockFetch = installMockFetch({
                test: { title: "test title", description: "test description" },
            });
            const authToken = "Bearer test token";
            examplesContentful.default.init({ fetcher: mockFetch as any });

            const { test } = await queryTestAsset().auth(() => authToken);

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("sets the auth token with an async callback function in the .auth() method", async () => {
            const mockFetch = installMockFetch({
                test: { title: "test title", description: "test description" },
            });
            const authToken = "Bearer test token";
            examplesContentful.default.init({ fetcher: mockFetch as any });

            const { test } = await queryTestAsset().auth(async () => authToken);

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("sets headers directly in the .auth() method", async () => {
            const mockFetch = installMockFetch({
                test: { title: "test title", description: "test description" },
            });
            const authToken = "Bearer test token";
            examplesContentful.default.init({ fetcher: mockFetch as any });

            const { test } = await queryTestAsset().auth({
                Authorization: authToken,
            });

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("sets headers using a sync function in the .auth() method", async () => {
            const mockFetch = installMockFetch({
                test: { title: "test title", description: "test description" },
            });
            const authToken = "Bearer test token";
            examplesContentful.default.init({ fetcher: mockFetch as any });

            const { test } = await queryTestAsset().auth(() => ({
                Authorization: authToken,
            }));

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("sets headers using an async function in the .auth() method", async () => {
            const mockFetch = installMockFetch({
                test: { title: "test title", description: "test description" },
            });
            const authToken = "Bearer test token";
            examplesContentful.default.init({ fetcher: mockFetch as any });

            const { test } = await queryTestAsset().auth(async () => ({
                Authorization: authToken,
            }));

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("sets a static authToken for the sdk globally using the .init() method", async () => {
            const mockFetch = installMockFetch({
                test: { title: "test title", description: "test description" },
            });
            const authToken = "Bearer test token";
            examplesContentful.default.init({
                fetcher: mockFetch as any,
                authToken,
            });

            const { test } = await queryTestAsset();

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("sets the auth token with a sync function for the sdk globally using the .init() method", async () => {
            const mockFetch = installMockFetch({
                test: { title: "test title", description: "test description" },
            });
            const authToken = "Bearer test token";
            examplesContentful.default.init({
                fetcher: mockFetch as any,
                auth: () => authToken,
            });

            const { test } = await queryTestAsset();

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("sets the auth token with an async function for the sdk globally using the .init() method", async () => {
            const mockFetch = installMockFetch({
                test: { title: "test title", description: "test description" },
            });
            const authToken = "Bearer test token";
            examplesContentful.default.init({
                fetcher: mockFetch as any,
                auth: async () => authToken,
            });

            const { test } = await queryTestAsset();

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("passes the .auth(source) argument into the global auth resolver per call", async () => {
            const mockFetch = installMockFetch({
                test: { title: "test title", description: "test description" },
            });
            const seenSources: unknown[] = [];
            examplesContentful.default.init({
                fetcher: mockFetch as any,
                auth: (source) => {
                    seenSources.push(source);
                    if (typeof source === "string") return source;
                    return "Bearer default";
                },
            });

            await queryTestAsset().auth("Bearer from-source");

            expect(seenSources).toEqual(["Bearer from-source"]);
            expectGraphqlPost(mockFetch, {
                query: assetQuery,
                variables: assetVariables,
                headers: { Authorization: "Bearer from-source" },
            });
        });

        it("isolates concurrent calls with different .auth(source) values under a global resolver", async () => {
            const mockFetch = jest.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
                await new Promise((r) => setTimeout(r, 20));
                const auth = (init?.headers as Record<string, string>)?.Authorization;
                return {
                    json: () =>
                        Promise.resolve({
                            data: {
                                test: {
                                    title: auth ?? "none",
                                    description: "test description",
                                },
                            },
                        }),
                };
            });
            examplesContentful.default.init({
                fetcher: mockFetch as any,
                auth: (source) => (typeof source === "string" ? source : "Bearer default"),
            });

            const [a, b] = await Promise.all([
                queryTestAsset().auth("Bearer user-A"),
                queryTestAsset().auth("Bearer user-B"),
            ]);

            expect(a.test.title).toEqual("Bearer user-A");
            expect(b.test.title).toEqual("Bearer user-B");
            const authHeaders = mockFetch.mock.calls.map(
                (c: any[]) => (c[1]?.headers as Record<string, string>)?.Authorization,
            );
            expect(authHeaders).toContain("Bearer user-A");
            expect(authHeaders).toContain("Bearer user-B");
        });
    });
});
