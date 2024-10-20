import type { GraphQLSchema, IntrospectionQuery } from "graphql";
import { getIntrospectionQuery, buildClientSchema } from "graphql";
import { GraphQLClient } from "graphql-request";
import { type OpenAPI3 } from "openapi-typescript";

/**
 * Introspects a GraphQL service using 'graphql-request' and returns a GraphQLSchema object.
 *
 * @param endpoint The GraphQL endpoint URL.
 * @returns A Promise that resolves to the GraphQLSchema object.
 */
export async function introspectGraphQLSchema(
    endpoint: string,
    headers?: string[],
): Promise<GraphQLSchema> {
    try {
        // Create a GraphQL client with the 'graphql-request' library
        const client = new GraphQLClient(endpoint);

        // Send the introspection query using the client
        const introspectionResult = await client.request<IntrospectionQuery>(
            getIntrospectionQuery(),
            undefined,
            new Headers(
                headers?.map((header) => header.split("=") as [string, string]),
            ),
        );

        // Build a GraphQLSchema object from the introspection result
        const schema = buildClientSchema(introspectionResult);

        return schema;
    } catch (error: any) {
        // throw the error to the caller
        throw error;
    }
}

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
