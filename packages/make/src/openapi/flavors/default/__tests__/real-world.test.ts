import { afterEach, describe, expect, it } from "bun:test";
import path from "node:path";
import { OPTIONS, ROOT_OP_COLLECTOR, RootOperation } from "@/openapi/flavors/default/wrapper";
import { rootSLWFactory } from "./utils";
import { collectCriticalTypeErrors } from "./utils/typecheck";
import * as examplesTestapi from "./examples/testapi.generated";
import * as examplesReelgood from "./examples/reelgood.generated";
import * as examplesSpotify from "./examples/spotify.generated";
import * as examplesThingsboard from "./examples/thingsboard.generated";

const EXAMPLES_DIR = path.join(import.meta.dir, "examples");

function resetSdkOptions() {
    RootOperation[OPTIONS].fetcher = undefined as any;
    RootOperation[OPTIONS].sseFetchTransform = undefined as any;
    RootOperation[OPTIONS]._auth_fn = undefined;
    RootOperation[OPTIONS]._auth_token = undefined;
    RootOperation[OPTIONS].headers = {};
    RootOperation.authHeaderName = "Authorization";
}

function installMockFetch(data: unknown = { mockData: "test" }) {
    const mockFetch = async () =>
        ({
            ok: true,
            json: async () => data,
            text: async () => "",
        }) as Response;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const wrapped = async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        return mockFetch();
    };
    RootOperation[OPTIONS].fetcher = wrapped as any;
    return { calls, fetcher: wrapped };
}

function expectGeneratedClient(mod: { default: any; _makeRootOperationInput: (...args: any) => any }) {
    expect(typeof mod._makeRootOperationInput).toBe("function");
    expect(typeof mod.default).toBe("function");
    expect(typeof mod.default.init).toBe("function");
}

