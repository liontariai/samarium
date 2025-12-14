import { SelectionWrapper } from "@/graphql/flavors/default/wrapper";
import { makeSLFN } from "../utils";

export function makeBookArraySelectionInput(this: any) {
    return {
        title: new SelectionWrapper("title", "String", 0, {}, this, undefined),
        author: new SelectionWrapper("author", "String", 0, {}, this, undefined),
    } as const;
}
export const BookArraySelection = makeSLFN(makeBookArraySelectionInput, "BookArraySelection", "Book", 1);
export function makeQuerySelectionInput(this: any) {
    return {
        books: BookArraySelection.bind({
            collector: this,
            fieldName: "books",
        }),
    } as const;
}
export const QuerySelection = makeSLFN(makeQuerySelectionInput, "QuerySelection", "Query", 0);
export type MutationCreateBooksArgs = {
    titles: string[];
    authors: string[];
};
export const MutationCreateBooksArgsMeta = {
    titles: "[String]!",
    authors: "[String]!",
};
export function makeMutationSelectionInput(this: any) {
    return {
        createBooks: (args: MutationCreateBooksArgs) =>
            BookArraySelection.bind({
                collector: this,
                fieldName: "createBooks",
                args,
                argsMeta: MutationCreateBooksArgsMeta,
            }),
    } as const;
}
export const MutationSelection = makeSLFN(makeMutationSelectionInput, "MutationSelection", "Mutation", 0);

export function _makeRootOperationInput(this: any) {
    return {
        query: QuerySelection.bind({
            collector: this,
            isRootType: "Query",
        }),
        mutation: MutationSelection.bind({
            collector: this,
            isRootType: "Mutation",
        }),
    } as const;
}
