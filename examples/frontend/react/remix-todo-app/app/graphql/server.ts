import "reflect-metadata";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { resolvers } from "@generated/type-graphql";
import { prisma } from "../db.server";

export async function createGraphQLServer() {
    const schema = await buildSchema({
        resolvers,
        validate: false,
    });

    const server = new ApolloServer({
        schema,
        context: () => ({ prisma }),
    });

    return server;
}
