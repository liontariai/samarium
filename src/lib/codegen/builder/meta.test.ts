import { expect, describe, it } from "bun:test";
import { gatherMetaForType } from "./meta";
import {
    GraphQLSchema,
    GraphQLObjectType,
    GraphQLInterfaceType,
    GraphQLUnionType,
    GraphQLEnumType,
    GraphQLInputObjectType,
    GraphQLList,
    GraphQLNonNull,
    GraphQLScalarType,
    GraphQLString,
} from "graphql";

describe("gatherMetaForType", () => {
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

        const type = schema.getType("User");

        // Act
        const meta = gatherMetaForType(schema, type!, {});

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

        const type = schema.getType("User");

        // Act
        const meta = gatherMetaForType(schema, type!, {});

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
