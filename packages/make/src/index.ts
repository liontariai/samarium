import * as GraphQL from "./graphql/flavors/default/generator-flavor";
import * as OpenAPI from "./openapi/flavors/default/generator-flavor";

export * as GraphQLGenerator from "./graphql/builder/generator";
export * as OpenAPIGenerator from "./openapi/builder/generator";

export const Flavors = {
    GraphQL: {
        default: GraphQL.GeneratorSelectionTypeFlavorDefault,
    },
    OpenAPI: {
        default: OpenAPI.GeneratorSelectionTypeFlavorDefault,
    },
};
