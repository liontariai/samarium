import { expect, describe, it } from "bun:test";
import { introspectGraphQLSchema } from "./introspect";

describe("introspectGraphQLSchema", () => {
    it("should return a GraphQLSchema object", async () => {
        // Arrange
        const endpoint =
            "https://swapi-graphql.netlify.app/.netlify/functions/index";

        // Act
        const schema = await introspectGraphQLSchema(endpoint);

        // Assert
        expect(schema).toBeDefined();
        expect(schema.constructor.name).toBe("GraphQLSchema");
    });

    it("should throw an error if introspection fails", async () => {
        // Arrange
        const endpoint = "https://invalid-endpoint.com/graphql";

        // Act & Assert
        expect(() => introspectGraphQLSchema(endpoint)).toThrow(
            /(Error introspecting GraphQL schema|Unable to connect. Is the computer able to access the url\?)/,
        );
    });
});
