import { afterEach, beforeAll, describe, expect, it, jest } from "bun:test";
import {
    OPTIONS,
    ROOT_OP_COLLECTOR,
    RootOperation,
    SelectionWrapper,
} from "@/openapi/flavors/default/wrapper";
import { rootSLWFactory } from "./utils";
import * as examplesBooks from "./examples/books.generated";
import * as examplesDates from "./examples/dates.generated";
import * as examplesUnions from "./examples/unions.generated";
import * as examplesAuth from "./examples/auth.generated";
import * as examplesEvents from "./examples/events.generated";
import * as examplesTestapi from "./examples/testapi.generated";

type RestCall = {
    path: string;
    method: string;
    body?: unknown;
    headers?: Record<string, string>;
};

function installMockFetch(data: unknown = { mockData: "test" }) {
    const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(""),
    });
    RootOperation[OPTIONS].fetcher = mockFetch as any;
    return mockFetch;
}

function expectedInit(call: RestCall) {
    return {
        method: call.method,
        headers: {
            ...(call.body !== undefined ? { "Content-Type": "application/json" } : {}),
            ...RootOperation[OPTIONS].headers,
            ...call.headers,
        },
        body: call.body !== undefined ? JSON.stringify(call.body) : undefined,
    };
}

function expectRestCall(mockFetch: ReturnType<typeof jest.fn>, call: RestCall, nth?: number) {
    const expected = [`[ENDPOINT]${call.path}`, expectedInit(call)] as const;
    if (nth != null) {
        expect(mockFetch).toHaveBeenNthCalledWith(nth, ...expected);
    } else {
        expect(mockFetch).toHaveBeenCalledWith(...expected);
    }
}

function expectRestCalls(mockFetch: ReturnType<typeof jest.fn>, calls: RestCall[]) {
    expect(mockFetch).toHaveBeenCalledTimes(calls.length);
    for (const call of calls) {
        expectRestCall(mockFetch, call);
    }
}

function executeRoot(slw: {
    [ROOT_OP_COLLECTOR]?: { ref: { op?: { execute: () => Promise<any> }; execute: () => Promise<any> } };
}) {
    // Collector execute() marks isExecuted so SLW traps (SSE asyncIterator, scalars) work
    return slw[ROOT_OP_COLLECTOR]!.ref.execute();
}

async function executeRootAndExpectRest(
    slw: Parameters<typeof executeRoot>[0],
    mockFetch: ReturnType<typeof jest.fn>,
    calls: RestCall[],
) {
    const result = await executeRoot(slw);
    expectRestCalls(mockFetch, calls);
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
    RootOperation[OPTIONS].sseFetchTransform = undefined as any;
    RootOperation[OPTIONS]._auth_fn = undefined;
    RootOperation[OPTIONS]._auth_token = undefined;
    RootOperation[OPTIONS].headers = {};
    RootOperation[OPTIONS].scalars = {
        DateTime: (value: string) => new Date(value),
        DateTimeISO: (value: string) => new Date(value),
        Date: (value: string) => new Date(value),
        Time: (value: string) => new Date(value),
        JSON: (value: string) => JSON.parse(value),
    };
    RootOperation.authHeaderName = "Authorization";
}

