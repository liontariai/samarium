import "reflect-metadata";
import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { buildSchema } from "type-graphql";
import { resolvers } from "@generated/type-graphql";
import { prisma } from "@/db.server";

let graphQLServer: ReturnType<typeof createServer> | null = null;

export async function getGraphQLServer() {
    if (!graphQLServer) {
        const schema = await buildSchema({
            resolvers,
            validate: false,
        });

        const yoga = createYoga({
            schema,
            context: () => {
                return { prisma };
            },
        });
        graphQLServer = createServer(yoga);
    }

    return graphQLServer;
}

export async function startGraphQLServer() {
    if (graphQLServer) {
        return;
    }
    const server = await getGraphQLServer();
    server
        .listen(4000, () => {
            console.log("Server is running on http://localhost:4000/graphql");
        })
        .on("error", (err) => {
            console.error(err);
        });
}
