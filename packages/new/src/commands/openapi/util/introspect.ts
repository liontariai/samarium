import { type OpenAPI3 } from "openapi-typescript";

/**
 * Introspects an OpenAPI schema from a given endpoint and returns an OpenAPI3 object.
 *
 * @param endpoint The OpenAPI endpoint URL.
 * @returns A Promise that resolves to the OpenAPI3 object.
 */
export async function introspectOpenAPISchema(
    endpoint: string,
    headers?: string[],
): Promise<OpenAPI3> {
    const response = await fetch(endpoint, {
        headers: headers?.map(
            (header) => header.split("=") as [string, string],
        ),
    });
    const schema = await response.json();
    return schema;
}
