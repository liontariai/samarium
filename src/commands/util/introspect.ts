import type { GraphQLSchema, IntrospectionQuery } from "graphql";
import { getIntrospectionQuery, buildClientSchema } from "graphql";
import { GraphQLClient } from "graphql-request";

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
        // Handle any errors that may occur during introspection
        throw new Error(`Error introspecting GraphQL schema: ${error.message}`);
    }
}