describe("real-world OpenAPI schemas", () => {
    afterEach(() => {
        resetSdkOptions();
    });

    describe("testapi (Elysia)", () => {
        it("generates a client without critical type errors", () => {
            expectGeneratedClient(examplesTestapi);
            expect(collectCriticalTypeErrors(path.join(EXAMPLES_DIR, "testapi.generated.ts"))).toEqual([]);
        });

        it("executes path-param and scalar operations", async () => {
            const { calls } = installMockFetch("hello");
            const slw = rootSLWFactory(examplesTestapi._makeRootOperationInput, (op) => ({
                index: op.getIndex(),
                hello: op.postHelloById({ id: "abc" }),
                helloObject: op.postHelloObjectById({ id: "xyz" })(({ message }) => ({ message })),
            }));

            const result = await slw[ROOT_OP_COLLECTOR]!.ref.execute();
            expect(calls.map((c) => [c.url, c.init?.method])).toEqual(
                expect.arrayContaining([
                    ["[ENDPOINT]/", "get"],
                    ["[ENDPOINT]/hello/abc", "post"],
                    ["[ENDPOINT]/helloobject/xyz", "post"],
                ]),
            );
            expect(result).toEqual({
                index: "hello",
                hello: "hello",
                helloObject: "hello",
            });
        });
    });

    describe("reelgood", () => {
        it("generates a client without critical type errors", () => {
            expectGeneratedClient(examplesReelgood);
            expect(collectCriticalTypeErrors(path.join(EXAMPLES_DIR, "reelgood.generated.ts"))).toEqual([]);
        });

        it("lets a user JToken augmentation override the any default", () => {
            expect(
                collectCriticalTypeErrors(path.join(import.meta.dir, "scalar-override.check.ts")),
            ).toEqual([]);
        });

        it("fetches a movie by id and applies the x-api-key auth header", async () => {
            const movie = {
                id: "11111111-1111-1111-1111-111111111111",
                title: "Heat",
            };
            const { calls } = installMockFetch(movie);
            examplesReelgood.default.init({
                fetcher: RootOperation[OPTIONS].fetcher,
                authToken: "rg-test-key",
            });

            const { movie: retrieved } = await examplesReelgood.default((op) => ({
                movie: op.GetV1_0ContentMovieById({
                    id: movie.id,
                    region: "us",
                })(({ id, title }) => ({ id, title })),
            }));

            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe(`[ENDPOINT]/v1.0/content/movie/${movie.id}?region=us`);
            expect(calls[0].init?.method).toBe("get");
            expect((calls[0].init?.headers as Record<string, string>)["x-api-key"]).toBe("rg-test-key");
            expect(retrieved.title).toBe("Heat");
            expect(retrieved.id).toBe(movie.id);
        });

        it("searches content with query args", async () => {
            const { calls } = installMockFetch([{ title: "Heat" }]);
            const slw = rootSLWFactory(examplesReelgood._makeRootOperationInput, (op) => ({
                hits: op.GetV1_0ContentSearch({ term: "heat", region: "us" })(({ $scalars }) => ({
                    ...$scalars(),
                })),
            }));

            await slw[ROOT_OP_COLLECTOR]!.ref.execute();
            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe("[ENDPOINT]/v1.0/content/search?term=heat&region=us");
            expect(calls[0].init?.method).toBe("get");
        });
    });

    describe("spotify", () => {
        it("generates a client without critical type errors", () => {
            expectGeneratedClient(examplesSpotify);
            expect(collectCriticalTypeErrors(path.join(EXAMPLES_DIR, "spotify.generated.ts"))).toEqual([]);
        });

        it("lists available markets", async () => {
            const { calls } = installMockFetch({ markets: ["US", "GB"] });
            examplesSpotify.default.init({
                fetcher: RootOperation[OPTIONS].fetcher,
                authToken: "Bearer spotify-token",
            });

            const { markets } = await examplesSpotify.default((op) => ({
                markets: op.get_available_markets()(({ markets }) => ({ markets })),
            }));

            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe("[ENDPOINT]/markets");
            expect(calls[0].init?.method).toBe("get");
            expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer spotify-token");
            expect(Array.from(markets.markets)).toEqual(["US", "GB"]);
        });

        it("fetches an album (catalog operation + path/query args)", async () => {
            const { calls } = installMockFetch({ id: "4aawyAB9vmqN3uQ7FjRGTy", name: "Global Warming" });
            const slw = rootSLWFactory(examplesSpotify._makeRootOperationInput, (op) => ({
                album: op.get_an_album({ PathAlbumId: "4aawyAB9vmqN3uQ7FjRGTy", QueryMarket: "US" }),
            }));

            const result = await slw[ROOT_OP_COLLECTOR]!.ref.execute();
            expect(calls).toHaveLength(1);
            // $ref parameters currently keep the component key (PathAlbumId) as a query
            // arg; the `{id}` path slot is not bound, so it stringifies as "undefined".
            expect(calls[0].url).toBe(
                "[ENDPOINT]/albums/undefined?PathAlbumId=4aawyAB9vmqN3uQ7FjRGTy&QueryMarket=US",
            );
            expect(calls[0].init?.method).toBe("get");
            expect(result.album).toEqual({ id: "4aawyAB9vmqN3uQ7FjRGTy", name: "Global Warming" });
        });
    });

    describe("thingsboard", () => {
        it("generates a client without critical type errors", () => {
            expectGeneratedClient(examplesThingsboard);
            expect(collectCriticalTypeErrors(path.join(EXAMPLES_DIR, "thingsboard.generated.ts"))).toEqual([]);
        }, 180_000);

        it("reads admin feature flags", async () => {
            const { calls } = installMockFetch({
                smsEnabled: true,
                emailEnabled: true,
            });
            examplesThingsboard.default.init({
                fetcher: RootOperation[OPTIONS].fetcher,
                authToken: "Bearer jwt",
            });

            const { flags } = await examplesThingsboard.default((op) => ({
                flags: op.getFeaturesInfo()(({ smsEnabled, emailEnabled }) => ({
                    smsEnabled,
                    emailEnabled,
                })),
            }));

            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe("[ENDPOINT]/api/admin/featuresInfo");
            expect(calls[0].init?.method).toBe("get");
            expect((calls[0].init?.headers as Record<string, string>)["X-Authorization"]).toBe("Bearer jwt");
            expect(flags.smsEnabled).toBe(true);
            expect(flags.emailEnabled).toBe(true);
        });

        it("posts a login body and selects the JWT fields", async () => {
            const { calls } = installMockFetch({
                token: "jwt-1",
                refreshToken: "refresh-1",
            });

            const { session } = await examplesThingsboard.default((op) => ({
                session: op.CreateApiAuthLogin({
                    username: "tenant@example.com",
                    password: "secret",
                })(({ token, refreshToken }) => ({ token, refreshToken })),
            }));

            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe("[ENDPOINT]/api/auth/login");
            expect(calls[0].init?.method).toBe("post");
            expect(calls[0].init?.body).toBe(
                JSON.stringify({
                    username: "tenant@example.com",
                    password: "secret",
                }),
            );
            expect(session.token).toBe("jwt-1");
            expect(session.refreshToken).toBe("refresh-1");
        });
    });
});
