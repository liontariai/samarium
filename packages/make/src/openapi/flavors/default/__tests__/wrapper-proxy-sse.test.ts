import { afterEach, describe, expect, it, jest } from "bun:test";
import {
    OperationSelectionCollector,
    OPTIONS,
    ROOT_OP_META,
    RootOperation,
    SelectionWrapper,
    SLW_OP_PATH,
} from "../wrapper";
import { gatherMetaForPathOperation } from "../../../builder/meta";
import { Collector } from "../../../builder/collector";
import type { OpenAPI3, OperationObject } from "openapi-typescript";

function resetRootOptions() {
    RootOperation[OPTIONS].fetcher = undefined as any;
    RootOperation[OPTIONS].sseFetchTransform = undefined as any;
    RootOperation[OPTIONS].headers = {};
    RootOperation[OPTIONS]._auth_fn = undefined;
    RootOperation[OPTIONS]._auth_token = undefined;
    RootOperation.authHeaderName = "Authorization";
}

describe("OpenAPI SelectionWrapper proxy + SSE", () => {
    afterEach(() => {
        resetRootOptions();
    });

    function makeRootWithOps(
        ops: Record<
            string,
            {
                path: string;
                method: "get" | "post";
                isEventStream?: boolean;
                listDepth?: number;
                selection: (collector: OperationSelectionCollector) => any;
            }
        >,
    ) {
        const rootOp = new RootOperation();
        const root = new OperationSelectionCollector(undefined, undefined, rootOp);
        const rootRef = { ref: root };

        const value: Record<string, any> = {};
        for (const [name, cfg] of Object.entries(ops)) {
            const opCollector = new OperationSelectionCollector(name, rootRef);
            const sel = cfg.selection(opCollector);
            const slw = new SelectionWrapper(
                name,
                "OpResult",
                cfg.listDepth ?? 0,
                sel,
                opCollector,
                // parent collector present => object/list with subselection
                opCollector,
            );
            slw[ROOT_OP_META] = {
                path: cfg.path,
                method: cfg.method,
                isEventStream: cfg.isEventStream,
            };
            slw[SLW_OP_PATH] = name;
            Object.keys(sel).forEach((k) => {
                (slw as any)[k] = sel[k];
            });
            root.registerSelection(name, slw as any);
            // paths for nested fields
            opCollector.renderSelections([name]);
            value[name] = slw;
        }

        const resultRoot = new SelectionWrapper(undefined, undefined, undefined, value, root, undefined);
        Object.keys(value).forEach((k) => {
            (resultRoot as any)[k] = value[k];
        });
        return { root, resultRoot, rootOp };
    }

    function field(
        collector: OperationSelectionCollector,
        name: string,
        typeName: string,
        arrDepth = 0,
        nested?: Record<string, any>,
    ) {
        // Parent the field collector on the op collector so ROOT_OP_COLLECTOR walks up to the root ref
        const fieldCollector = new OperationSelectionCollector(name, collector);
        const slw = new SelectionWrapper(
            name,
            typeName,
            arrDepth,
            nested ?? (undefined as any),
            // Leaf scalars: no sub-collector as SLW collector — use fieldCollector so ROOT_OP_COLLECTOR resolves
            nested ? fieldCollector : fieldCollector,
            collector,
        );
        if (nested) {
            Object.keys(nested).forEach((k) => {
                (slw as any)[k] = nested[k];
            });
        }
        collector.registerSelection(name, slw as any);
        return slw;
    }

    it("deserializes Date scalars and supports array index access", async () => {
        const { root, resultRoot } = makeRootWithOps({
            listItems: {
                path: "/items",
                method: "get",
                listDepth: 1,
                selection: (c) => {
                    const id = field(c, "id", "String");
                    const createdAt = field(c, "createdAt", "DateTime");
                    return { id, createdAt };
                },
            },
        });

        RootOperation[OPTIONS].fetcher = (async () =>
            ({
                ok: true,
                json: async () => [
                    { id: "a", createdAt: "2030-01-01T00:00:00.000Z" },
                    { id: "b", createdAt: "2030-06-01T00:00:00.000Z" },
                ],
            }) as Response) as any;

        await root.execute();

        const items = (resultRoot as any).listItems;
        // length / index go through executed get trap on the list SLW
        expect(items.length).toBe(2);
        expect(items[0].id).toBe("a");
        expect(items[0].createdAt).toBeInstanceOf(Date);
        expect(items[1].id).toBe("b");
        expect(items[99]).toBeUndefined();
    });

    it("returns null for null array elements without proxying", async () => {
        const { root, resultRoot } = makeRootWithOps({
            listItems: {
                path: "/items",
                method: "get",
                listDepth: 1,
                selection: (c) => {
                    const id = field(c, "id", "String");
                    return { id };
                },
            },
        });

        RootOperation[OPTIONS].fetcher = (async () =>
            ({
                ok: true,
                json: async () => [{ id: "a" }, null, { id: "c" }],
            }) as Response) as any;

        await root.execute();
        const items = (resultRoot as any).listItems;
        expect(items[0].id).toBe("a");
        expect(items[1]).toBeNull();
        expect(items[2].id).toBe("c");
    });

    it("handles empty arrays without Proxy errors", async () => {
        const { root, resultRoot } = makeRootWithOps({
            listItems: {
                path: "/items",
                method: "get",
                listDepth: 1,
                selection: (c) => ({ id: field(c, "id", "String") }),
            },
        });

        RootOperation[OPTIONS].fetcher = (async () =>
            ({
                ok: true,
                json: async () => [],
            }) as Response) as any;

        await root.execute();
        const items = (resultRoot as any).listItems;
        // empty list with subselection returns [] from the array field branch
        expect(items.length).toBe(0);
        expect([...items]).toEqual([]);
    });

    it("streams SSE events with scalar deserialization via asyncIterator", async () => {
        const { root, resultRoot } = makeRootWithOps({
            onEvent: {
                path: "/events",
                method: "get",
                isEventStream: true,
                selection: (c) => ({
                    id: field(c, "id", "String"),
                    at: field(c, "at", "DateTime"),
                }),
            },
        });

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

        RootOperation[OPTIONS].fetcher = (async () =>
            ({
                ok: true,
                body: stream,
                text: async () => "",
            }) as Response) as any;

        await root.execute();

        const events: any[] = [];
        for await (const ev of (resultRoot as any).onEvent) {
            events.push(ev);
        }

        expect(events.length).toBe(2);
        expect(events[0].id).toBe("1");
        expect(events[0].at).toBeInstanceOf(Date);
        expect(events[1].id).toBe("2");
    });

    it("marks operations with text/event-stream as isEventStream in meta", () => {
        const schema = {
            openapi: "3.0.0",
            info: { title: "t", version: "1" },
            paths: {},
            components: { schemas: {} },
        } as unknown as OpenAPI3;

        const operation: OperationObject = {
            responses: {
                "200": {
                    description: "stream",
                    content: {
                        "text/event-stream": {
                            schema: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                },
                            },
                        },
                    },
                },
            },
        };

        const collector = new Collector();
        const meta = gatherMetaForPathOperation(schema, "/stream", "get", operation, {}, collector);
        expect(meta?.isEventStream).toBe(true);
        expect(meta?.responseContentType).toBe("text/event-stream");
    });

    it("does not mark JSON-only operations as event stream", () => {
        const schema = {
            openapi: "3.0.0",
            info: { title: "t", version: "1" },
            paths: {},
            components: { schemas: {} },
        } as unknown as OpenAPI3;

        const operation: OperationObject = {
            responses: {
                "200": {
                    description: "ok",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                },
                            },
                        },
                    },
                },
            },
        };

        const collector = new Collector();
        const meta = gatherMetaForPathOperation(schema, "/json", "get", operation, {}, collector);
        expect(meta?.isEventStream).toBe(false);
        expect(meta?.responseContentType).toBe("application/json");
    });
});

