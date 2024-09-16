import {
    SelectionWrapper,
    SLW_DIRECTIVE,
    SLW_DIRECTIVE_ARGS,
    SLW_DIRECTIVE_ARGS_META,
} from "@/lib/codegen/flavors/default/wrapper";
import { makeSLFN, selectScalars } from "../utils";
import {
    type ArgumentsTypeFromFragment,
    type ReturnTypeFromFragment,
    type SLFN,
    type SLWsFromSelection,
} from "../utils/types";

export type Directive_tagArgs = {
    /** tag? */
    tag?: string;
};
export type Directive_includeArgs = {
    /** Included when true. */
    if: boolean;
};
export type Directive_skipArgs = {
    /** Skipped when true. */
    if: boolean;
};
export type ArticleArrayBooksArgs = {
    language?: string;
};
export type ArticleArrayRollDiceArgs = {
    numDice: number;
    numSides?: number;
};
export type ArticleBooksArgs = {
    language?: string;
};
export type ArticleRollDiceArgs = {
    numDice: number;
    numSides?: number;
};
export type QuerySearchArgs = {
    title?: string;
};
export const Directive_tagArgsMeta = { tag: "String" } as const;
export const Directive_includeArgsMeta = { if: "Boolean!" } as const;
export const Directive_skipArgsMeta = { if: "Boolean!" } as const;
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

type ReturnTypeFromQuerySelection = {
    books: ReturnType<
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
    >;
    articles: ReturnType<
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
    >;
    search: (args: QuerySearchArgs) => ReturnType<
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
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeQuerySelectionInput(
    this: any,
): ReturnTypeFromQuerySelection {
    return {
        books: BookArraySelection.bind({ collector: this, fieldName: "books" }),
        articles: ArticleArraySelection.bind({
            collector: this,
            fieldName: "articles",
        }),
        search: (args: QuerySearchArgs) =>
            SearchResultArraySelection.bind({
                collector: this,
                fieldName: "search",
                args,
                argsMeta: QuerySearchArgsMeta,
            }),

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: this,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,
    } as const;
}
export const QuerySelection = makeSLFN(
    makeQuerySelectionInput,
    "QuerySelection",
    "Query",
    0,
);

export const _directive_tag =
    (args: Directive_tagArgs) =>
    <F>(f: F) => {
        (f as any)[SLW_DIRECTIVE] = "tag";
        (f as any)[SLW_DIRECTIVE_ARGS] = args;
        (f as any)[SLW_DIRECTIVE_ARGS_META] = Directive_tagArgsMeta;
        return f;
    };

export const _directive_include =
    (args: Directive_includeArgs) =>
    <F>(f: F) => {
        (f as any)[SLW_DIRECTIVE] = "include";
        (f as any)[SLW_DIRECTIVE_ARGS] = args;
        (f as any)[SLW_DIRECTIVE_ARGS_META] = Directive_includeArgsMeta;
        return f;
    };

export const _directive_skip =
    (args: Directive_skipArgs) =>
    <F>(f: F) => {
        (f as any)[SLW_DIRECTIVE] = "skip";
        (f as any)[SLW_DIRECTIVE_ARGS] = args;
        (f as any)[SLW_DIRECTIVE_ARGS_META] = Directive_skipArgsMeta;
        return f;
    };

export const $directives = {
    tag: _directive_tag,
    include: _directive_include,
    skip: _directive_skip,
} as const;
export function _makeRootOperationInput(this: any) {
    return {
        query: QuerySelection.bind({
            collector: this,
            isRootType: "Query",
        }),

        $directives,
    } as const;
}
