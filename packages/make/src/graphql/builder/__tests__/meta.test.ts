import { expect, describe, it } from "bun:test";
import { gatherMeta, gatherMetaForType } from "../meta";
import { GraphQLSchema, GraphQLObjectType, GraphQLInterfaceType, GraphQLNonNull, GraphQLString } from "graphql";
import { Collector } from "../collector";
import { introspectGraphQLSchema } from "./util";

describe("gatherMetaForType", () => {
    // it("should gather meta for a whole schema", async () => {
    //     // Arrange
    //     const schema = await introspectGraphQLSchema(
    //         "http://localhost:4000/graphql",
    //     );
    //     const collector = new Collector("Query", "Mutation", "Subscription");
    //     // Act
    //     const meta = gatherMeta(schema, {}, collector);

    //     console.log(meta);
    // });

    it("should gather meta for object types", () => {
        // Arrange
        const schema = new GraphQLSchema({
            query: new GraphQLObjectType({
                name: "Query",
                fields: {
                    user: {
                        type: new GraphQLObjectType({
                            name: "User",
                            fields: {
                                id: { type: new GraphQLNonNull(GraphQLString) },
                                name: { type: GraphQLString },
                            },
                        }),
                    },
                },
            }),
        });
        const collector = new Collector("Query", "Mutation", "Subscription");

        const type = schema.getType("User");

        // Act
        const meta = gatherMetaForType(schema, type!, {}, collector);

        // Assert
        expect(meta.isObject).toBe(true);
        expect(meta.fields.length).toBe(2);
        expect(meta.fields[0].name).toBe("id");
        // expect(meta.fields[0].type).toBe("GraphQLNonNull(GraphQLString)");
        expect(meta.fields[1].name).toBe("name");
        // expect(meta.fields[1].type).toBe("GraphQLString");
    });

    it("should gather meta for interface types", () => {
        // Arrange
        const schema = new GraphQLSchema({
            query: new GraphQLObjectType({
                name: "Query",
                fields: {
                    user: {
                        type: new GraphQLInterfaceType({
                            name: "User",
                            fields: {
                                id: { type: new GraphQLNonNull(GraphQLString) },
                                name: { type: GraphQLString },
                            },
                        }),
                    },
                },
            }),
        });
        const collector = new Collector("Query", "Mutation", "Subscription");

        const type = schema.getType("User");

        // Act
        const meta = gatherMetaForType(schema, type!, {}, collector);

        // Assert
        expect(meta.isInterface).toBe(true);
        expect(meta.fields.length).toBe(2);
        expect(meta.fields[0].name).toBe("id");
        // expect(meta.fields[0].type).toBe("GraphQLNonNull(GraphQLString)");
        expect(meta.fields[1].name).toBe("name");
        // expect(meta.fields[1].type).toBe("GraphQLString");
    });

    // Add more test cases for other types...
});
