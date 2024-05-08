import { GeneratorSelectionTypeFlavorDefault } from "./flavors/default/generator-flavor";

export { Generator } from "./builder/generator";

export const Flavors = {
    default: GeneratorSelectionTypeFlavorDefault,
} as const;
