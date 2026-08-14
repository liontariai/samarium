import { GeneratorSelectionTypeFlavor } from "../../builder/base";
import type { Collector } from "../../builder/collector";
import {
    type CodegenOptions,
    type TypeMeta,
    type FieldMeta,
    type OperationMeta,
    type ParameterMeta,
} from "../../builder/meta";

// @ts-ignore
import wrapperCode from "./wrapper.ts" with { type: "text" };

const TS_TYPE_INTRINSICS = new Set([
    "string",
    "number",
    "boolean",
    "any",
    "unknown",
    "never",
    "void",
    "object",
    "undefined",
    "null",
    "Record",
    "Array",
    "Date",
    "Promise",
    "Map",
    "Set",
    "Readonly",
    "Partial",
    "Required",
    "Pick",
    "Omit",
]);

/**
 * Named types referenced by a custom-scalar TS type that are not themselves
 * generated (e.g. Reelgood `JToken`). Do **not** put `JToken: any` on
 * `ScalarTypeMapWithCustom` — declaration merging would keep `any`
 * (`any & AnotherType` is `any`). Emit a type alias that is `any` only when
 * the user has not augmented the interface.
 */
function unresolvedTypeNamesInCustomScalars(customScalars: TypeMeta[]): string[] {
    const declared = new Set(
        customScalars.map((cs) => cs.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")),
    );
    const unresolved = new Set<string>();
    const ident = /\b([A-Za-z_$][\w$]*)\b/g;
    for (const cs of customScalars) {
        const tsType = cs.scalarTSType ?? "";
        for (const match of tsType.matchAll(ident)) {
            const name = match[1];
            if (TS_TYPE_INTRINSICS.has(name) || declared.has(name)) continue;
            unresolved.add(name);
        }
    }
    return [...unresolved];
}

/**
 * Default selection type flavor implementation.
 * A selection type flavor is a class that generates the code for a selection type.
 * A selection type is a way to select the fields of a GraphQL type via typescript code.
 * For example, for the following GraphQL type:
 * ```graphql
 * type User {
 *    id: ID
 *    name: String
 * }
 * ```
 * The selection type would be:
 * ```typescript
 * export type UserSelectionFields = {
 *    id?: string;
 *    name?: string;
 * };
 * ```
 * The selection type flavor is responsible for generating the code for the selection type.
 * The selection type flavor is also responsible for generating the code for the selection function.
 * The selection function is a function that takes a function that takes a selection type and returns a value.
 * For the above example, the selection function would be:
 * The selection function would be:
 * ```typescript
 * export function makeUserSelectionInput(this: any) {
 *     return {
 *         id: new SelectionWrapper("id", "ID", {}, this),
 *         name: new SelectionWrapper("name", "String", {}, this),
 *     } as const;
 * }
 * export function UserSelection<T extends object, F extends UserSelectionFields>(
 *     this: any,
 *     s: (selection: F) => T
 * ) {
 *     let parent: SelectionFnParent = this ?? {
 *         collector: new OperationSelectionCollector(),
 *     };
 *     function innerFn(this: any) {
 *         const selection: F = makeUserSelectionInput.bind(this)() as any;
 *         const r = s(selection);
 *         const result = new SelectionWrapper(
 *             parent?.fieldName,
 *             "User",
 *             r,
 *             this,
 *             parent?.collector,
 *             parent?.args,
 *             parent?.argsMeta
 *         ) as unknown as T;
 *         Object.keys(r).forEach((key) => (result as T)[key as keyof T]);
 *         return result;
 *     }
 *     return innerFn.bind(
 *         new OperationSelectionCollector("UserSelection", parent?.collector)
 *     )();
 * }
 * ```
 * The selection function is used to select the fields of a GraphQL type.
 * For the above example, the selection function would be used as follows:
 * The selection function would be used as follows:
 * ```typescript
 * const user = UserSelection(({
 *     id, name
 * }) => ({
 *     id,
 *     name
 * }));
 * ```
 * The result of the selection function is a value that contains the selected fields.
 * For the above example, the result would be:
 * ```typescript
 * {
 * id: string;
 * name: string;
 * }
 * ```
 */
export class GeneratorSelectionTypeFlavorDefault extends GeneratorSelectionTypeFlavor {
    public static ScalarTypeMap: Map<string, string> = new Map([
        ["String", "string"],
        ["Int", "number"],
        ["Float", "number"],
        ["Boolean", "boolean"],
        ["ID", "string"],
        ["Date", "Date"],
        ["DateTime", "Date"],
        ["DateTimeISO", "Date"],
        ["Time", "Date"],
        ["JSON", "Record<string, any>"],
    ]);
    public ScalarTypeMap: () => Map<string, string> = () =>
        new Map([
            ...[...GeneratorSelectionTypeFlavorDefault.ScalarTypeMap.entries()],
            // ...[...this.collector.customScalars.values()].map(
            //     (cs) => [cs.name, cs.scalarTSType!] as const,
            // ),
        ]);

    public static readonly FieldValueWrapperType = wrapperCode;

    /**
     * Import preamble used when `generate({ runtime: "external" })` is set.
     * Tests share one wrapper module instance so traps and symbol identity work.
     */
    public static ExternalRuntimePreamble(wrapperModule: string): string {
        return `
// @samarium-runtime external — runtime is not inlined; imported for testability
import {
    _,
    OPTIONS,
    RootOperation,
    OperationSelectionCollector,
    type OperationSelectionCollectorRef,
    type AuthSource,
    type AuthResolver,
    type AuthResult,
    proxify,
    SelectionWrapperImpl,
    SelectionWrapper,
    SLW_UID,
    SLW_FIELD_NAME,
    SLW_FIELD_TYPENAME,
    SLW_FIELD_ARR_DEPTH,
    ROOT_OP_META,
    SLW_VALUE,
    SLW_ARGS,
    SLW_ARGS_META,
    SLW_PARENT_SLW,
    SLW_LAZY_FLAG,
    OP,
    ROOT_OP_COLLECTOR,
    SLW_PARENT_COLLECTOR,
    SLW_COLLECTOR,
    SLW_OP_PATH,
    SLW_REGISTER_PATH,
    SLW_RENDER_WITH_ARGS,
    SLW_OP_RESULT_DATA_OVERRIDE,
    SLW_RECREATE_VALUE_CALLBACK,
    SLW_NEEDS_CLONE,
    SLW_CLONE,
    SLW_IS_ASYNC_ITERABLE,
    OP_SCALAR_RESULT,
    SLW_IS_SCALAR_OP,
} from "${wrapperModule}";
`;
    }

    public static EnumTypesMapped = (collector: Collector) => {
        return `export interface EnumTypesMapped {
            ${Array.from(collector.enumsTypes.keys())
                .map((k) => k.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", ""))
                .filter((k, i, arr) => arr.indexOf(k) === i)
                .map((k) => `"${k}": ${k},`)
                .join("\n")}
        };`;
    };
    public static UnionTypesMapped = (collector: Collector) => {
        return `export interface UnionTypesMapped {
            ${Array.from(collector.types.entries())
                .filter(([_, t]) => t.isUnion)
                .map(([name, t]) => [name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", ""), t] as const)
                .filter(([k, _], i, arr) => arr.map(([k2]) => k2).indexOf(k) === i)
                .map(([k, t]) => `"${k}": ${k}${t.isList && !t.isInput ? "Array" : ""};`)
                .filter((k, i, arr) => arr.indexOf(k) === i)
                .join("\n")}
        };`;
    };

    public static readonly HelperTypes = (customScalars: TypeMeta[]) => {
        const unresolved = unresolvedTypeNamesInCustomScalars(customScalars);
        const interfaceBody = customScalars.map((cs) => `"${cs.name}": ${cs.scalarTSType};`).join("\n");
        // User `declare module` entries on ScalarTypeMapWithCustom win over the any default.
        const unresolvedAliases = unresolved.length
            ? `    type CustomScalarOrAny<K extends string> = K extends keyof ScalarTypeMapWithCustom
        ? ScalarTypeMapWithCustom[K]
        : any;
${unresolved.map((name) => `    export type ${name} = CustomScalarOrAny<"${name}">;`).join("\n")}`
            : "";
        return `
    export interface ScalarTypeMapWithCustom {
        ${interfaceBody}
    }
${unresolvedAliases}
    export interface ScalarTypeMapDefault {
        ${Array.from(GeneratorSelectionTypeFlavorDefault.ScalarTypeMap)
            .map(([k, v]) => `"${k}": ${v};`)
            .join("\n")}
    };

    type SelectionFnParent = {
        collector: OperationSelectionCollector | OperationSelectionCollectorRef;
        fieldName?: string;
        opPath?: string;
        method?: "get" | "post" | "put" | "delete" | "patch" | "head" | "options" | "trace";
        isEventStream?: boolean;
        args?: Record<string, any>;
        argsMeta?: Record<string, { type: string; location: "path" | "query" | "header" | "cookie" | "body" }>;
        tnp?: string;
    } | undefined;

    type CleanupNever<A> = Omit<A, keyof A> & {
        [K in keyof A as A[K] extends never ? never : K]: A[K];
    };
    type Prettify<T> = {
        [K in keyof T]: T[K];
    } & {};

    type SLWsFromSelection<
        S,
        R = {
            [K in keyof S]: S[K] extends SelectionWrapperImpl<
                infer FN,
                infer TNP,
                infer TAD
            >
                ? S[K]
                : never;
        },
    > = Prettify<CleanupNever<R>>;
    type ReturnTypeFromFragment<T> = T extends (
        this: any,
        ...args: any[]
    ) => infer R
        ? R
        : never;
    type ArgumentsTypeFromFragment<T> = T extends (
        this: any,
        ...args: infer A
    ) => any
        ? A
        : never;

    type ReplaceReturnType<T, R> = T extends (...a: any) => any
    ? (
          ...a: Parameters<T>
      ) => ReturnType<T> extends Promise<any> ? Promise<R> : R
    : never;
    type SLW_TPN_ToType<TNP> = TNP extends keyof ScalarTypeMapWithCustom
        ? ScalarTypeMapWithCustom[TNP]
        : TNP extends keyof ScalarTypeMapDefault
        ? ScalarTypeMapDefault[TNP]
        : TNP extends keyof EnumTypesMapped
        ? EnumTypesMapped[TNP]
        : TNP extends keyof UnionTypesMapped
        ? UnionTypesMapped[TNP]
        : never;
    type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ...0[]];
    type ToTArrayWithDepth<T, D extends number> = D extends 0
        ? T
        : ToTArrayWithDepth<T[], Prev[D]>;

    export type SLFNScalarOp<
        F extends object,
        N extends string,
        TNP extends string,
        TAD extends number,
        ARGS extends any,
        E extends { [key: string | number | symbol]: any } = {
            $lazy: ARGS extends undefined
                ? () => Promise<"T">
                : (args: ARGS) => Promise<"T">;
        },
        REP extends string | number | symbol = "$lazy",
    > = (
        makeSLFNInput: () => F,
        SLFN_name: N,
        SLFN_typeNamePure: TNP,
        SLFN_typeArrDepth: TAD,
    ) => <FF = F, EE = E>(
        this: any,
    ) => ToTArrayWithDepth<
        typeof OP_SCALAR_RESULT extends keyof FF
            ? SLW_TPN_ToType<TNP>
            : never,
        TAD
    > & {
        [k in keyof EE]: k extends REP
            ? EE[k] extends (...args: any) => any
                ? ReplaceReturnType<
                    EE[k],
                    ToTArrayWithDepth<
                        typeof OP_SCALAR_RESULT extends keyof FF
                            ? SLW_TPN_ToType<TNP>
                            : never,
                        TAD
                    >
                >
                : ToTArrayWithDepth<
                    typeof OP_SCALAR_RESULT extends keyof FF
                        ? SLW_TPN_ToType<TNP>
                        : never,
                    TAD
                >
            : EE[k];
    };

    type SLFNSelectionResult<TT, TNP, TAD extends number> = ToTArrayWithDepth<
        typeof OP_SCALAR_RESULT extends keyof TT
            ? ToTArrayWithDepth<SLW_TPN_ToType<TNP>, TAD>
            : {
                [K in keyof TT]: TT[K] extends SelectionWrapperImpl<
                    infer FN,
                    infer TTNP,
                    infer TTAD,
                    infer VT,
                    infer AT
                >
                    ? ToTArrayWithDepth<SLW_TPN_ToType<TTNP>, TTAD>
                    : TT[K];
            },
        TAD
    >;

    type SLFNReturned<
        T extends object,
        F extends object,
        E extends { [key: string | number | symbol]: any },
        TAD extends number,
        REP extends string | number | symbol,
        TNP,
        inferedAll = "$all" extends keyof F
            ? F["$all"] extends (...args: any) => infer R
                ? R
                : never
            : never,
        SLWFN_NO_SELECTION = (
            this: any,
        ) => ToTArrayWithDepth<inferedAll, TAD> & {
            [k in keyof E]: k extends REP
                ? E[k] extends (...args: any) => any
                    ? ReplaceReturnType<E[k], ToTArrayWithDepth<inferedAll, TAD>>
                    : ToTArrayWithDepth<inferedAll, TAD>
                : E[k];
        },
        SLWFN_WITH_SELECTION = <TT = T, FF = F, EE = E>(
            this: any,
            s: (selection: FF) => TT,
        ) => SLFNSelectionResult<TT, TNP, TAD> & {
            [k in keyof EE]: k extends REP
                ? EE[k] extends (...args: any) => any
                    ? ReplaceReturnType<EE[k], SLFNSelectionResult<TT, TNP, TAD>>
                    : SLFNSelectionResult<TT, TNP, TAD>
                : EE[k];
        },
    > = keyof F extends "$on"
        ? SLWFN_WITH_SELECTION
        : SLWFN_NO_SELECTION & SLWFN_WITH_SELECTION;

    export type SLFN<
        T extends object,
        F extends object,
        N extends string,
        TNP extends string,
        TAD extends number,
        E extends { [key: string | number | symbol]: any } = {},
        REP extends string | number | symbol = never,
    > = (
        makeSLFNInput: () => F,
        SLFN_name: N,
        SLFN_typeNamePure: TNP,
        SLFN_typeArrDepth: TAD,
    ) => SLFNReturned<T, F, E, TAD, REP, TNP>;
    `;
    };

    public static readonly HelperFunctions = `
    const selectScalars = <S>(selection: Record<string, any>) =>
    Object.fromEntries(
        Object.entries(selection).filter(
            ([k, v]) => v instanceof SelectionWrapperImpl,
        ),
    ) as S;

    type AllNonFuncFieldsFromType<
        TRaw,
        T = TRaw extends Array<infer A> ? A : TRaw,
    > = Pick<
        T,
        { [k in keyof T]: T[k] extends (args: any) => any ? never : k }[keyof T]
    >;

    type SetNestedFieldNever<
        T,
        Path extends string,
    > = Path extends \`$\{infer Key\}.$\{infer Rest\}\`
        ? Key extends keyof T
            ? {
                [K in keyof T]: K extends Key
                    ? SetNestedFieldNever<T[K], Rest>
                    : T[K];
            }
            : T
        : { [K in keyof T]: K extends Path ? never : T[K] };

    type primitives =
        | string
        | number
        | boolean
        | Record<string | number | symbol, unknown>;
    type isScalar<T> =
        T extends Exclude<
            ScalarTypeMapDefault[keyof ScalarTypeMapDefault],
            primitives
        >
            ? true
            : T extends Exclude<
                    ScalarTypeMapWithCustom[keyof ScalarTypeMapWithCustom],
                    primitives
                >
            ? true
            : false;

    type Paths<T, Visited = never, Depth extends Prev[number] = 9> =
        isScalar<T> extends true
            ? never
            : Depth extends never
            ? never
            : T extends object
                ? T extends Visited
                    ? never
                    : {
                        [K in keyof T]: T[K] extends Array<infer U>
                            ? K extends string | number
                                ?
                                        | \`$\{K\}\`
                                        | \`$\{K\}.$\{Paths<U, Visited | T, Prev[Depth]>\}\`
                                : never
                            : K extends string | number
                                ? T[K] extends object
                                    ?
                                        | \`$\{K\}\`
                                        | \`$\{K\}.$\{Paths<T[K], Visited | T, Prev[Depth]>\}\`
                                    : \`$\{K\}\`
                                : never;
                    }[keyof T]
                : never;

    type CyclicPaths<
        T,
        Visited = never,
        Depth extends Prev[number] = 9,
        Prefix extends string = "",
    > =
        isScalar<T> extends true
            ? never
            : Depth extends never
            ? never
            : T extends object
                ? {
                    [K in keyof T]: T[K] extends Array<infer U>
                        ? K extends string | number
                            ? U extends Visited
                                ? \`$\{Prefix\}$\{K\}\`
                                : CyclicPaths<
                                        U,
                                        Visited | T,
                                        Prev[Depth],
                                        \`$\{Prefix\}$\{K\}.\`
                                    >
                            : never
                        : K extends string | number
                            ? T[K] extends Visited
                                ? \`$\{Prefix\}$\{K\}\`
                                : T[K] extends object
                                ? CyclicPaths<
                                        T[K],
                                        Visited | T,
                                        Prev[Depth],
                                        \`$\{Prefix\}$\{K\}.\`
                                    >
                                : never
                            : never;
                }[keyof T]
                : never;

    type OmitMultiplePaths<T, Paths extends string> = Paths extends any
        ? SetNestedFieldNever<T, Paths>
        : T;
    type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
        x: infer I,
    ) => void
        ? I
        : never;
    type MergeUnion<T> = UnionToIntersection<T>;
    type TurnToArray<T, yes extends boolean> = yes extends true ? T[] : T;
    type OmitNever<
        TRaw,
        TisArray extends boolean = TRaw extends Array<any> ? true : false,
        T = TRaw extends Array<infer A> ? A : TRaw
    > = isScalar<T> extends true
        ? TurnToArray<T, TisArray>
        : T extends object
        ? TurnToArray<
                {
                    [K in keyof T as T[K] extends never ? never : T[K] extends never[] ? never : K]: isScalar<T[K]> extends true
                        ? T[K]
                        : T[K] extends object
                        ? OmitNever<T[K]>
                        : T[K];
                },
                TisArray
        >
        : TurnToArray<T, TisArray>;

    const selectCyclicFieldsOptsStr = "select cyclic levels: ";
    type selectCyclicFieldsOptsStrType = typeof selectCyclicFieldsOptsStr;
    type cyclicOpts<
        S,
        CP = CyclicPaths<S>,
        kOpts = "exclude" | \`$\{selectCyclicFieldsOptsStrType\}$\{1 | 2 | 3 | 4 | 5\}\`,
    > = CP extends never
        ? never
        : {
            [k in CP & string]: kOpts;
        };

    type Next = [1, 2, 3, 4, 5, 6, 7, 8, 9, ...0[]];
    type StringToNumber<S extends string> = S extends \`$\{infer N extends number\}\`
        ? N
        : never;

    type getNumberNestedLevels<str extends string> =
        str extends \`$\{selectCyclicFieldsOptsStrType\}$\{infer n\}\`
            ? StringToNumber<n>
            : never;

    type selectAllOpts<S> =
        | {
                exclude?: Paths<S>[];
        }
        | {
                exclude?: Paths<S>[];
                cyclic: cyclicOpts<S>;
        };
    type RepeatString<
        S extends string,
        N extends number,
        Splitter extends string = "",
        Acc extends string = "",
        Count extends number = N,
    > = Count extends 0
        ? Acc
        : RepeatString<
            S,
            N,
            Splitter,
            \`$\{Acc\}$\{Acc extends "" ? "" : Splitter\}$\{S\}\`,
            Prev[Count]
        >;

    type GetSuffix<
        Str extends string,
        Prefix extends string,
    > = Str extends \`$\{Prefix\}$\{infer Suffix\}\` ? Suffix : never;

    type selectAllFunc<T, TNP extends string> = <const P = Paths<T>, const CP_WITH_TNP = cyclicOpts<T, \`$\{TNP\}.$\{CyclicPaths<T>\}\`>>(
        opts: CyclicPaths<T> extends never
            ? {
                    exclude?: \`$\{TNP\}.$\{P & string\}\`[];
            }
            : {
                    exclude?: \`$\{TNP\}.$\{P & string\}\`[];
                    cyclic: CP_WITH_TNP;
            }
    ) => OmitNever<
        MergeUnion<
            OmitMultiplePaths<
                T,
                | (Exclude<Paths<T>, P> extends never ? "" : P & string)
                | (
                        CP_WITH_TNP extends never
                        ? ""
                        : {
                                [k in keyof CP_WITH_TNP]: "exclude" extends CP_WITH_TNP[k]
                                    ? GetSuffix<k & string, \`$\{TNP\}.\`>
                                    : RepeatString<
                                            GetSuffix<k & string, \`$\{TNP\}.\`>,
                                            Next[getNumberNestedLevels<CP_WITH_TNP[k] & string>],
                                            "."
                                    >;
                            }[keyof CP_WITH_TNP]
                    )
            >
        >
    >;

    const selectAll = <
        S,
        TNP extends string,
        SUB extends ReturnType<SLFN<{}, object, string, string, number>>,
        V extends
            | (SelectionWrapperImpl<any, any, any> | SUB)
            | ((args: any) => SelectionWrapperImpl<any, any, any> | SUB),
    >(
        selection: Record<string, V>,
        typeNamePure: TNP,
        opts: selectAllOpts<S> & { parent?: string },
        collector?: { parents: string[]; path?: string, typeOnType?: string[] },
    ) => {
        const s: Record<string, any> = {};
        const entries = Object.entries(selection);
        for (const [k, v] of entries) {
            const tk = collector?.path
                ? \`$\{collector.path\}.$\{k\}\`
                : \`$\{typeNamePure\}.$\{k\}\`;

            let typeOnType = (collector?.typeOnType ?? []).at(-1);
            typeOnType = typeOnType?.includes(".")
                ? typeOnType.split(".").at(-1)
                : typeOnType;
            const tnpNoArray = typeNamePure.replaceAll("[]", "");
            const tot = typeOnType ? \`$\{typeOnType\}.$\{tnpNoArray\}\` : opts?.parent ? \`$\{opts?.parent\}.$\{tnpNoArray\}\` : tnpNoArray;

            let excludePaths = opts?.exclude ?? ([] as string[]);
            const excludeAllCyclic = "cyclic" in opts && opts.cyclic === "exclude";

            if (
                "cyclic" in opts &&
                typeof opts.cyclic === "object" &&
                Object.keys(opts.cyclic).length > 0
            ) {
                const exclude = Object.entries(
                    opts.cyclic as Record<string, string>,
                )
                    .filter(([k, v]) => v === "exclude")
                    .map((e) => e[0]);
                const cyclicLevels = Object.entries(
                    opts.cyclic as Record<string, string>,
                )
                    .filter(([k, v]) => v !== "exclude")
                    .filter(([k, v]) =>
                        v.match(new RegExp(\`$\{selectCyclicFieldsOptsStr\}(.*)\`)),
                    )
                    .map((e) => {
                        const levels = parseInt(
                            e[1]
                                .match(new RegExp(\`$\{selectCyclicFieldsOptsStr\}(.*)\`))!
                                .at(1)![0],
                        ) + 1;
                        const pathFragment = e[0].split(".").slice(1).join(".");
                        return \`$\{e[0].split(".")[0]}.$\{Array.from({ length: levels }).fill(pathFragment).join(".")\}\`;
                    });
                excludePaths.push(...exclude, ...cyclicLevels);
            }
            if (excludePaths.includes(tk as any)) continue;

            if (typeof v === "function") {
                if (collector?.typeOnType && collector?.typeOnType.includes(tot)) {
                    if (!excludeAllCyclic) {
                        throw new Error(
                            \`Circular dependency: $\{collector?.typeOnType.join(" -> ")\}\`,
                        );
                    }
                    continue;
                }

                if (v.name.startsWith("bound ")) {
                    const col = {
                        parents: [...(collector?.parents ?? []), tk],
                        typeOnType: [...(collector?.typeOnType ?? []), tot],
                        path: tk,
                    };
                    s[k] = v(
                        (sub_s: {
                            $on?: { [k: string]: (utype_sub: (utype_sub_s: { $all: (_opts?: {}, collector?: {}) => any }) => any) => any };
                            $all?: (_opts?: {}, collector?: {}) => any;
                        }) => {
                            if (sub_s.$all) {
                                return sub_s.$all(opts, col);
                            }
                            if (sub_s.$on) {
                                return Object.values(sub_s.$on).reduce(
                                    (sel, tselfn) => ({
                                        ...sel,
                                        ...tselfn(utype_sub_s => {
                                            return utype_sub_s.$all(opts, col);
                                        }),
                                    }),
                                    {}
                                );
                            }
                        }
                    );
                } else if (!k.startsWith("$")) {
                    console.warn(
                        \`Cannot use $all on fields with args: $\{k\}: $\{v.toString()\}\`,
                    );
                }
            } else {
                s[k] = v;
            }
        }
        return s;
    };

    const makeScalarOperationSelection = <
        name extends string,
        typeName extends string,
        isList extends number,
        args extends any,
        argsMeta extends Record<
            string,
            {
                type: string;
                location: "path" | "body" | "query" | "header" | "cookie";
            }
        >,
    >(
        name: name,
        typeName: typeName,
        isList: isList,
        args?: args,
        argsMeta?: argsMeta,
    ) => function(this: any) {
        return {
            [OP_SCALAR_RESULT]: new SelectionWrapper(
                name,
                typeName,
                isList,
                {},
                this,
                undefined,
                args,
                argsMeta,
                undefined,
                true,
            ),
        } as const;
    };

    const makeSLFNScalarOp = <
        F extends object,
        N extends string,
        TNP extends string,
        TAD extends number,
        ARGS extends any,
    >(
        makeSLFNInput: () => F,
        SLFN_name: N,
        SLFN_typeNamePure: TNP,
        SLFN_typeArrDepth: TAD,
        ARGS: ARGS,
    ) => {
        function _SLFN<FF extends F>(this: any) {
            let parent: SelectionFnParent = this ?? {
                collector: new OperationSelectionCollector(),
            };
            function innerFn(this: any) {
                const r: FF = makeSLFNInput.bind(this)() as any;
                const _result = new SelectionWrapper(
                    parent?.fieldName,
                    SLFN_typeNamePure,
                    SLFN_typeArrDepth,
                    r,
                    this,
                    parent?.collector,
                    parent?.args,
                    parent?.argsMeta,
                    function (this: OperationSelectionCollector) {
                        return makeSLFNInput.bind(this)() as FF;
                    },
                    true,
                );

                _result[ROOT_OP_META] = parent?.opPath
                    ? {
                        path: parent.opPath,
                        method: parent.method!,
                        isEventStream: parent.isEventStream,
                    }
                    : undefined;

                Object.keys(r).forEach((key) => (_result as FF)[key as keyof FF]);
                const result = _result as unknown as FF;

                if ((result as any)[OP_SCALAR_RESULT]) {
                    return (result as any)[OP_SCALAR_RESULT];
                }

                return result;
            }
            return innerFn.bind(
                new OperationSelectionCollector(SLFN_name, parent?.collector),
            )();
        }
        return _SLFN as ReturnType<SLFNScalarOp<F, N, TNP, TAD, ARGS>>;
    };

    const makeSLFN = <
        T extends object,
        F,
        N extends string,
        TNP extends string,
        TAD extends number,
    >(
        makeSLFNInput: () => F,
        SLFN_name: N,
        SLFN_typeNamePure: TNP,
        SLFN_typeArrDepth: TAD,
    ) => {
        function _SLFN<TT extends T, FF extends F>(
            this: any,
            _s?: (selection: FF) => TT,
        ) {
            let parent: SelectionFnParent = this ?? {
                collector: new OperationSelectionCollector(),
            };
            function innerFn(this: any) {
                const s =
                    _s ??
                    ((selection: FF) =>
                        (selection as any)["$all"]({ cyclic: "exclude", parent: parent?.tnp }) as TT);

                const selection: FF = makeSLFNInput.bind(this)() as any;
                const r = s(selection);
                const _result = new SelectionWrapper(
                    parent?.fieldName,
                    SLFN_typeNamePure,
                    SLFN_typeArrDepth,
                    r,
                    this,
                    parent?.collector,
                    parent?.args,
                    parent?.argsMeta,
                    function (this: OperationSelectionCollector) {
                        return s(makeSLFNInput.bind(this)() as FF);
                    },
                );

                _result[ROOT_OP_META] = parent?.opPath ? {
                        path: parent.opPath,
                        method: parent.method!,
                        isEventStream: parent.isEventStream,
                    }
                    : undefined;

                Object.keys(r).forEach((key) => (_result as T)[key as keyof T]);
                const result = _result as unknown as T;

                if ((result as any)[OP_SCALAR_RESULT]) {
                    return (result as any)[OP_SCALAR_RESULT];
                }

                return result;
            }
            return innerFn.bind(
                new OperationSelectionCollector(SLFN_name, parent?.collector),
            )();
        }
        return _SLFN as ReturnType<SLFN<T, F, N, TNP, TAD>>;
    };
    `;

    constructor(
        typeName: string,
        protected readonly collector: Collector,
        protected readonly options: CodegenOptions,
    ) {
        super(typeName, collector, options);
    }

    public makeEnumType(): string {
        let enumTypeName = this.originalTypeNameToTypescriptTypeNameWithoutModifiers(this.originalFullTypeName);

        // this method is not called from the recursive generator functions
        // it's only called from the generator, in order and sequentially going through all the types
        // if (this.collector.hasEnumType(this.typeMeta)) {
        //     return enumTypeName;
        // }

        if (this.typeMeta.enumValues.length === 0) {
            console.warn(
                `Schema contains empty enum: ${this.typeMeta.name}. \n This is not allowed in GraphQL, but it happens. Please check your schema. Code is still generated and will work, but the type is being set to undefined.`,
            );
        }

        // in OpenAPI, enums are not unique, so we need to make sure the name is unique
        // let i = 0;
        // let conflictName = enumTypeName;
        // while (
        //     this.collector.hasEnumTypeName(
        //         (enumTypeName = [enumTypeName, i++].filter(Boolean).join("_")),
        //     )
        // ) {
        //     conflictName = [enumTypeName, i - 1].join("_");
        // }

        const conformEnumName = (str: string) => {
            if (!isNaN(Number(str))) {
                const n = Number(str);
                if (n < 0) {
                    return `minus_${str.slice(1)}`;
                }
                return `_${n}`;
            }

            return str.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[0-9]/, "_$&");
        };

        const enumTypeBody =
            this.typeMeta.enumValues.length === 0
                ? "undefined" // handle empty enums (even though they shouldn't exist, they sometimes do)
                : this.typeMeta.enumValues.map((e) => `"${e.name}"`).join(" | ");
        const enumEnumBody = this.typeMeta.enumValues
            .map(
                (e) =>
                    `${e.description ? `/** ${e.description.replaceAll("*/", "\\*\\/")} */\n` : ""
                    }${conformEnumName(e.name)} = "${e.name}",`,
            )
            .join("\n");

        const enumType = (eTname: string) => `
            export type ${eTname} = ${enumTypeBody};
            export enum ${eTname}Enum {
                ${enumEnumBody}
            };
        `;

        if (
            this.collector.hasEnumTypeName(enumTypeName) &&
            this.collector.getEnumTypeByName(enumTypeName) !== enumType(enumTypeName)
        ) {
            // in OpenAPI, enums are not unique, so we need to make sure the name is unique
            let i = 0;
            let newEnumTypeName: string[] = [enumTypeName];
            while (this.collector.hasEnumTypeName(newEnumTypeName.join("_"))) {
                newEnumTypeName = [enumTypeName, (++i).toString()];
            }
            this.typeMeta.name = newEnumTypeName.join("_");
            this.collector.addEnumType(this.typeMeta, enumType(this.typeMeta.name));
        } else {
            this.typeMeta.name = enumTypeName;
            this.collector.addEnumType(this.typeMeta, enumType(enumTypeName));
        }

        return enumTypeName;
    }

    /**
     * Generate the code for the selection type wrapper for a field.
     * @returns
     * ```typescript
     * id?: string;
     * ```
     * For a field called id. And for a list field called name:
     * ```typescript
     * name?: string[];
     * ```
     * @see GeneratorSelectionTypeFlavorDefault for more information.
     * @see GeneratorSelectionTypeFlavor for more information.
     */
    protected makeSelectionTypeInputValueForFieldWrapperType(fieldName: string, fieldMeta: TypeMeta): string {
        let type = "";

        if (fieldMeta.isEnum) {
            type = fieldMeta.ofType!.name.replaceAll("!", "").replaceAll("[", "").replaceAll("]", "");
        } else {
            type =
                this.ScalarTypeMap().get(fieldMeta.name.replaceAll("!", "").replaceAll("[", "").replaceAll("]", "")) ??
                (fieldMeta.scalarTSType
                    ? `ScalarTypeMapWithCustom["${fieldMeta.name
                        .replaceAll("!", "")
                        .replaceAll("[", "")
                        .replaceAll("]", "")}"]`
                    : "any");
        }

        if (fieldMeta.isList) {
            return `${Array.from({ length: fieldMeta.isList })
                .map((_) => "Array<")
                .join("")}${type}${Array.from({ length: fieldMeta.isList })
                    .map((_) => ">")
                    .join("")}`;
        }
        return type;
    }

    protected makeSelectionTypeInputValueForField(
        field: FieldMeta,
        parents: string[] = [],
        parentIsInput: boolean = false,
    ): string {
        const description = field.description ? `/* ${field.description.replaceAll("*/", "\\*\\/")} */\n` : "";
        if (field.type.isScalar || field.type.isEnum) {
            let selectionType = this.makeSelectionTypeInputValueForFieldWrapperType(field.name, field.type);

            this.collector.addSelectionType(field.type, selectionType);

            return `${description}${field.name}${field.type.isNonNull ? "" : "?"}: ${selectionType};`;

            //
        } else if (field.type.isUnion && field.type.possibleTypes.every((pt) => pt.isScalar || pt.isEnum)) {
            //

            return `${description}${field.name}${field.type.isNonNull ? "" : "?"}: ${Array.from({
                length: field.type.isList,
            })
                .map((_) => "Array<")
                .join("")}${field.type.name.replaceAll("!", "").replaceAll("[", "").replaceAll("]", "")}
                ${Array.from({
                    length: field.type.isList,
                })
                    .map((_) => ">")
                    .join("")};`;

            //
        } else if (field.type.ofType) {
            const selectionType = new GeneratorSelectionTypeFlavorDefault(
                field.type.ofType.name,
                this.collector,
                this.options,
            ).makeSelectionType();

            return `${description}"${field.name}"${field.type.isNonNull ? "" : "?"
                }: ${this.originalTypeNameToTypescriptTypeName(
                    field.type.ofType.name,
                    !field.type.isInput && field.type.isList ? "Array" : "",
                ).replaceAll("!", "")}`;

            // return `${description}${field.name}${
            //     field.type.isNonNull ? "" : "?"
            // }: ${selectionType};`;
        } else {
            console.error(field.type);
            throw new Error(`Unknown type for field "${field.name}": ${field.type.name}`);
        }
    }

    public makeSelectionType(): string {
        if (this.typeMeta.isScalar || this.typeMeta.isEnum) {
            return this.makeSelectionTypeInputValueForFieldWrapperType(this.typeName, this.typeMeta);
        }
        const selectionTypeName = this.typeMeta.isInput
            ? `${this.originalTypeNameToTypescriptTypeNameWithoutModifiers(this.originalFullTypeName)}`
            : // : `${this.typeName}SelectionFields`; // indicate that this comes from an object-type
            // actually, don't indicate it with a suffix, because it breaks scalar types referencing
            // the object type in it's scalarTSType. E.g. Record<string, EntityId> where EntityId
            // is an object type referenced from a scalar type, because we map such free-form types
            // to custom scalar types to keep it somewhat similar to GraphQL.
            this.typeName;

        if (this.collector.hasSelectionType(this.typeMeta)) {
            return selectionTypeName;
        }

        let selectionType = "";

        if (this.typeMeta.isUnion) {
            const types = this.typeMeta.possibleTypes
                .map((t) =>
                    t.isScalar || t.isEnum
                        ? this.makeSelectionTypeInputValueForFieldWrapperType(t.name, t)
                        : this.typeMeta.isInput
                            ? `${this.originalTypeNameToTypescriptTypeNameWithoutModifiers(t.name)}`
                            : `${this.originalTypeNameToTypescriptFriendlyName(t.name)}`,
                )
                .join(" | ");

            selectionType = `
                export type ${selectionTypeName} = ${types};
            `;
        } else {
            selectionType = `
            export type ${selectionTypeName} = {
                ${(this.typeMeta.isInput ? this.typeMeta.inputFields : this.typeMeta.fields)
                    .map((field) =>
                        this.makeSelectionTypeInputValueForField(
                            field,
                            this.typeMeta.isInput ? [] : [this.typeName],
                            this.typeMeta.isInput,
                        ),
                    )
                    .join("\n")}
            };
        `;
        }
        this.collector.addSelectionType(this.typeMeta, selectionType);

        return selectionTypeName;
    }

    protected makeSelectionFunctionInputObjectValueForFieldWrapper(field: FieldMeta, parents: string[]): string {
        return `new SelectionWrapper(
            "${field.name}",
            "${field.type.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}",
            ${field.type.isList ?? 0},
            {},
            this,
            undefined,
            )`;
    }

    protected makeSelectionFunctionInputObjectValueForField(field: FieldMeta, parents: string[]): string {
        const fieldType = field.type;
        if (
            fieldType.isScalar ||
            fieldType.isEnum ||
            (fieldType.isUnion && fieldType.possibleTypes.every((pt) => pt.isScalar || pt.isEnum))
        ) {
            let selectionFunction = this.makeSelectionFunctionInputObjectValueForFieldWrapper(field, parents);

            this.collector.addSelectionFunction(fieldType, selectionFunction);

            return `"${field.name}": ${selectionFunction}`;
        } else if (fieldType.ofType) {
            const selectionFunction = new GeneratorSelectionTypeFlavorDefault(
                fieldType.ofType.name,
                this.collector,
                this.options,
            ).makeSelectionFunction();

            return `"${field.name}": ${selectionFunction}.bind({ collector: this, fieldName: "${field.name}", tnp })`;
        } else {
            console.error(fieldType);
            throw new Error(`Unknown type for field "${field.name}": ${fieldType.name}`);
        }
    }

    public makeSelectionFunction(): string {
        if (this.typeMeta.isScalar || this.typeMeta.isEnum) {
            return `new SelectionWrapper(
                "${this.typeName}",
                "${this.typeMeta.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}",
                ${this.typeMeta.isList ?? 0},
                {},
                this
            )`;
        }

        const selectionFunctionName = `${this.typeName}Selection`;
        if (this.collector.hasSelectionFunction(this.typeMeta)) {
            return selectionFunctionName;
        } else {
            this.collector.addSelectionFunction(this.typeMeta, selectionFunctionName);
        }

        const typeHasScalars = this.typeMeta.fields.some((f) => f.type.isScalar || f.type.isEnum);

        let helperFunctions = "";
        if (this.typeMeta.isUnion && this.typeMeta.possibleTypes.filter((t) => !t.isScalar && !t.isEnum).length) {
            helperFunctions = `
            $on: {
                ${this.typeMeta.possibleTypes
                    .filter((t) => !t.isScalar && !t.isEnum)
                    .map(
                        (
                            t,
                        ) => `"${t.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}": ${this.originalTypeNameToTypescriptFriendlyName(t.name)}Selection.bind({
                        collector: this,
                        fieldName: "",
                    }),`,
                    )
                    .join("\n")}
                }
            `;
        } else {
            helperFunctions = `
            ${typeHasScalars
                    ? `
            $scalars: () =>
                selectScalars(
                        make${selectionFunctionName}Input.bind(that)(),
                    ) as SLWsFromSelection<
                        ReturnType<typeof make${selectionFunctionName}Input>
                    >,
            `
                    : ""
                }
            $all: (opts?: any, collector = undefined) =>
                selectAll(
                    make${selectionFunctionName}Input.bind(that)() as any,
                    "${this.originalTypeNameToTypescriptTypeName(this.originalFullTypeName)}",
                    opts as any,
                    collector
                ) as any
            `;
        }
        const makeSelectionFunctionInputReturnTypeParts = new Map<string, string>();

        const selectionFunction = `
            export function make${selectionFunctionName}Input(this: any) ${this.typeMeta.isUnion ? "" : `: ReturnTypeFrom${selectionFunctionName}`} {
                const that = this;
                const tnp = "${this.originalTypeNameToTypescriptTypeNameWithoutModifiers(this.originalFullTypeName)}";
                return {
                    ${this.typeMeta.fields
                .map(
                    (field) =>
                        [
                            field,
                            this.makeSelectionFunctionInputObjectValueForField(
                                field,
                                this.typeMeta.isInput ? [] : [this.typeName],
                            ),
                        ] as const,
                )
                .map(([field, fieldSlfn]) => {
                    makeSelectionFunctionInputReturnTypeParts.set(
                        field.name,
                        `${field.type.isScalar ||
                            field.type.isEnum ||
                            (field.type.isUnion &&
                                field.type.possibleTypes.every((pt) => pt.isScalar || pt.isEnum))
                            ? `SelectionWrapperImpl<"${field.name}", "${field.type.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}", ${field.type.isList}, {}, ${"undefined"}>`
                            : `ReturnType<
                                            SLFN<
                                                {},
                                                ReturnType<typeof make${super.originalTypeNameToTypescriptFriendlyName(
                                field.type.name,
                            )}SelectionInput>,
                                                "${super.originalTypeNameToTypescriptFriendlyName(field.type.name)}Selection",
                                                "${super.originalTypeNameToTypescriptTypeNameWithoutModifiers(
                                field.type.name,
                            )}",
                                                ${field.type.isList ?? 0}
                                            >
                                        >`
                        }`,
                    );
                    return `${fieldSlfn},`;
                })
                .join("\n")}

                    ${helperFunctions}
                } as const;
            };
            export const ${selectionFunctionName} = makeSLFN(
                ${`make${selectionFunctionName}Input`},
                "${selectionFunctionName}",
                "${this.originalFullTypeName.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}",
                ${this.typeMeta.isList ?? 0}
            );
        `;
        const selectionFunctionReturnType = this.typeMeta.isUnion
            ? ""
            : `
        type ReturnTypeFrom${selectionFunctionName} = {
            ${Array.from(makeSelectionFunctionInputReturnTypeParts)
                .map(([k, v]) => `"${k}": ${v}`)
                .join("\n")}
        } & {
            ${typeHasScalars
                ? `
            $scalars: () => SLWsFromSelection<ReturnType<typeof ${`make${selectionFunctionName}Input`}>>;
            `
                : ""
            }
            $all: selectAllFunc<AllNonFuncFieldsFromType<${this.originalTypeNameToTypescriptTypeName(this.originalFullTypeName)}>, "${this.originalTypeNameToTypescriptTypeName(this.originalFullTypeName)}">;
        };`;
        this.collector.addSelectionFunction(
            this.typeMeta,
            `${selectionFunctionReturnType}
            ${selectionFunction}
        `,
        );

        return selectionFunctionName;
    }

    public static makeOperationFunctions(operations: OperationMeta[], collector: Collector, options: CodegenOptions) {
        const makeSelectionFunctionInputReturnTypeParts = new Map<string, string>();
        const fnsWithoutScalarOps: string[] = [];
        const fnsScalarOps: string[] = [];

        const conformToTypeKey = (str: string) => {
            if (str.includes("-") || str.includes("+") || !isNaN(+str.at(0)!)) {
                return `"${str}"`;
            }
            return str;
        };

        for (const operation of operations) {
            // if there is at least one argument in the query which is also in the path,
            // the arguments in query should not be hoisted to the top level, instead keep
            // them in under a $query object
            // if one argument in the body is in the query or path, do the same
            // and put them under a $body object
            const hoistQueryArgs = operation.args
                .filter((arg) => arg.location === "query")
                .some((arg) =>
                    operation.args
                        .filter((arg) => arg.location === "path")
                        .some((pathArg) => pathArg.name === arg.name),
                );
            const hoistBodyArgs = operation.args
                .filter((arg) => arg.location === "body")
                .some(
                    (arg) =>
                        operation.args
                            .filter((arg) => arg.location === "query")
                            .some((queryArg) => queryArg.name === arg.name) ||
                        operation.args
                            .filter((arg) => arg.location === "path")
                            .some((pathArg) => pathArg.name === arg.name),
                );

            const collectArgMeta = () => {
                if (!operation.args.length) return undefined;

                const argsTypeName = `${operation.name.slice(0, 1).toUpperCase()}${operation.name.slice(1)}Args`;

                if (!collector.hasArgumentMeta(argsTypeName)) {
                    const argsMetaBody = operation.args
                        .map((arg) => {
                            if (arg.name === "$" && (hoistQueryArgs || hoistBodyArgs)) {
                                return arg.type.inputFields
                                    .map(
                                        (f) => `${conformToTypeKey(f.name)}: {
                                    type: "${f.type.name}",
                                    location: "${arg.location}",
                                },`,
                                    )
                                    .join("\n");
                            } else if (arg.name === "$" && !hoistQueryArgs && !hoistBodyArgs) {
                                return `${arg.location === "query" ? "$query" : "$body"}: {
                                    type: "${arg.type.name}",
                                    location: "${arg.location}",
                                },`;
                            }

                            return `${conformToTypeKey(arg.name)}: {
                                type: "${arg.type.name}",
                                location: "${arg.location}",
                            },`;
                        })
                        .join(" ");
                    const argsMeta = `{ ${argsMetaBody} }`;
                    collector.addArgumentMeta(argsTypeName, `export const ${argsTypeName}Meta = ${argsMeta} as const;`);
                }

                return {
                    argsTypeName,
                };
            };

            const collectArgTypes = () => {
                const makeType = (arg: ParameterMeta) => {
                    const isScalar = arg.type.isScalar;
                    const isEnum = arg.type.isEnum;
                    const isInput = arg.type.isInput;
                    const argKey = `${conformToTypeKey(arg.name)}${arg.type.isNonNull ? "" : "?"}`;

                    let argType = "any";
                    if (isScalar) {
                        argType = this.ScalarTypeMap.get(arg.type.name.replaceAll("!", "")) ?? "any";
                    } else if (isInput || isEnum) {
                        argType = `${this.originalTypeNameToTypescriptTypeName(arg.type.name)}`;
                    }

                    return {
                        description: arg.description,
                        argKey,
                        argType,
                    };
                };

                if (!operation.args.length) return undefined;

                const hasAtLeastOneNonNullArg = operation.args.some((arg) => arg.type.isNonNull);

                const argsTypeName = `${operation.name.slice(0, 1).toUpperCase()}${operation.name.slice(1)}Args`;

                if (!collector.hasArgumentType(argsTypeName)) {
                    let argsType: string | undefined;

                    if (operation.args.length === 1 && operation.args[0].name === "$") {
                        argsType =
                            operation.args[0].type.isScalar && operation.args[0].type.scalarTSType
                                ? `ScalarTypeMapWithCustom["${operation.args[0].type.name.replaceAll("!", "").replaceAll("[", "").replaceAll("]", "")}"]`
                                : new GeneratorSelectionTypeFlavorDefault(
                                    operation.args[0].type.name,
                                    collector,
                                    options,
                                ).makeSelectionType();
                    } else {
                        const argsTypeBody = operation.args
                            .map((arg) => {
                                if (arg.name === "$" && (hoistQueryArgs || hoistBodyArgs)) {
                                    return arg.type.inputFields
                                        .map((f) => {
                                            const { description, argType, argKey } = makeType(f);
                                            return `
                                            ${description ? `/** ${description.replaceAll("*/", "\\*\\/") ?? `${argKey}`} */` : ""}
                                            ${argKey}: ${argType};
                                            `;
                                        })
                                        .join("\n");
                                } else if (arg.name === "$" && !hoistQueryArgs && !hoistBodyArgs) {
                                    const { description, argType } = makeType(arg);

                                    return `
                                    ${description ? `/** ${description.replaceAll("*/", "\\*\\/") ?? `${arg.location === "query" ? "$query" : "$body"}`} */` : ""}
                                    ${arg.location === "query" ? "$query" : "$body"}: ${argType};
                                    `;
                                }

                                const { description, argType, argKey } = makeType(arg);

                                return `
                                ${description ? `/** ${description.replaceAll("*/", "\\*\\/") ?? `${argKey}`} */` : ""}
                                ${argKey}: ${argType};
                                `;
                            })
                            .join(" ");

                        argsType = `{ ${argsTypeBody} }`;
                    }

                    collector.addArgumentType(argsTypeName, `export type ${argsTypeName} = ${argsType};`);
                }

                return {
                    argsTypeName,
                    hasAtLeastOneNonNullArg,
                };
            };

            const argMeta = collectArgMeta();
            const argTypes = collectArgTypes();

            const returnTypeSelectionFunctionNameOrScalarOrEnum =
                operation.type.isScalar || operation.type.isEnum
                    ? `makeSLFNScalarOp(
                        makeScalarOperationSelection(
                            "${operation.name}",
                            "${operation.type.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}",
                            ${operation.type.isList ?? 0},
                            ${argMeta ? `args, ${argMeta.argsTypeName}Meta` : ""}
                        ),
                        "${operation.name}",
                        "${operation.type.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}",
                        ${operation.type.isList ?? 0},
                        ${argTypes ? `args` : "undefined"}
                    )`
                    : new GeneratorSelectionTypeFlavorDefault(
                        operation.type.name,
                        collector,
                        options,
                    ).makeSelectionFunction();

            const operationAsOpNameToFunction = `
                "${operation.name}": (${argTypes ? `args: ${argTypes.argsTypeName}` : ""}) => 
                    ${returnTypeSelectionFunctionNameOrScalarOrEnum}.bind({
                        collector: this,
                        fieldName: "${operation.name}",
                        opPath: "${operation.path}",
                        method: "${operation.method}",
                        isEventStream: ${operation.isEventStream ? "true" : "false"},
                        ${argMeta ? `args, argsMeta: ${argMeta.argsTypeName}Meta` : ""}
                    })${operation.type.isScalar || operation.type.isEnum ? "()" : ""},
            `;

            if (!operation.type.isScalar && !operation.type.isEnum) {
                const objectReturnType = `ReturnType<
                            SLFN<
                                {},
                                ReturnType<typeof make${super.originalTypeNameToTypescriptFriendlyName(
                    operation.type.name,
                )}SelectionInput>,
                                "${super.originalTypeNameToTypescriptFriendlyName(operation.type.name)}Selection",
                                "${super.originalTypeNameToTypescriptTypeNameWithoutModifiers(operation.type.name)}",
                                ${operation.type.isList ?? 0},
                                { 
                                    $lazy: (
                                        ${argTypes ? `args: ${argTypes.argsTypeName}` : ""}
                                    ) => Promise<"T">
                                },
                                "$lazy"
                            >
                        >`;
                makeSelectionFunctionInputReturnTypeParts.set(
                    operation.name,
                    `(
                    ${argTypes ? `args: ${argTypes.argsTypeName}` : ""}
                    ) =>
                        ${operation.isEventStream ? `AsyncIterable<${objectReturnType}>` : objectReturnType},`,
                );
            }

            if (!operation.type.isScalar && !operation.type.isEnum) {
                fnsWithoutScalarOps.push(operationAsOpNameToFunction);
            } else {
                fnsScalarOps.push(operationAsOpNameToFunction);
            }
        }

        return {
            fnsWithoutScalarOps,
            fnsScalarOps,
            makeSelectionFunctionInputReturnTypeParts,
        };
    }

    public static makeRootOperationFunction(
        operations: OperationMeta[],
        collector: Collector,
        options: CodegenOptions,
        authConfig?: {
            headerName: string;
        },
    ): string {
        const { fnsWithoutScalarOps, fnsScalarOps, makeSelectionFunctionInputReturnTypeParts } =
            this.makeOperationFunctions(operations, collector, options);
        const rootOperationFunction = `
            export type ReturnTypeFromRootOperationWithoutScalarOps = {
                ${Array.from(makeSelectionFunctionInputReturnTypeParts)
                .map(([k, v]) => `"${k}": ${v}`)
                .join("\n")}
            };
            export function _makeRootOperationInput(this: any) {
                const withoutScalarOps = {
                    ${fnsWithoutScalarOps.join("\n")}
                } as const;

                const withScalarOps = {
                    ${fnsScalarOps.join("\n")}
                } as const;

                return {
                    ...withoutScalarOps,
                    ...withScalarOps,
                } as ReturnTypeFromRootOperationWithoutScalarOps & typeof withScalarOps;
            };

            function __client__ <
                T extends object,
                F extends ReturnType<typeof _makeRootOperationInput>>(
                this: any, 
                s: (selection: F) => T
            ) {
                const rootOp = new RootOperation();
                const root = new OperationSelectionCollector(undefined, undefined, rootOp);
                const rootRef = { ref: root };
                const selection: F = _makeRootOperationInput.bind(rootRef)() as any;
                const r = s(selection);
                const _result = new SelectionWrapper(undefined, undefined, undefined, r, root, undefined) as unknown as T;
                Object.keys(r).forEach((key) => (_result as T)[key as keyof T]);
                
                // remove the $lazy property from the result
                const result = _result as {
                    [k in keyof T]: T[k] extends infer U & {
                        $lazy: (args: any) => Promise<infer R>;
                    }
                        ? R
                        : // if T[k] is a function and has a $lazy property, return the type of the function
                        T[k] extends () => Promise<infer R>
                        ? () => Promise<R>
                        : T[k] extends (args: infer A) => Promise<infer R>
                            ? (args: A) => Promise<R>
                            : T[k];
                };

                type _TR = typeof result;
                type __HasPromisesAndOrNonPromisesK = {
                    [k in keyof _TR]: _TR[k] extends (args: any) => Promise<any>
                        ? "promise"
                        : "non-promise";
                };
                type __HasPromisesAndOrNonPromises =
                    __HasPromisesAndOrNonPromisesK[keyof __HasPromisesAndOrNonPromisesK];
                type finalReturnTypeBasedOnIfHasLazyPromises =
                    __HasPromisesAndOrNonPromises extends "non-promise"
                        ? Promise<_TR>
                        : __HasPromisesAndOrNonPromises extends "promise"
                        ? _TR
                        : Promise<_TR>;

                // Auth is resolved inside RootOperation.execute (global auth / authToken / per-call source)
                let returnValue: finalReturnTypeBasedOnIfHasLazyPromises;
                
                if (Object.values(result).some((v) => typeof v !== "function")) {
                    returnValue = {
                        then: (resolve: any, reject: any) => {
                            root.execute()
                                .then(() => {
                                    resolve(result);
                                })
                                .catch(reject);
                        },
                    } as finalReturnTypeBasedOnIfHasLazyPromises;
                }
                else {
                    returnValue = result as finalReturnTypeBasedOnIfHasLazyPromises;
                }
                
                ${authConfig
                ? `
                Object.defineProperty(returnValue, "auth", {
                    enumerable: false,
                    get: function () {
                        return function (auth: AuthSource) {
                            rootOp.setAuth(auth);
                            return returnValue;
                        };
                    },
                });

                return returnValue as finalReturnTypeBasedOnIfHasLazyPromises & {
                    auth: (
                        auth: AuthSource,
                    ) => finalReturnTypeBasedOnIfHasLazyPromises;
                };
                `
                : `
                return returnValue;
                `
            }
            };

            const __init__ = (options: {
                ${authConfig
                ? `/** Per-call auth resolver. Receives the argument passed to \`.auth(source)\` (or \`undefined\` when omitted). */
                auth?: AuthResolver;
                /** Static token for CLI/scripts/tests. Do not re-set this per SSR request. */
                authToken?: string;`
                : ""
            }
                headers?: { [key: string]: string };
                fetcher?: (
                    input: string | URL | globalThis.Request,
                    init?: RequestInit,
                ) => Promise<Response>;
                sseFetchTransform?: (
                    input: string | URL | globalThis.Request,
                    init?: RequestInit,
                ) => Promise<[string | URL | globalThis.Request, RequestInit | undefined]>
                    | [string | URL | globalThis.Request, RequestInit | undefined];
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
                ${authConfig
                ? `
                RootOperation.authHeaderName = "${authConfig.headerName}";
                if (options.authToken !== undefined) {
                    RootOperation[OPTIONS]._auth_token = options.authToken;
                }
                if (typeof options.auth === "function") {
                    RootOperation[OPTIONS]._auth_fn = options.auth;
                } else if (typeof options.auth === "string") {
                    console.warn(
                        "[samarium] init({ auth: string }) is deprecated; use init({ authToken: string }) for static tokens.",
                    );
                    RootOperation[OPTIONS]._auth_token = options.auth as unknown as string;
                }
                `
                : ""
            }

                if (options.headers) {
                    RootOperation[OPTIONS].headers = {
                        ...RootOperation[OPTIONS].headers,
                        ...options.headers,
                    };
                }
                if (options.fetcher) {
                    RootOperation[OPTIONS].fetcher = options.fetcher;
                }
                if (options.sseFetchTransform) {
                    RootOperation[OPTIONS].sseFetchTransform = options.sseFetchTransform;
                }
                if (options.scalars) {
                    RootOperation[OPTIONS].scalars = {
                        ...RootOperation[OPTIONS].scalars,
                        ...options.scalars,
                    };
                }
            };
            Object.defineProperty(__client__, "init", {
                enumerable: false,
                value: __init__,
            });

            export default __client__ as typeof __client__ & {
                init: typeof __init__;
            };
        `;

        return rootOperationFunction;
    }
}
