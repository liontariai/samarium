import { GeneratorSelectionTypeFlavorDefault } from "./graphql/flavors/default/generator-flavor";

export { Generator } from "./graphql/builder/generator";

export const Flavors = {
    default: GeneratorSelectionTypeFlavorDefault,
} as const;
