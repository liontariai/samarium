import { beforeAll, describe, expect, it, jest } from "bun:test";
import {
    OPTIONS,
    ROOT_OP_COLLECTOR,
    RootOperation,
    SelectionWrapper,
    SLW_COLLECTOR,
} from "@/graphql/flavors/default/wrapper";
import { rootSLWFactory } from "./utils";
import * as examplesBooksSimple from "@/graphql/flavors/default/__tests__/examples/books.simple";
import * as examplesSpaceX from "@/graphql/flavors/default/__tests__/examples/spacex.with-test-slw";
import * as examplesUnions from "@/graphql/flavors/default/__tests__/examples/unions.simple";
import * as examplesDirectives from "@/graphql/flavors/default/__tests__/examples/directives.simple";
import * as examplesDates from "@/graphql/flavors/default/__tests__/examples/dates.generated";
import * as examplesContentful from "@/graphql/flavors/default/__tests__/examples/contentful.with-test-slw";

describe("Testing and validating features", () => {
    beforeAll(() => {
        RootOperation.authHeaderName = "Authorization";
    });

    it("executes multiple operations and returns results", async () => {
        const slw = rootSLWFactory(examplesBooksSimple._makeRootOperationInput, (op) => ({
            operation1: op.query((q) => ({
                bookTitles: q.books(({ title }) => ({
                    title,
                })),
            })),
            operation2: op.query((q) => ({
                bookAuthors: q.books(({ author }) => ({
                    author,
                })),
            })),
            mutation1: op.mutation((m) => ({
                created: m.createBooks({
                    titles: ["book1", "book2"],
                    authors: ["author1", "author2"],
                })(({ title }) => ({
                    title,
                })),
            })),
        }));
        const mockFetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ data: { mockData: "test" } }),
        });
        RootOperation[OPTIONS].fetcher = mockFetch as any;

        expect(slw[ROOT_OP_COLLECTOR]).toBeDefined();
        expect(slw[ROOT_OP_COLLECTOR]!.ref.op).toBeDefined();

        const rootOp = slw[ROOT_OP_COLLECTOR]!.ref.op!;
        const result = await rootOp.execute();

        // right now each operation results in a fetch call
        // this is because the operations are executed in order
        // and you cannot mix query and mutation in the same operation
        expect(mockFetch).toHaveBeenCalledTimes(3);

        // query operation1
        expect(mockFetch).toHaveBeenNthCalledWith(1, "[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `query operation1 { bookTitles: books { title } }`,
                variables: {},
            }),
        });
        // query operation2
        expect(mockFetch).toHaveBeenNthCalledWith(2, "[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `query operation2 { bookAuthors: books { author } }`,
                variables: {},
            }),
        });

        // mutation
        expect(mockFetch).toHaveBeenNthCalledWith(3, "[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `mutation mutation1 ($titles: [String]!, $authors: [String]!) { created: createBooks(titles: $titles, authors: $authors) { title } }`,
                variables: {
                    titles: ["book1", "book2"],
                    authors: ["author1", "author2"],
                },
            }),
        });

        expect(result).toEqual({
            operation1: {
                mockData: "test",
            },
            operation2: {
                mockData: "test",
            },
            mutation1: {
                mockData: "test",
            },
        });

        RootOperation[OPTIONS].fetcher = undefined as any;
    });

    it("works with aliases", async () => {
        const slw = rootSLWFactory(examplesBooksSimple._makeRootOperationInput, (op) => ({
            operation1: op.query((q) => ({
                bookTitles: q.books(({ title }) => ({
                    nameOfBook: title,
                })),
            })),
        }));
        const mockFetch = jest.fn().mockResolvedValue({
            json: () =>
                Promise.resolve({
                    data: {
                        bookTitles: [{ nameOfBook: "title1" }],
                    },
                }),
        });
        RootOperation[OPTIONS].fetcher = mockFetch as any;

        const rootOp = slw[ROOT_OP_COLLECTOR]!.ref.op!;
        const result = await rootOp.execute();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `query operation1 { bookTitles: books { nameOfBook: title } }`,
                variables: {},
            }),
        });

        expect(result).toEqual({
            operation1: {
                bookTitles: [{ nameOfBook: "title1" }],
            },
        });

        RootOperation[OPTIONS].fetcher = undefined as any;
    });

    it("selects all scalars by using the $scalars() helper", async () => {
        const slw = rootSLWFactory(examplesUnions._makeRootOperationInput, (op) => ({
            operation1: op.query((q) => ({
                bookTitles: q.books(({ $scalars }) => ({
                    ...$scalars(),
                })),
            })),
        }));
        const mockFetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ data: { mockData: "test" } }),
        });
        RootOperation[OPTIONS].fetcher = mockFetch as any;

        const rootOp = slw[ROOT_OP_COLLECTOR]!.ref.op!;
        const result = await rootOp.execute();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `query operation1 { bookTitles: books { title author } }`,
                variables: {},
            }),
        });

        expect(result).toEqual({
            operation1: {
                mockData: "test",
            },
        });

        RootOperation[OPTIONS].fetcher = undefined as any;
    });

    it("works with inline (implicit) fragments", async () => {
        function titleOnly(this: any) {
            return examplesBooksSimple.BookArraySelection.bind(this)((s) => ({
                titleFromFragment: s.title,
            }));
        }

        const slw = rootSLWFactory(examplesBooksSimple._makeRootOperationInput, (op) => ({
            operation1: op.query((q) => ({
                bookTitles: q.books(({ title }) => ({
                    ...titleOnly(),
                })),
            })),
        }));
        const mockFetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ data: { mockData: "test" } }),
        });
        RootOperation[OPTIONS].fetcher = mockFetch as any;

        const rootOp = slw[ROOT_OP_COLLECTOR]!.ref.op!;
        const result = await rootOp.execute();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `query operation1 { bookTitles: books { titleFromFragment: title } }`,
                variables: {},
            }),
        });

        expect(result).toEqual({
            operation1: {
                mockData: "test",
            },
        });

        RootOperation[OPTIONS].fetcher = undefined as any;
    });

    it("adds fragments to the operation text before the operation selection", async () => {
        function launchFragment(this: any) {
            return examplesSpaceX.LaunchSelection.bind(this)(({ id }) => ({
                id,
            }));
        }

        const slw = rootSLWFactory(examplesSpaceX._makeRootOperationInput, (op) => ({
            operation1: op.query((q) => ({
                withFragment: q.launches({
                    limit: 10,
                })(({ $fragment }) => ({
                    ...$fragment(launchFragment)(),
                })),
            })),
        }));
        const mockFetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ data: { mockData: "test" } }),
        });
        RootOperation[OPTIONS].fetcher = mockFetch as any;

        expect(slw[ROOT_OP_COLLECTOR]).toBeDefined();
        expect(slw[ROOT_OP_COLLECTOR]!.ref.op).toBeDefined();

        const rootOp = slw[ROOT_OP_COLLECTOR]!.ref.op!;
        const result = await rootOp.execute();

        expect(mockFetch).toHaveBeenNthCalledWith(1, "[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `fragment launchFragment_ on Launch { id }\n query operation1 ($limit: Int) { withFragment: launches(limit: $limit) { ...launchFragment_ } }`,
                variables: {
                    limit: 10,
                },
            }),
        });

        expect(result).toEqual({
            operation1: {
                mockData: "test",
            },
        });

        RootOperation[OPTIONS].fetcher = undefined as any;
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
            operation1: op.query(({ $fragment }) => ({
                ...$fragment(launchQueryFragment)(10),
            })),
        }));
        const mockFetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ data: { mockData: "test" } }),
        });
        RootOperation[OPTIONS].fetcher = mockFetch as any;

        const rootOp = slw[ROOT_OP_COLLECTOR]!.ref.op!;
        const result = await rootOp.execute();

        expect(mockFetch).toHaveBeenNthCalledWith(1, "[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `fragment launchQueryFragment_limit on Query { firstNLaunches: launches(limit: $limit) { id } }\n query operation1 ($limit: Int) { ...launchQueryFragment_limit }`,
                variables: {
                    limit: 10,
                },
            }),
        });

        expect(result).toEqual({
            operation1: {
                mockData: "test",
            },
        });

        RootOperation[OPTIONS].fetcher = undefined as any;
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
            operation1: op.query((s) => ({
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
        const mockFetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ data: { mockData: "test" } }),
        });
        RootOperation[OPTIONS].fetcher = mockFetch as any;

        const rootOp = slw[ROOT_OP_COLLECTOR]!.ref.op!;
        const result = await rootOp.execute();

        expect(mockFetch).toHaveBeenNthCalledWith(1, "[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `fragment titleOnly_language on Article { titleFromFragment: title books: books(language: $language) { title author } }\nfragment titleOnly_language_1 on Article { titleFromFragment: title books: books(language: $language_1) { title author } }\n query operation1 ($language: String, $language_1: String) { b: books { title } a_DE: articles { ...titleOnly_language } a_EN: articles { ...titleOnly_language_1 } }`,
                variables: {
                    language: "de",
                    language_1: "en",
                },
            }),
        });

        expect(result).toEqual({
            operation1: {
                mockData: "test",
            },
        });

        RootOperation[OPTIONS].fetcher = undefined as any;
    });

    it("works with inline ...on fragments for union types", async () => {
        const slw = rootSLWFactory(examplesUnions._makeRootOperationInput, (op) => ({
            operation1: op.query((q) => ({
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
        const mockFetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ data: { mockData: "test" } }),
        });
        RootOperation[OPTIONS].fetcher = mockFetch as any;

        const rootOp = slw[ROOT_OP_COLLECTOR]!.ref.op!;
        const result = await rootOp.execute();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `query operation1 ($title: String) { all: search(title: $title) { ... on Book { title author } ... on Article { title publisher } } }`,
                variables: {
                    title: "test",
                },
            }),
        });

        expect(result).toEqual({
            operation1: {
                mockData: "test",
            },
        });

        RootOperation[OPTIONS].fetcher = undefined as any;
    });

    it("supports directives", async () => {
        const tag = examplesDirectives.$directives.tag;
        const slw = rootSLWFactory(examplesDirectives._makeRootOperationInput, (op) => ({
            operation1: op.query((q) => ({
                bookTitles: q.books(({ title }) => ({
                    title: tag({
                        tag: "Fragment!!",
                    })(title),
                })),
            })),
        }));
        const mockFetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ data: { mockData: "test" } }),
        });
        RootOperation[OPTIONS].fetcher = mockFetch as any;

        const rootOp = slw[ROOT_OP_COLLECTOR]!.ref.op!;
        const result = await rootOp.execute();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `query operation1 ($tag: String) { bookTitles: books { title: title @tag(tag: $tag) } }`,
                variables: {
                    tag: "Fragment!!",
                },
            }),
        });

        expect(result).toEqual({
            operation1: {
                mockData: "test",
            },
        });
    });

    it("supports custom scalars and lazily transforms them (with custom deserialization function) when accessed (for objects)", async () => {
        const date = new Date();
        const mockFetch = jest.fn().mockResolvedValue({
            json: () =>
                Promise.resolve({
                    data: {
                        date: date.toISOString(),
                    },
                }),
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

        const rootOp = slw[ROOT_OP_COLLECTOR]!.ref.op!;
        const result = await rootOp.execute();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `query operation1 { date }`,
                variables: {},
            }),
        });

        // at this point the root selection wrapper has not been awaited, only the root operation
        // has been executed. Normally, in the generated sdk the default export is an async function that
        // serves as the sdk client function. When awaited, this function executes the root operation,
        // and the root selection wrapper is resolved from a promise. Thus calling .then() on the
        // root selection wrapper. This signals that proxy object shall now look up the result of the
        // in the executed root operation and therefore subsequently accessing properties on the root
        // selection wrapper will retrieve the data from the server response. If the accessed property
        // is a custom scalar, the proxy object will transform it using the transformation function
        // that was passed to the init function of the generated sdk.

        // So here we are expecting that the result of the operation is NOT the transformed data, but
        // the data as it is returned from the server. Thus it is still a string for all the dates.
        expect(result).toEqual({
            operation1: {
                date: date.toISOString(), // here the custom scalar transformation function has not been applied yet
            },
        });

        // Now we access the data for the first time, by executing the root operation collector
        // and awaiting its result. This will subsequently trigger the transformation of the dates to the transformed data,
        // because the root operation collector will be set in the state 'executed'.
        const result2 = await (new Promise((resolve) => {
            slw[ROOT_OP_COLLECTOR]!.ref.execute().then(() => {
                resolve(slw);
            });
        }) as unknown as Promise<typeof slw>);

        // the type here is still the SelectionWrapper<string, string, number, ...>
        // because we've manually split the operation and the selection wrapper.
        // The client function normally handles this as explained above and also unwraps
        // the type. Let's do it manually here.

        type RSLW = typeof result2;
        type Retrieved =
            RSLW extends SelectionWrapper<infer FN, infer TTNP, infer TTAD, infer VT, infer AT> ? VT : never;

        const retrieved = result2 as unknown as Retrieved;

        expect(retrieved.operation1.date).toEqual(
            // match the custom scalar transformation function, as it's applied here
            RootOperation[OPTIONS].scalars.DateTime(date.toISOString()),
        );

        RootOperation[OPTIONS].fetcher = undefined as any;
    });

    it("supports custom scalars and lazily transforms them (with custom deserialization function) when accessed (for arrays with depth = n)", async () => {
        const date = new Date();
        const dates = [date, date];
        const nestedDates = [[date, date]];
        const nestedDates2 = [[[date], [date]]];
        const mockFetch = jest.fn().mockResolvedValue({
            json: () =>
                Promise.resolve({
                    data: {
                        dates: dates.map((d) => d.toISOString()),
                        nestedDates: nestedDates.map((d) => d.map((d) => d.toISOString())),
                        nestedDates2: nestedDates2.map((d) => d.map((d) => d.map((d) => d.toISOString()))),
                    },
                }),
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

        const rootOp = slw[ROOT_OP_COLLECTOR]!.ref.op!;
        const result = await rootOp.execute();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `query operation1 { dates nestedDates nestedDates2 }`,
                variables: {},
            }),
        });

        // at this point the root selection wrapper has not been awaited, only the root operation
        // has been executed. Normally, in the generated sdk the default export is an async function that
        // serves as the sdk client function.
        // When awaited, this function executes the root operation *through the root operation _collector_*,
        // and the root selection wrapper is resolved from a promise. Thus calling .then() on the
        // root selection wrapper. This signals that proxy object shall now look up the result of the
        // in the executed root operation and therefore subsequently accessing properties on the root
        // selection wrapper will retrieve the data from the server response. If the accessed property
        // is a custom scalar, the proxy object will transform it using the transformation function
        // that was passed to the init function of the generated sdk.

        // So here we are expecting that the result of the operation is NOT the transformed data, but
        // the data as it is returned from the server. Thus it is still a string for all the dates.
        expect(result).toEqual({
            operation1: {
                dates: dates.map((d) => d.toISOString()),
                nestedDates: nestedDates.map((d) => d.map((d) => d.toISOString())),
                nestedDates2: nestedDates2.map((d) => d.map((d) => d.map((d) => d.toISOString()))),
            },
        });

        // Now we access the data for the first time, by executing the root operation collector
        // and awaiting its result. This will subsequently trigger the transformation of the dates to the transformed data,
        // because the root operation collector will be set in the state 'executed'.
        const result2 = await (new Promise((resolve) => {
            slw[ROOT_OP_COLLECTOR]!.ref.execute().then(() => {
                resolve(slw);
            });
        }) as unknown as Promise<typeof slw>);

        // the type here is still the SelectionWrapper<string, string, number, ...>
        // because we've manually split the operation and the selection wrapper.
        // The client function normally handles this as explained above and also unwraps
        // the type. Let's do it manually here.

        type RSLW = typeof result2;
        type Retrieved =
            RSLW extends SelectionWrapper<infer FN, infer TTNP, infer TTAD, infer VT, infer AT> ? VT : never;

        const retrieved = result2 as unknown as Retrieved;

        expect(retrieved.operation1).toEqual({
            dates: dates.map((d) => RootOperation[OPTIONS].scalars.DateTime(d.toISOString())),
            nestedDates: nestedDates.map((d) => d.map((d) => RootOperation[OPTIONS].scalars.DateTime(d.toISOString()))),
            nestedDates2: nestedDates2.map((d) =>
                d.map((d) => d.map((d) => RootOperation[OPTIONS].scalars.DateTime(d.toISOString()))),
            ),
        });

        RootOperation[OPTIONS].fetcher = undefined as any;
    });

    it("supports lazy execution of operations, using the magic .$lazy property", async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            json: () =>
                Promise.resolve({
                    data: {
                        first10Launches: [{ id: "1" }, { id: "2" }, { id: "3" }],
                    },
                }),
        });
        RootOperation[OPTIONS].fetcher = mockFetch as any;

        const { first10Launches } = await examplesSpaceX.default((op) =>
            op.query((q) => ({
                first10Launches: q.launches({ limit: 10 })(({ id }) => ({ id })).$lazy,
            })),
        );

        expect(mockFetch).not.toHaveBeenCalled();
        expect(first10Launches).toBeInstanceOf(Function);

        // the lazy operation has it's default argument set to { limit: 10 }, so if not
        // specified, it will use that value
        const result = await first10Launches({});

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `query launches ($limit: Int) { first10Launches: launches(limit: $limit) { id } }`,
                variables: { limit: 10 },
                // thus the variables object is not empty object, but has the default value
            }),
        });

        // since the result is not a true array but a proxy object, we need to convert it to an array in order to test it
        expect(Array.from(result)).toBeArray();
        expect(Array.from(result)).toHaveLength(3);
        expect(Array.from(result)).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);

        const result2 = await first10Launches({ limit: 22 });

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...RootOperation[OPTIONS].headers,
            },
            body: JSON.stringify({
                query: `query launches ($limit: Int) { first10Launches: launches(limit: $limit) { id } }`,
                variables: { limit: 22 },
            }),
        });

        // since the result is not a true array but a proxy object, we need to convert it to an array in order to test it
        expect(Array.from(result2)).toBeArray();
        expect(Array.from(result2)).toHaveLength(3);
        expect(Array.from(result2)).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);

        RootOperation[OPTIONS].fetcher = undefined as any;
    });

    describe("provides multiple ways for authentication", () => {
        it("sets the auth token as string with the .auth() method", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        data: {
                            test: {
                                title: "test title",
                                description: "test description",
                            },
                        },
                    }),
            });
            const authToken = "Bearer test token";

            examplesContentful.default.init({
                fetcher: mockFetch as any,
            });

            const { test } = await examplesContentful
                .default((op) =>
                    op.query((q) => ({
                        test: q.asset({ id: "test" })(({ title, description }) => ({
                            title: title({ locale: "en-US" }),
                            description: description({ locale: "en-US" }),
                        })),
                    })),
                )
                .auth(authToken);

            expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken,
                },
                body: JSON.stringify({
                    query: `query test ($id: String!, $locale: String, $locale_1: String) { test: asset(id: $id) { title: title(locale: $locale) description: description(locale: $locale_1) } }`,
                    variables: {
                        id: "test",
                        locale: "en-US",
                        locale_1: "en-US",
                    },
                }),
            });

            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");

            RootOperation[OPTIONS].fetcher = undefined as any;
        });

        it("sets the auth token with a sync callback function in the .auth() method", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        data: {
                            test: {
                                title: "test title",
                                description: "test description",
                            },
                        },
                    }),
            });
            const authToken = "Bearer test token";

            examplesContentful.default.init({
                fetcher: mockFetch as any,
            });

            const { test } = await examplesContentful
                .default((op) =>
                    op.query((q) => ({
                        test: q.asset({ id: "test" })(({ title, description }) => ({
                            title: title({ locale: "en-US" }),
                            description: description({ locale: "en-US" }),
                        })),
                    })),
                )
                .auth(() => authToken);

            expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken,
                },
                body: JSON.stringify({
                    query: `query test ($id: String!, $locale: String, $locale_1: String) { test: asset(id: $id) { title: title(locale: $locale) description: description(locale: $locale_1) } }`,
                    variables: {
                        id: "test",
                        locale: "en-US",
                        locale_1: "en-US",
                    },
                }),
            });

            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");

            RootOperation[OPTIONS].fetcher = undefined as any;
        });

        it("sets the auth token with an async callback function in the .auth() method", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        data: {
                            test: {
                                title: "test title",
                                description: "test description",
                            },
                        },
                    }),
            });
            const authToken = "Bearer test token";

            examplesContentful.default.init({
                fetcher: mockFetch as any,
            });

            const { test } = await examplesContentful
                .default((op) =>
                    op.query((q) => ({
                        test: q.asset({ id: "test" })(({ title, description }) => ({
                            title: title({ locale: "en-US" }),
                            description: description({ locale: "en-US" }),
                        })),
                    })),
                )
                .auth(async () => {
                    return authToken;
                });

            expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken,
                },
                body: JSON.stringify({
                    query: `query test ($id: String!, $locale: String, $locale_1: String) { test: asset(id: $id) { title: title(locale: $locale) description: description(locale: $locale_1) } }`,
                    variables: {
                        id: "test",
                        locale: "en-US",
                        locale_1: "en-US",
                    },
                }),
            });

            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");

            RootOperation[OPTIONS].fetcher = undefined as any;
        });

        it("sets headers directly in the .auth() method", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        data: {
                            test: {
                                title: "test title",
                                description: "test description",
                            },
                        },
                    }),
            });
            const authToken = "Bearer test token";

            examplesContentful.default.init({
                fetcher: mockFetch as any,
            });

            const { test } = await examplesContentful
                .default((op) =>
                    op.query((q) => ({
                        test: q.asset({ id: "test" })(({ title, description }) => ({
                            title: title({ locale: "en-US" }),
                            description: description({ locale: "en-US" }),
                        })),
                    })),
                )
                .auth({
                    Authorization: authToken,
                });

            expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken,
                },
                body: JSON.stringify({
                    query: `query test ($id: String!, $locale: String, $locale_1: String) { test: asset(id: $id) { title: title(locale: $locale) description: description(locale: $locale_1) } }`,
                    variables: {
                        id: "test",
                        locale: "en-US",
                        locale_1: "en-US",
                    },
                }),
            });

            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");

            RootOperation[OPTIONS].fetcher = undefined as any;
        });

        it("sets headers using a sync function in the .auth() method", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        data: {
                            test: {
                                title: "test title",
                                description: "test description",
                            },
                        },
                    }),
            });
            const authToken = "Bearer test token";

            examplesContentful.default.init({
                fetcher: mockFetch as any,
            });

            const { test } = await examplesContentful
                .default((op) =>
                    op.query((q) => ({
                        test: q.asset({ id: "test" })(({ title, description }) => ({
                            title: title({ locale: "en-US" }),
                            description: description({ locale: "en-US" }),
                        })),
                    })),
                )
                .auth(() => {
                    return {
                        Authorization: authToken,
                    };
                });

            expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken,
                },
                body: JSON.stringify({
                    query: `query test ($id: String!, $locale: String, $locale_1: String) { test: asset(id: $id) { title: title(locale: $locale) description: description(locale: $locale_1) } }`,
                    variables: {
                        id: "test",
                        locale: "en-US",
                        locale_1: "en-US",
                    },
                }),
            });

            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");

            RootOperation[OPTIONS].fetcher = undefined as any;
        });

        it("sets headers using an async function in the .auth() method", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        data: {
                            test: {
                                title: "test title",
                                description: "test description",
                            },
                        },
                    }),
            });
            const authToken = "Bearer test token";

            examplesContentful.default.init({
                fetcher: mockFetch as any,
            });

            const { test } = await examplesContentful
                .default((op) =>
                    op.query((q) => ({
                        test: q.asset({ id: "test" })(({ title, description }) => ({
                            title: title({ locale: "en-US" }),
                            description: description({ locale: "en-US" }),
                        })),
                    })),
                )
                .auth(async () => {
                    return {
                        Authorization: authToken,
                    };
                });

            expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken,
                },
                body: JSON.stringify({
                    query: `query test ($id: String!, $locale: String, $locale_1: String) { test: asset(id: $id) { title: title(locale: $locale) description: description(locale: $locale_1) } }`,
                    variables: {
                        id: "test",
                        locale: "en-US",
                        locale_1: "en-US",
                    },
                }),
            });

            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");

            RootOperation[OPTIONS].fetcher = undefined as any;
        });

        const resetAuth = () => {
            RootOperation[OPTIONS]._auth_fn = undefined;
            RootOperation[OPTIONS]._auth_token = undefined;
            RootOperation[OPTIONS].headers = {};
            RootOperation[OPTIONS].fetcher = undefined as any;
        };

        it("sets a static authToken for the sdk globally using the .init() method", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        data: {
                            test: {
                                title: "test title",
                                description: "test description",
                            },
                        },
                    }),
            });
            const authToken = "Bearer test token";

            examplesContentful.default.init({
                fetcher: mockFetch as any,
                authToken,
            });

            const { test } = await examplesContentful.default((op) =>
                op.query((q) => ({
                    test: q.asset({ id: "test" })(({ title, description }) => ({
                        title: title({ locale: "en-US" }),
                        description: description({ locale: "en-US" }),
                    })),
                })),
            );

            expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken,
                },
                body: JSON.stringify({
                    query: `query test ($id: String!, $locale: String, $locale_1: String) { test: asset(id: $id) { title: title(locale: $locale) description: description(locale: $locale_1) } }`,
                    variables: {
                        id: "test",
                        locale: "en-US",
                        locale_1: "en-US",
                    },
                }),
            });

            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");

            resetAuth();
            RootOperation[OPTIONS].fetcher = undefined as any;
        });

        it("sets the auth token with a sync function for the sdk globally using the .init() method", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        data: {
                            test: {
                                title: "test title",
                                description: "test description",
                            },
                        },
                    }),
            });
            const authToken = "Bearer test token";

            examplesContentful.default.init({
                fetcher: mockFetch as any,
                auth: () => authToken,
            });

            const { test } = await examplesContentful.default((op) =>
                op.query((q) => ({
                    test: q.asset({ id: "test" })(({ title, description }) => ({
                        title: title({ locale: "en-US" }),
                        description: description({ locale: "en-US" }),
                    })),
                })),
            );

            expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken,
                },
                body: JSON.stringify({
                    query: `query test ($id: String!, $locale: String, $locale_1: String) { test: asset(id: $id) { title: title(locale: $locale) description: description(locale: $locale_1) } }`,
                    variables: {
                        id: "test",
                        locale: "en-US",
                        locale_1: "en-US",
                    },
                }),
            });

            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");

            resetAuth();
            RootOperation[OPTIONS].fetcher = undefined as any;
        });

        it("sets the auth token with an async function for the sdk globally using the .init() method", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        data: {
                            test: {
                                title: "test title",
                                description: "test description",
                            },
                        },
                    }),
            });
            const authToken = "Bearer test token";

            examplesContentful.default.init({
                fetcher: mockFetch as any,
                auth: async () => authToken,
            });

            const { test } = await examplesContentful.default((op) =>
                op.query((q) => ({
                    test: q.asset({ id: "test" })(({ title, description }) => ({
                        title: title({ locale: "en-US" }),
                        description: description({ locale: "en-US" }),
                    })),
                })),
            );

            expect(mockFetch).toHaveBeenCalledWith("[ENDPOINT]", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken,
                },
                body: JSON.stringify({
                    query: `query test ($id: String!, $locale: String, $locale_1: String) { test: asset(id: $id) { title: title(locale: $locale) description: description(locale: $locale_1) } }`,
                    variables: {
                        id: "test",
                        locale: "en-US",
                        locale_1: "en-US",
                    },
                }),
            });

            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");

            resetAuth();
            RootOperation[OPTIONS].fetcher = undefined as any;
        });

        it("passes the .auth(source) argument into the global auth resolver per call", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        data: {
                            test: {
                                title: "test title",
                                description: "test description",
                            },
                        },
                    }),
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

            await examplesContentful
                .default((op) =>
                    op.query((q) => ({
                        test: q.asset({ id: "test" })(({ title, description }) => ({
                            title: title({ locale: "en-US" }),
                            description: description({ locale: "en-US" }),
                        })),
                    })),
                )
                .auth("Bearer from-source");

            expect(seenSources).toEqual(["Bearer from-source"]);
            expect(mockFetch).toHaveBeenCalledWith(
                "[ENDPOINT]",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer from-source",
                    }),
                }),
            );

            resetAuth();
            RootOperation[OPTIONS].fetcher = undefined as any;
        });

        it("isolates concurrent calls with different .auth(source) values under a global resolver", async () => {
            const mockFetch = jest.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
                // Simulate network latency so both requests are in flight together
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

            const call = (token: string) =>
                examplesContentful
                    .default((op) =>
                        op.query((q) => ({
                            test: q.asset({ id: "test" })(({ title, description }) => ({
                                title: title({ locale: "en-US" }),
                                description: description({ locale: "en-US" }),
                            })),
                        })),
                    )
                    .auth(token);

            const [a, b] = await Promise.all([call("Bearer user-A"), call("Bearer user-B")]);

            expect(a.test.title).toEqual("Bearer user-A");
            expect(b.test.title).toEqual("Bearer user-B");

            const authHeaders = mockFetch.mock.calls.map(
                (c: any[]) => (c[1]?.headers as Record<string, string>)?.Authorization,
            );
            expect(authHeaders).toContain("Bearer user-A");
            expect(authHeaders).toContain("Bearer user-B");

            resetAuth();
            RootOperation[OPTIONS].fetcher = undefined as any;
        });
    });
});
