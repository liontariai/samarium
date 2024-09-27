import "reflect-metadata";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { resolvers } from "@generated/type-graphql";
import { prisma } from "~/db.server";
import express from "express";

let graphQLServer: ApolloServer | null = null;

export async function getGraphQLServer() {
    if (!graphQLServer) {
        const schema = await buildSchema({
            resolvers,
            validate: false,
        });

        graphQLServer = new ApolloServer({
            schema,
            context: () => ({ prisma }),
        });

        await graphQLServer.start();
    }

    return graphQLServer;
}

export async function createGraphQLMiddleware() {
    const app = express();
    const server = await getGraphQLServer();
    server.applyMiddleware({ app, path: "/graphql" });
    return app;
}
