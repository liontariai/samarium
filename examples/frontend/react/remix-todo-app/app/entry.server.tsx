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
import { startGraphQLServer } from "./server/graphql.server";

const ABORT_DELAY = 5000;

let started = false;
if (!started) {
    started = true;
    startGraphQLServer().catch((err) => {
        console.error(err);
    });
}

export default async function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    remixContext: EntryContext,
) {
    const callbackName = isbot(request.headers.get("user-agent"))
        ? "onAllReady"
        : "onShellReady";

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
