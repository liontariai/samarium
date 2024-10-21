import { SelectionWrapper } from "@/graphql/flavors/default/wrapper";
import { makeSLFN, selectScalars } from "../utils";
import {
    type ArgumentsTypeFromFragment,
    type ReturnTypeFromFragment,
    type SLFN,
    type SLWsFromSelection,
} from "../utils/types";

export type ArticleArrayBooksArgs = { language?: string };
export type ArticleArrayRollDiceArgs = { numDice: number; numSides?: number };
export type ArticleBooksArgs = { language?: string };
export type ArticleRollDiceArgs = { numDice: number; numSides?: number };
export type QuerySearchArgs = { title?: string };
export const ArticleArrayBooksArgsMeta = { language: "String" } as const;
export const ArticleArrayRollDiceArgsMeta = {
    numDice: "Int!",
    numSides: "Int",
} as const;
export const ArticleBooksArgsMeta = { language: "String" } as const;
export const ArticleRollDiceArgsMeta = {
    numDice: "Int!",
    numSides: "Int",
} as const;
export const QuerySearchArgsMeta = { title: "String" } as const;

export type BookArraySelectionFields = {
    title?: string;
    author?: string;
};

export type ArticleArraySelectionFields = {
    title?: string;
    publisher?: string;
    books: (args?: ArticleArrayBooksArgs) => typeof BookArraySelection;
    rollDice: (args: ArticleArrayRollDiceArgs) => Array<number>;
};

export type SearchResultArraySelectionFields =
    | BookSelectionFields
    | ArticleSelectionFields;

export type BookSelectionFields = {
    title?: string;
    author?: string;
};

export type ArticleSelectionFields = {
    title?: string;
    publisher?: string;
    books: (args?: ArticleBooksArgs) => typeof BookArraySelection;
    rollDice: (args: ArticleRollDiceArgs) => Array<number>;
};

export type QuerySelectionFields = {
    books: typeof BookArraySelection;
    articles: typeof ArticleArraySelection;
    search: (args?: QuerySearchArgs) => typeof SearchResultArraySelection;
};

export function makeBookArraySelectionInput(this: any) {
    return {
        title: new SelectionWrapper("title", "String", 0, {}, this, undefined),
        author: new SelectionWrapper(
            "author",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
        $scalars: () =>
            selectScalars(
                makeBookArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeBookArraySelectionInput>
            >,
    } as const;
}
export const BookArraySelection = makeSLFN(
    makeBookArraySelectionInput,
    "BookArraySelection",
    "Book",
    1,
);

export function makeArticleArraySelectionInput(this: any) {
    return {
        title: new SelectionWrapper("title", "String", 0, {}, this, undefined),
        publisher: new SelectionWrapper(
            "publisher",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        books: (args: ArticleArrayBooksArgs) =>
            BookArraySelection.bind({
                collector: this,
                fieldName: "books",
                args,
                argsMeta: ArticleArrayBooksArgsMeta,
            }),
        rollDice: (args: ArticleArrayRollDiceArgs) =>
            new SelectionWrapper(
                "rollDice",
                "Int",
                1,
                {},
                this,
                undefined,
                args,
                ArticleArrayRollDiceArgsMeta,
            ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
        $scalars: () =>
            selectScalars(
                makeArticleArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeArticleArraySelectionInput>
            >,
    } as const;
}
export const ArticleArraySelection = makeSLFN(
    makeArticleArraySelectionInput,
    "ArticleArraySelection",
    "Article",
    1,
);

export function makeSearchResultArraySelectionInput(this: any) {
    return {
        $on: {
            Book: BookSelection.bind({
                collector: this,
                fieldName: "",
                onTypeFragment: "Book",
            }),
            Article: ArticleSelection.bind({
                collector: this,
                fieldName: "",
                onTypeFragment: "Article",
            }),
        },
    } as const;
}
export const SearchResultArraySelection = makeSLFN(
    makeSearchResultArraySelectionInput,
    "SearchResultArraySelection",
    "SearchResult",
    1,
);

export function makeBookSelectionInput(this: any) {
    return {
        title: new SelectionWrapper("title", "String", 0, {}, this, undefined),
        author: new SelectionWrapper(
            "author",
            "String",
            0,
            {},
            this,
            undefined,
        ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
        $scalars: () =>
            selectScalars(
                makeBookSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeBookSelectionInput>>,
    } as const;
}
export const BookSelection = makeSLFN(
    makeBookSelectionInput,
    "BookSelection",
    "Book",
    0,
);

export function makeArticleSelectionInput(this: any) {
    return {
        title: new SelectionWrapper("title", "String", 0, {}, this, undefined),
        publisher: new SelectionWrapper(
            "publisher",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        books: (args: ArticleBooksArgs) =>
            BookArraySelection.bind({
                collector: this,
                fieldName: "books",
                args,
                argsMeta: ArticleBooksArgsMeta,
            }),
        rollDice: (args: ArticleRollDiceArgs) =>
            new SelectionWrapper(
                "rollDice",
                "Int",
                1,
                {},
                this,
                undefined,
                args,
                ArticleRollDiceArgsMeta,
            ),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
        $scalars: () =>
            selectScalars(
                makeArticleSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeArticleSelectionInput>
            >,
    } as const;
}
export const ArticleSelection = makeSLFN(
    makeArticleSelectionInput,
    "ArticleSelection",
    "Article",
    0,
);

export function makeQuerySelectionInput(this: any) {
    return {
        books: BookArraySelection.bind({
            collector: this,
            fieldName: "books",
        }) as ReturnType<
            SLFN<
                {},
                ReturnType<typeof makeBookArraySelectionInput>,
                "BookArraySelection",
                "Book",
                1,
                {
                    $lazy: () => Promise<"T">;
                },
                "$lazy"
            >
        >,
        articles: ArticleArraySelection.bind({
            collector: this,
            fieldName: "articles",
        }) as ReturnType<
            SLFN<
                {},
                ReturnType<typeof makeArticleArraySelectionInput>,
                "ArticleArraySelection",
                "Article",
                1,
                {
                    $lazy: () => Promise<"T">;
                },
                "$lazy"
            >
        >,
        search: (args: QuerySearchArgs) =>
            SearchResultArraySelection.bind({
                collector: this,
                fieldName: "search",
                args,
                argsMeta: QuerySearchArgsMeta,
            }) as ReturnType<
                SLFN<
                    {},
                    ReturnType<typeof makeSearchResultArraySelectionInput>,
                    "SearchResultArraySelection",
                    "SearchResult",
                    1,
                    {
                        $lazy: (args: QuerySearchArgs) => Promise<"T">;
                    },
                    "$lazy"
                >
            >,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
        $scalars: () =>
            selectScalars(
                makeQuerySelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeQuerySelectionInput>>,
    } as const;
}
export const QuerySelection = makeSLFN(
    makeQuerySelectionInput,
    "QuerySelection",
    "Query",
    0,
);

export type _RootOperationSelectionFields<T extends object> = {
    query: ReturnType<
        SLFN<
            T,
            ReturnType<typeof makeQuerySelectionInput>,
            "QuerySelection",
            "Query",
            0
        >
    >;
};
export function _makeRootOperationInput(this: any) {
    return {
        query: QuerySelection.bind({
            collector: this,
            isRootType: "Query",
        }),
    } as const;
}
