/**
 * By default, Remix will handle generating the HTTP Response for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.server
 */

import { PassThrough } from "stream";
import type { EntryContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import isbot from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { createGraphQLMiddleware } from "./server/graphql.server";
import type { Request as ExpressRequest } from "express";

const ABORT_DELAY = 5000;

export default async function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    remixContext: EntryContext,
) {
    const callbackName = isbot(request.headers.get("user-agent"))
        ? "onAllReady"
        : "onShellReady";

    // Create GraphQL middleware
    const graphQLMiddleware = await createGraphQLMiddleware();

    return new Promise((resolve, reject) => {
        let didError = false;

        const { pipe, abort } = renderToPipeableStream(
            <RemixServer context={remixContext} url={request.url} />,
            {
                [callbackName]: () => {
                    const body = new PassThrough();

                    responseHeaders.set("Content-Type", "text/html");

                    const readable = new ReadableStream({
                        start(controller) {
                            body.on("data", (chunk) =>
                                controller.enqueue(chunk),
                            );
                            body.on("end", () => controller.close());
                            body.on("error", (err) => controller.error(err));
                        },
                    });

                    resolve(
                        new Response(readable, {
                            headers: responseHeaders,
                            status: didError ? 500 : responseStatusCode,
                        }),
                    );

                    pipe(body);
                },
                onShellError: (err: unknown) => {
                    reject(err);
                },
                onError: (error: unknown) => {
                    didError = true;

                    console.error(error);
                },
            },
        );

        setTimeout(abort, ABORT_DELAY);
    });
}

export async function handleDataRequest(request: Request) {
    const graphQLMiddleware = await createGraphQLMiddleware();
    return new Promise((resolve, reject) => {
        let responseBody = "";
        graphQLMiddleware(
            request as unknown as ExpressRequest,
            {
                setHeader: () => {},
                write: (chunk: string) => {
                    responseBody += chunk;
                },
                end: (chunk?: string) => {
                    if (chunk) {
                        responseBody += chunk;
                    }
                    resolve(
                        new Response(responseBody, {
                            headers: { "Content-Type": "application/json" },
                        }),
                    );
                },
            } as any,
            (error: any) => {
                if (error) {
                    reject(error);
                }
            },
        );
    });
}
