import {
    OPTIONS,
    RootOperation,
    SelectionWrapper,
    SLW_DIRECTIVE,
    SLW_DIRECTIVE_ARGS,
    SLW_DIRECTIVE_ARGS_META,
} from "@/graphql/flavors/default/wrapper";
import { makeSLFN, selectScalars } from "../utils";
import {
    type ArgumentsTypeFromFragment,
    type ReturnTypeFromFragment,
    type ScalarTypeMapDefault,
    type ScalarTypeMapWithCustom,
    type SLFN,
    type SLWsFromSelection,
} from "../utils/types";

export type Directive_includeArgs = {
    /** Included when true. */
    if: boolean;
};
export type Directive_skipArgs = {
    /** Skipped when true. */
    if: boolean;
};
export const Directive_includeArgsMeta = { if: "Boolean!" } as const;
export const Directive_skipArgsMeta = { if: "Boolean!" } as const;

type ReturnTypeFromQuerySelection = {
    date: SelectionWrapper<"date", "DateTime", 0, {}, undefined>;
    dates: SelectionWrapper<"dates", "DateTime", 1, {}, undefined>;
    nestedDates: SelectionWrapper<"nestedDates", "DateTime", 2, {}, undefined>;
    nestedDates2: SelectionWrapper<
        "nestedDates2",
        "DateTime",
        3,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeQuerySelectionInput>
    >;
};

export function makeQuerySelectionInput(
    this: any,
): ReturnTypeFromQuerySelection {
    return {
        date: new SelectionWrapper("date", "DateTime", 0, {}, this, undefined),
        dates: new SelectionWrapper(
            "dates",
            "DateTime",
            1,
            {},
            this,
            undefined,
        ),
        nestedDates: new SelectionWrapper(
            "nestedDates",
            "DateTime",
            2,
            {},
            this,
            undefined,
        ),
        nestedDates2: new SelectionWrapper(
            "nestedDates2",
            "DateTime",
            3,
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

export const init = (options: {
    headers?: { [key: string]: string };
    scalars?: {
        [key in keyof ScalarTypeMapDefault]?: (
            v: string,
        ) => ScalarTypeMapDefault[key];
    } & {
        [key in keyof ScalarTypeMapWithCustom]?: (
            v: string,
        ) => ScalarTypeMapWithCustom[key];
    };
}) => {
    if (options.headers) {
        RootOperation[OPTIONS].headers = {
            ...RootOperation[OPTIONS].headers,
            ...options.headers,
        };
    }
    if (options.scalars) {
        RootOperation[OPTIONS].scalars = {
            ...RootOperation[OPTIONS].scalars,
            ...options.scalars,
        };
    }
};