describe("OpenAPI auth pattern (auth / authToken / .auth(source))", () => {
    afterEach(() => {
        resetRootOptions();
    });

    function makeAuthOp(rootOp?: RootOperation) {
        const op = rootOp ?? new RootOperation();
        const root = new OperationSelectionCollector(undefined, undefined, op);
        const rootRef = { ref: root };
        const opCollector = new OperationSelectionCollector("me", rootRef);
        // Field collector must be a child of opCollector (not the same instance)
        const idCollector = new OperationSelectionCollector("id", opCollector);
        const id = new SelectionWrapper("id", "String", 0, undefined as any, idCollector, opCollector);
        opCollector.registerSelection("id", id as any);
        const slw = new SelectionWrapper("me", "User", 0, { id }, opCollector, opCollector);
        slw[ROOT_OP_META] = { path: "/me", method: "get" };
        slw[SLW_OP_PATH] = "me";
        (slw as any).id = id;
        root.registerSelection("me", slw as any);
        opCollector.renderSelections(["me"]);
        return { root, rootOp: op };
    }

    it("uses static authToken from OPTIONS", async () => {
        const { root } = makeAuthOp();
        RootOperation[OPTIONS]._auth_token = "Bearer static";

        const mockFetch = async (_url: string, init?: RequestInit) => {
            expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer static");
            return {
                ok: true,
                json: async () => ({ id: "1" }),
            } as Response;
        };
        RootOperation[OPTIONS].fetcher = mockFetch as any;

        await root.execute();
    });

    it("passes .auth(source) into the global auth resolver", async () => {
        const { root, rootOp } = makeAuthOp();
        const seen: unknown[] = [];
        RootOperation[OPTIONS]._auth_fn = (source) => {
            seen.push(source);
            return typeof source === "string" ? source : "Bearer default";
        };

        RootOperation[OPTIONS].fetcher = (async (_url: string, init?: RequestInit) => {
            expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer from-request");
            return {
                ok: true,
                json: async () => ({ id: "1" }),
            } as Response;
        }) as any;

        rootOp.setAuth("Bearer from-request");
        await root.execute();
        expect(seen).toEqual(["Bearer from-request"]);
    });

    it("isolates concurrent calls with different .auth(source) values", async () => {
        RootOperation[OPTIONS]._auth_fn = (source) =>
            typeof source === "string" ? source : "Bearer default";

        const authHeaders: string[] = [];
        RootOperation[OPTIONS].fetcher = (async (_url: string, init?: RequestInit) => {
            await new Promise((r) => setTimeout(r, 15));
            const auth = (init?.headers as Record<string, string>).Authorization;
            authHeaders.push(auth);
            return {
                ok: true,
                json: async () => ({ id: auth }),
            } as Response;
        }) as any;

        const call = async (token: string) => {
            const { root, rootOp } = makeAuthOp();
            rootOp.setAuth(token);
            await root.execute();
        };

        await Promise.all([call("Bearer user-A"), call("Bearer user-B")]);
        expect(authHeaders).toContain("Bearer user-A");
        expect(authHeaders).toContain("Bearer user-B");
    });

    it("uses per-call string token when no global auth resolver is set", async () => {
        const { root, rootOp } = makeAuthOp();
        RootOperation[OPTIONS].fetcher = (async (_url: string, init?: RequestInit) => {
            expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer direct");
            return {
                ok: true,
                json: async () => ({ id: "1" }),
            } as Response;
        }) as any;

        rootOp.setAuth("Bearer direct");
        await root.execute();
    });

    it("applies auth headers to SSE subscribe as well", async () => {
        const { root, rootOp } = makeAuthOp();
        // mark op as event stream
        const me = root.selections.get("me")!;
        me[ROOT_OP_META] = { path: "/events", method: "get", isEventStream: true };

        RootOperation[OPTIONS]._auth_fn = (source) =>
            typeof source === "string" ? source : "Bearer default";

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(encoder.encode('data: {"id":"1"}\n\n'));
                controller.close();
            },
        });

        RootOperation[OPTIONS].fetcher = (async (_url: string, init?: RequestInit) => {
            expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sse");
            expect((init?.headers as Record<string, string>).Accept).toBe("text/event-stream");
            return {
                ok: true,
                body: stream,
                text: async () => "",
            } as Response;
        }) as any;

        rootOp.setAuth("Bearer sse");
        await root.execute();
    });
});