describe("Testing and validating features", () => {
    beforeAll(() => {
        RootOperation.authHeaderName = "Authorization";
    });

    afterEach(() => {
        resetSdkOptions();
    });

    it("executes multiple operations and returns results", async () => {
        const slw = rootSLWFactory(examplesBooks._makeRootOperationInput, (op) => ({
            operation1: op.listBooks({})(({ title }) => ({
                title,
            })),
            operation2: op.listBooks({})(({ author }) => ({
                author,
            })),
            mutation1: op.createBooks({
                titles: ["book1", "book2"],
                authors: ["author1", "author2"],
            })(({ title }) => ({
                title,
            })),
        }));
        const mockFetch = installMockFetch();

        expect(slw[ROOT_OP_COLLECTOR]).toBeDefined();
        expect(slw[ROOT_OP_COLLECTOR]!.ref.op).toBeDefined();

        const result = await executeRootAndExpectRest(slw, mockFetch, [
            { path: "/books", method: "get" },
            { path: "/books", method: "get" },
            {
                path: "/books",
                method: "post",
                body: {
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

    it("works with selection aliases", async () => {
        const slw = rootSLWFactory(examplesBooks._makeRootOperationInput, (op) => ({
            operation1: op.listBooks({})(({ title }) => ({
                nameOfBook: title,
            })),
        }));
        const mockFetch = installMockFetch([{ title: "title1" }]);

        const result = await executeRootAndExpectRest(slw, mockFetch, [{ path: "/books", method: "get" }]);

        expect(result).toEqual({
            operation1: [{ title: "title1" }],
        });
    });

    it("selects all fields by omitting the selection callback (default $all)", async () => {
        const slw = rootSLWFactory(examplesUnions._makeRootOperationInput, (op) => ({
            operation1: op.listBooks()(),
        }));
        const mockFetch = installMockFetch();

        const result = await executeRootAndExpectRest(slw, mockFetch, [{ path: "/books", method: "get" }]);

        expect(result).toEqual({
            operation1: { mockData: "test" },
        });
    });

    it("works with $on for oneOf union types", async () => {
        const slw = rootSLWFactory(examplesUnions._makeRootOperationInput, (op) => ({
            operation1: op.search({ title: "test" })(({ $on }) => ({
                ...$on.Book((s) => ({
                    ...s.$scalars(),
                })),
                ...$on.Article((s) => ({
                    ...s.$scalars(),
                })),
            })),
        }));
        const mockFetch = installMockFetch();

        const result = await executeRootAndExpectRest(slw, mockFetch, [
            { path: "/search?title=test", method: "get" },
        ]);

        expect(result).toEqual({
            operation1: { mockData: "test" },
        });
    });

    it("substitutes path and query parameters into the request URL", async () => {
        const slw = rootSLWFactory(examplesTestapi._makeRootOperationInput, (op) => ({
            hello: op.postHelloById({ id: "abc" }),
            helloObject: op.postHelloObjectById({ id: "xyz" })(({ message }) => ({ message })),
            index: op.getIndex(),
        }));
        const mockFetch = installMockFetch("ok");

        const result = await executeRootAndExpectRest(slw, mockFetch, [
            { path: "/hello/abc", method: "post" },
            { path: "/helloobject/xyz", method: "post" },
            { path: "/", method: "get" },
        ]);

        expect(result).toEqual({
            hello: "ok",
            helloObject: "ok",
            index: "ok",
        });
    });

    it("supports custom scalars and lazily transforms them when accessed (for objects)", async () => {
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
            operation1: op.getEvent()(({ date }) => ({
                date,
            })),
        }));

        const result = await executeRootAndExpectRest(slw, mockFetch, [{ path: "/event", method: "get" }]);

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

    it("supports custom scalars and lazily transforms them when accessed (for arrays with depth = n)", async () => {
        const date = new Date("2030-01-01T00:00:00.000Z");
        const dates = [date, date];
        const nestedDates = [[date, date]];
        const nestedDates2 = [[[date], [date]]];

        const mockFetch = jest.fn().mockImplementation(async (url: string) => {
            const path = String(url).replace("[ENDPOINT]", "");
            const body =
                path === "/dates"
                    ? dates.map((d) => d.toISOString())
                    : path === "/nested-dates"
                      ? nestedDates.map((d) => d.map((d) => d.toISOString()))
                      : path === "/nested-dates-2"
                        ? nestedDates2.map((d) => d.map((d) => d.map((d) => d.toISOString())))
                        : null;
            return {
                ok: true,
                json: async () => body,
                text: async () => "",
            };
        });
        examplesDates.default.init({
            fetcher: mockFetch as any,
            scalars: {
                DateTime: (v) => new Date(new Date(v).getTime() * 1.2),
            },
        });

        const result = await examplesDates.default((op) => ({
            dates: op.getDates(),
            nestedDates: op.getNestedDates(),
            nestedDates2: op.getNestedDates2(),
        }));

        expectRestCalls(mockFetch, [
            { path: "/dates", method: "get" },
            { path: "/nested-dates", method: "get" },
            { path: "/nested-dates-2", method: "get" },
        ]);

        const transformed = RootOperation[OPTIONS].scalars.DateTime(date.toISOString());
        expect(result.dates[0]).toBeInstanceOf(Date);
        expect(result.dates[0].toISOString()).toBe(transformed.toISOString());
        expect(result.nestedDates[0][0]).toBeInstanceOf(Date);
        expect(result.nestedDates[0][0].toISOString()).toBe(transformed.toISOString());
        expect(result.nestedDates2[0][0][0]).toBeInstanceOf(Date);
        expect(result.nestedDates2[0][0][0].toISOString()).toBe(transformed.toISOString());
    });

    it("supports lazy execution of operations, using the magic .$lazy property", async () => {
        const mockFetch = installMockFetch([{ title: "1" }, { title: "2" }, { title: "3" }]);

        const { books } = examplesBooks.default((op) => ({
            books: op.listBooks({ limit: 10 })(({ title }) => ({ title })).$lazy,
        }));

        expect(mockFetch).not.toHaveBeenCalled();
        expect(books).toBeInstanceOf(Function);

        const result = await books({});
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expectRestCall(mockFetch, { path: "/books?limit=10", method: "get" });
        expect(Array.from(result)).toEqual([{ title: "1" }, { title: "2" }, { title: "3" }]);

        const result2 = await books({ limit: 22 });
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expectRestCall(mockFetch, { path: "/books?limit=22", method: "get" });
        expect(Array.from(result2)).toEqual([{ title: "1" }, { title: "2" }, { title: "3" }]);
    });

    it("streams SSE events with scalar deserialization via asyncIterator", async () => {
        const encoder = new TextEncoder();
        const chunks = [
            encoder.encode('data: {"id":"1","at":"2030-01-01T00:00:00.000Z"}\n\n'),
            encoder.encode('data: {"id":"2","at":"2030-02-01T00:00:00.000Z"}\n\n'),
        ];
        let i = 0;
        const stream = new ReadableStream<Uint8Array>({
            pull(controller) {
                if (i < chunks.length) {
                    controller.enqueue(chunks[i++]);
                } else {
                    controller.close();
                }
            },
        });

        const mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            body: stream,
            text: async () => "",
        });
        RootOperation[OPTIONS].fetcher = mockFetch as any;

        const slw = rootSLWFactory(examplesEvents._makeRootOperationInput, (op) => ({
            onEvent: op.onEvent()(({ id, at }) => ({ id, at })),
        }));

        await executeRoot(slw);

        const events: any[] = [];
        for await (const ev of (slw as any).onEvent) {
            events.push(ev);
        }

        // subscribe fetch is lazy — it starts when the async iterator is consumed
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [, init] = mockFetch.mock.calls[0];
        expect(init.method).toBe("get");
        expect(init.headers.Accept).toBe("text/event-stream");
        expect(mockFetch.mock.calls[0][0]).toBe("[ENDPOINT]/events");

        expect(events.length).toBe(2);
        expect(events[0].id).toBe("1");
        expect(events[0].at).toBeInstanceOf(Date);
        expect(events[1].id).toBe("2");
    });

    describe("provides multiple ways for authentication", () => {
        function queryTestAsset() {
            return examplesAuth.default((op) => ({
                test: op.getAsset({ id: "test", locale: "en-US" })(({ title, description }) => ({
                    title,
                    description,
                })),
            }));
        }

        function expectAssetCall(mockFetch: ReturnType<typeof jest.fn>, authorization?: string) {
            expectRestCall(mockFetch, {
                path: "/assets/test?locale=en-US",
                method: "get",
                headers: authorization ? { Authorization: authorization } : undefined,
            });
        }

        it("sets the auth token as string with the .auth() method", async () => {
            const mockFetch = installMockFetch({
                title: "test title",
                description: "test description",
            });
            const authToken = "Bearer test token";
            examplesAuth.default.init({ fetcher: mockFetch as any });

            const { test } = await queryTestAsset().auth(authToken);

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("sets the auth token with a sync callback function in the .auth() method", async () => {
            const mockFetch = installMockFetch({
                title: "test title",
                description: "test description",
            });
            const authToken = "Bearer test token";
            examplesAuth.default.init({ fetcher: mockFetch as any });

            const { test } = await queryTestAsset().auth(() => authToken);

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("sets the auth token with an async callback function in the .auth() method", async () => {
            const mockFetch = installMockFetch({
                title: "test title",
                description: "test description",
            });
            const authToken = "Bearer test token";
            examplesAuth.default.init({ fetcher: mockFetch as any });

            const { test } = await queryTestAsset().auth(async () => authToken);

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("sets headers directly in the .auth() method", async () => {
            const mockFetch = installMockFetch({
                title: "test title",
                description: "test description",
            });
            const authToken = "Bearer test token";
            examplesAuth.default.init({ fetcher: mockFetch as any });

            const { test } = await queryTestAsset().auth({
                Authorization: authToken,
            });

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("sets headers using a sync function in the .auth() method", async () => {
            const mockFetch = installMockFetch({
                title: "test title",
                description: "test description",
            });
            const authToken = "Bearer test token";
            examplesAuth.default.init({ fetcher: mockFetch as any });

            const { test } = await queryTestAsset().auth(() => ({
                Authorization: authToken,
            }));

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("sets headers using an async function in the .auth() method", async () => {
            const mockFetch = installMockFetch({
                title: "test title",
                description: "test description",
            });
            const authToken = "Bearer test token";
            examplesAuth.default.init({ fetcher: mockFetch as any });

            const { test } = await queryTestAsset().auth(async () => ({
                Authorization: authToken,
            }));

            expectAssetCall(mockFetch, authToken);
            expect(test.title).toEqual("test title");
            expect(test.description).toEqual("test description");
        });

        it("sets a static authToken for the sdk globally using the .init() method", async () => {
            const mockFetch = installMockFetch({
                title: "test title",
                description: "test description",
            });
            const authToken = "Bearer test token";
            examplesAuth.default.init({
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
                title: "test title",
                description: "test description",
            });
            const authToken = "Bearer test token";
            examplesAuth.default.init({
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
                title: "test title",
                description: "test description",
            });
            const authToken = "Bearer test token";
            examplesAuth.default.init({
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
                title: "test title",
                description: "test description",
            });
            const seenSources: unknown[] = [];
            examplesAuth.default.init({
                fetcher: mockFetch as any,
                auth: (source) => {
                    seenSources.push(source);
                    if (typeof source === "string") return source;
                    return "Bearer default";
                },
            });

            await queryTestAsset().auth("Bearer from-source");

            expect(seenSources).toEqual(["Bearer from-source"]);
            expectRestCall(mockFetch, {
                path: "/assets/test?locale=en-US",
                method: "get",
                headers: { Authorization: "Bearer from-source" },
            });
        });

        it("isolates concurrent calls with different .auth(source) values under a global resolver", async () => {
            const mockFetch = jest.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
                await new Promise((r) => setTimeout(r, 20));
                const auth = (init?.headers as Record<string, string>)?.Authorization;
                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            title: auth ?? "none",
                            description: "test description",
                        }),
                    text: async () => "",
                };
            });
            examplesAuth.default.init({
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
