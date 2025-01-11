import { GeneratorSelectionTypeFlavor } from "../../builder/base";
import type { Collector } from "../../builder/collector";
import {
    type CodegenOptions,
    type TypeMeta,
    type FieldMeta,
} from "../../builder/meta";
import { DirectiveLocation } from "graphql";

// @ts-ignore
import wrapperCode from "./wrapper.ts" with { type: "text" };

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

    public static EnumTypesMapped = (collector: Collector) => {
        return `export interface EnumTypesMapped {
            ${Array.from(collector.enumsTypes.keys())
                .map((k) =>
                    k.name
                        .replaceAll("[", "")
                        .replaceAll("]", "")
                        .replaceAll("!", ""),
                )
                .filter((k, i, arr) => arr.indexOf(k) === i)
                .map((k) => `"${k}": ${k},`)
                .join("\n")}
        };`;
    };

    public static readonly HelperTypes = (customScalars: TypeMeta[]) => `
    export interface ScalarTypeMapWithCustom {
        ${customScalars.map((cs) => `"${cs.name}": ${cs.scalarTSType};`).join("\n")}
    }
    export interface ScalarTypeMapDefault {
        ${Array.from(GeneratorSelectionTypeFlavorDefault.ScalarTypeMap)
            .map(([k, v]) => `"${k}": ${v};`)
            .join("\n")}
    };

    type SelectionFnParent = {
        collector: OperationSelectionCollector | OperationSelectionCollectorRef;
        fieldName?: string;
        args?: Record<string, any>;
        argsMeta?: Record<string, string>;

        isRootType?: "Query" | "Mutation" | "Subscription";
        onTypeFragment?: string;
        isFragment?: string;
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

    type ReplaceReturnType<T, R, E = unknown> = T extends (
        ...a: any
    ) => (...a: any) => any
        ? (
            ...a: Parameters<T>
        ) => ReturnType<ReturnType<T>> extends Promise<any>
            ? Promise<R> & E
            : R & E
        : T extends (...a: any) => any
        ? (
                ...a: Parameters<T>
            ) => ReturnType<T> extends Promise<any> ? Promise<R> & E : R & E
        : never;
    type SLW_TPN_ToType<TNP> = TNP extends keyof ScalarTypeMapWithCustom
        ? ScalarTypeMapWithCustom[TNP]
        : TNP extends keyof ScalarTypeMapDefault
        ? ScalarTypeMapDefault[TNP]
        : TNP extends keyof EnumTypesMapped
        ? EnumTypesMapped[TNP]
        : never;
    type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ...0[]];
    type ToTArrayWithDepth<T, D extends number> = D extends 0
        ? T
        : ToTArrayWithDepth<T[], Prev[D]>;
    type ConvertToPromise<T, skip = 1> = skip extends 0 ? T : Promise<T>;
    type ReplacePlaceHoldersWithTNested<
        inferedResult,
        EE,
        REP extends string | number | symbol,
    > = {
        [k in keyof EE]: k extends REP
            ? EE[k] extends (...args: any) => infer R
                ? ReplaceReturnType<
                    EE[k],
                    inferedResult,
                    {
                        [kk in Exclude<REP, k>]: kk extends keyof R
                            ? ReplaceReturnType<R[kk], inferedResult>
                            : never;
                    }
                >
                : inferedResult
            : EE[k];
    };

    export type SLFN<
        T extends object,
        F,
        N extends string,
        TNP extends string,
        TAD extends number,
        E extends { [key: string | number | symbol]: any } = {},
        REP extends string | number | symbol = never,
        AS_PROMISE = 0,
    > = (
        makeSLFNInput: () => F,
        SLFN_name: N,
        SLFN_typeNamePure: TNP,
        SLFN_typeArrDepth: TAD,
    ) => <
        TT = T,
        FF = F,
        EE = E,
        inferedResult = {
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
    >(
        this: any,
        s: (selection: FF) => TT,
    ) => ConvertToPromise<ToTArrayWithDepth<inferedResult, TAD>, AS_PROMISE> &
        ReplacePlaceHoldersWithTNested<
            ToTArrayWithDepth<inferedResult, TAD>,
            EE,
            REP
        >;
    `;
    public static readonly HelperFunctions = `
    const selectScalars = <S>(selection: Record<string, any>) =>
    Object.fromEntries(
        Object.entries(selection).filter(
            ([k, v]) => v instanceof SelectionWrapperImpl,
        ),
    ) as S;

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
            s: (selection: FF) => TT,
        ) {
            let parent: SelectionFnParent = this ?? {
                collector: new OperationSelectionCollector(),
            };
            function innerFn(this: any) {
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
                _result[SLW_IS_ROOT_TYPE] = parent?.isRootType;
                _result[SLW_IS_ON_TYPE_FRAGMENT] = parent?.onTypeFragment;
                _result[SLW_IS_FRAGMENT] = parent?.isFragment;

                Object.keys(r).forEach((key) => (_result as T)[key as keyof T]);
                const result = _result as unknown as T;

                if (parent?.onTypeFragment) {
                    return {
                        [parent.onTypeFragment]: result,
                    } as unknown as typeof result;
                }
                if (parent?.isFragment) {
                    return {
                        [parent.isFragment]: result,
                    } as unknown as typeof result;
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
        protected readonly authConfig?: {
            headerName: string;
        },
    ) {
        super(typeName, collector, options, authConfig);
    }

    public makeEnumType(): string {
        const enumTypeName =
            this.originalTypeNameToTypescriptTypeNameWithoutModifiers(
                this.originalFullTypeName,
            );
        if (this.collector.hasEnumType(this.typeMeta)) {
            return enumTypeName;
        }

        if (this.typeMeta.enumValues.length === 0) {
            console.warn(
                `Schema contains empty enum: ${this.typeMeta.name}. \n This is not allowed in GraphQL, but it happens. Please check your schema. Code is still generated and will work, but the type is being set to undefined.`,
            );
        }
        const enumType = `
            export type ${enumTypeName} = ${
                this.typeMeta.enumValues.length === 0
                    ? "undefined" // handle empty enums (even though they shouldn't exist, they sometimes do)
                    : this.typeMeta.enumValues
                          .map((e) => `"${e.name}"`)
                          .join(" | ")
            };
            export enum ${enumTypeName}Enum {
                ${this.typeMeta.enumValues
                    .map(
                        (e) =>
                            `${
                                e.description ? `/** ${e.description} */\n` : ""
                            }${e.name} = "${e.name}",`,
                    )
                    .join("\n")}
            };
        `;
        this.collector.addEnumType(this.typeMeta, enumType);

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
    protected makeSelectionTypeInputValueForFieldWrapperType(
        fieldName: string,
        fieldMeta: TypeMeta,
    ): string {
        let type = "";

        if (fieldMeta.isEnum) {
            type = fieldMeta
                .ofType!.name.replaceAll("!", "")
                .replaceAll("[", "")
                .replaceAll("]", "");
        } else {
            type =
                this.ScalarTypeMap().get(
                    fieldMeta.name
                        .replaceAll("!", "")
                        .replaceAll("[", "")
                        .replaceAll("]", ""),
                ) ??
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
        const collectArgTypes = () => {
            const hasAtLeastOneNonNullArg = field.args.some(
                (arg) => arg.type.isNonNull,
            );

            const argsTypeName = `${parents.join()}${field.name
                .slice(0, 1)
                .toUpperCase()}${field.name.slice(1)}Args`;

            if (!this.collector.hasArgumentType(argsTypeName)) {
                const argsTypeBody = field.args
                    .map((arg) => {
                        const isScalar = arg.type.isScalar;
                        const isEnum = arg.type.isEnum;
                        const isInput = arg.type.isInput;
                        const argKey = `${arg.name}${
                            arg.type.isNonNull ? "" : "?"
                        }`;

                        let argType = "any";
                        if (isScalar) {
                            argType = arg.type.scalarTSType
                                ? `ScalarTypeMapWithCustom["${arg.type.name
                                      .replaceAll("!", "")
                                      .replaceAll("[", "")
                                      .replaceAll("]", "")}"]`
                                : this.ScalarTypeMap().get(
                                      arg.type.name
                                          .replaceAll("!", "")
                                          .replaceAll("[", "")
                                          .replaceAll("]", ""),
                                  ) ?? "any";
                        } else if (isInput || isEnum) {
                            argType = this.originalTypeNameToTypescriptTypeName(
                                arg.type.name,
                            );
                        }

                        return `${arg.description ? `/** ${arg.description ?? `${argKey}`} */` : ""}
                        ${argKey}: ${argType};`;
                    })
                    .join(" ");
                const argsType = `{ ${argsTypeBody} }`;
                this.collector.addArgumentType(
                    argsTypeName,
                    `export type ${argsTypeName} = ${argsType};`,
                );
            }

            return {
                argsTypeName,
                hasAtLeastOneNonNullArg,
            };
        };

        const description = field.description
            ? `/* ${field.description} */\n`
            : "";
        if (field.type.isScalar || field.type.isEnum) {
            let selectionType =
                this.makeSelectionTypeInputValueForFieldWrapperType(
                    field.name,
                    field.type,
                );

            this.collector.addSelectionType(field.type, selectionType);

            if (field.hasArgs) {
                const { argsTypeName, hasAtLeastOneNonNullArg } =
                    collectArgTypes();

                return `${description}${field.name}: (args${
                    hasAtLeastOneNonNullArg ? "" : "?"
                }: ${argsTypeName}) => ${selectionType};`;
            }

            return `${description}${field.name}${
                field.type.isNonNull ? "" : "?"
            }: ${selectionType};`;
        } else if (field.type.ofType) {
            const selectionType = new GeneratorSelectionTypeFlavorDefault(
                field.type.ofType.name,
                this.collector,
                this.options,
            ).makeSelectionFunction();

            if (field.hasArgs) {
                const { argsTypeName, hasAtLeastOneNonNullArg } =
                    collectArgTypes();

                return `${description}${field.name}: (args${
                    hasAtLeastOneNonNullArg ? "" : "?"
                }: ${argsTypeName} ) => typeof ${selectionType};`;
            }

            if (parentIsInput) {
                return `${description}${field.name}${
                    field.type.isNonNull ? "" : "?"
                }: ${this.originalTypeNameToTypescriptTypeName(
                    field.type.ofType.name,
                )};`;
            }

            return `${description}${field.name}: typeof ${selectionType};`;
        } else {
            console.error(field.type);
            throw new Error(
                `Unknown type for field ${field.name}: ${field.type.name}`,
            );
        }
    }

    public makeSelectionType(): string {
        if (this.typeMeta.isDirective) {
            return "";
        }

        if (this.typeMeta.isScalar || this.typeMeta.isEnum) {
            return this.makeSelectionTypeInputValueForFieldWrapperType(
                this.typeName,
                this.typeMeta,
            );
        }
        const selectionTypeName = this.typeMeta.isInput
            ? this.originalTypeNameToTypescriptTypeNameWithoutModifiers(
                  this.originalFullTypeName,
              )
            : this.typeName;

        if (this.collector.hasSelectionType(this.typeMeta)) {
            return selectionTypeName;
        }

        let selectionType = "";

        if (this.typeMeta.isUnion) {
            const types = this.typeMeta.possibleTypes
                .map((t) =>
                    this.originalTypeNameToTypescriptFriendlyName(t.name),
                )
                .join(" | ");

            selectionType = `
                export type ${selectionTypeName} = ${types};
            `;
        } else {
            selectionType = `
            export type ${selectionTypeName} = {
                ${(this.typeMeta.isInput
                    ? this.typeMeta.inputFields
                    : this.typeMeta.fields
                )
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

    protected makeSelectionFunctionInputObjectValueForFieldWrapper(
        field: FieldMeta,
        parents: string[],
    ): string {
        const argsTypeName = `${parents.join()}${field.name
            .slice(0, 1)
            .toUpperCase()}${field.name.slice(1)}Args`;

        return `${
            field.hasArgs ? `(args: ${argsTypeName}) => ` : ""
        }new SelectionWrapper(
            "${field.name}",
            "${field.type.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}",
            ${field.type.isList ?? 0},
            {},
            this,
            undefined,
            ${field.hasArgs ? `args, ${argsTypeName}Meta` : ""})`;
    }

    protected makeSelectionFunctionInputObjectValueForField(
        field: FieldMeta,
        parents: string[],
    ): string {
        const collectArgMeta = () => {
            const argsTypeName = `${parents.join()}${field.name
                .slice(0, 1)
                .toUpperCase()}${field.name.slice(1)}Args`;

            if (!this.collector.hasArgumentMeta(argsTypeName)) {
                const argsMetaBody = field.args
                    .map((arg) => {
                        return `${arg.name}: "${arg.type.name}",`;
                    })
                    .join(" ");
                const argsMeta = `{ ${argsMetaBody} }`;
                this.collector.addArgumentMeta(
                    argsTypeName,
                    `export const ${argsTypeName}Meta = ${argsMeta} as const;`,
                );
            }

            return {
                argsTypeName,
            };
        };

        const fieldType = field.type;
        if (fieldType.isScalar || fieldType.isEnum) {
            let selectionFunction =
                this.makeSelectionFunctionInputObjectValueForFieldWrapper(
                    field,
                    parents,
                );

            if (field.hasArgs) {
                collectArgMeta();
            }
            this.collector.addSelectionFunction(fieldType, selectionFunction);

            return `${field.name}: ${selectionFunction}`;
        } else if (fieldType.ofType) {
            const selectionFunction = new GeneratorSelectionTypeFlavorDefault(
                fieldType.ofType.name,
                this.collector,
                this.options,
            ).makeSelectionFunction();

            if (field.hasArgs) {
                const { argsTypeName } = collectArgMeta();

                return `${field.name}: (args: ${argsTypeName}) => ${selectionFunction}.bind({ collector: this, fieldName: "${field.name}", args, argsMeta: ${argsTypeName}Meta })`;
            }
            return `${field.name}: ${selectionFunction}.bind({ collector: this, fieldName: "${field.name}" })`;
        } else {
            console.error(fieldType);
            throw new Error(
                `Unknown type for field ${field.name}: ${fieldType.name}`,
            );
        }
    }

    public makeDirective() {
        if (!this.typeMeta.isDirective) {
            return "";
        }

        const directiveFunctionName = `_directive_${this.typeMeta.isDirective.name}`;

        if (this.collector.hasDirectiveFunction(this.typeMeta.isDirective)) {
            return directiveFunctionName;
        }

        const argsTypeName = `${this.typeName}Args`;
        if (!this.collector.hasArgumentType(argsTypeName)) {
            const argsTypeBody = this.typeMeta.isDirective.args
                .map((arg) => {
                    const isScalar = arg.type.isScalar;
                    const isEnum = arg.type.isEnum;
                    const isInput = arg.type.isInput;
                    const argKey = `${arg.name}${arg.type.isNonNull ? "" : "?"}`;

                    let argType = "any";
                    if (isScalar) {
                        argType = arg.type.scalarTSType
                            ? `ScalarTypeMapWithCustom["${arg.type.name
                                  .replaceAll("!", "")
                                  .replaceAll("[", "")
                                  .replaceAll("]", "")}"]`
                            : this.ScalarTypeMap().get(
                                  arg.type.name
                                      .replaceAll("!", "")
                                      .replaceAll("[", "")
                                      .replaceAll("]", ""),
                              ) ?? "any";
                    } else if (isInput || isEnum) {
                        argType = this.originalTypeNameToTypescriptTypeName(
                            arg.type.name,
                        );
                    }

                    return `
                /** ${arg.description ?? `${argKey}`} */
                ${argKey}: ${argType};`;
                })
                .join(" ");

            this.collector.addArgumentType(
                argsTypeName,
                `export type ${argsTypeName} = { ${argsTypeBody} };`,
            );
        }
        if (!this.collector.hasArgumentMeta(argsTypeName)) {
            const argsMetaBody = this.typeMeta.isDirective.args
                .map((arg) => {
                    return `${arg.name}: "${arg.type.name}",`;
                })
                .join(" ");
            const argsMeta = `{ ${argsMetaBody} }`;
            this.collector.addArgumentMeta(
                argsTypeName,
                `export const ${argsTypeName}Meta = ${argsMeta} as const;`,
            );
        }

        const directiveFunction = `
            export const ${directiveFunctionName} = (
                args: ${argsTypeName}
            ) => <F>(
                f: F
            ) => {
                (f as any)[SLW_DIRECTIVE] = "${this.typeMeta.isDirective.name}";
                (f as any)[SLW_DIRECTIVE_ARGS] = args;
                (f as any)[SLW_DIRECTIVE_ARGS_META] = ${argsTypeName}Meta;
                return f;
            }
        `;
        this.collector.addDirectiveFunction(
            this.typeMeta.isDirective,
            directiveFunction,
        );

        return directiveFunctionName;
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
            this.collector.addSelectionFunction(
                this.typeMeta,
                selectionFunctionName,
            );
        }

        const typeHasScalars = this.typeMeta.fields.some(
            (f) => f.type.isScalar || f.type.isEnum,
        );

        const isRootType =
            this.typeMeta.name === this.collector.QueryTypeName ||
            this.typeMeta.name === this.collector.MutationTypeName ||
            this.typeMeta.name === this.collector.SubscriptionTypeName;

        let helperFunctions = "";
        if (this.typeMeta.isUnion) {
            helperFunctions = `
            $on: {
                ${this.typeMeta.possibleTypes
                    .map(
                        (
                            t,
                        ) => `${t.name}: ${this.originalTypeNameToTypescriptFriendlyName(t.name)}Selection.bind({
                        collector: this,
                        fieldName: "",
                        onTypeFragment: "${t.name}",
                    }),`,
                    )
                    .join("\n")}
                }
            `;
        } else {
            helperFunctions = `
            $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
                f.bind({
                    collector: this,
                    fieldName: "",
                    isFragment: f.name,
                }) as ((...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>),
            ${
                typeHasScalars
                    ? `
            $scalars: () =>
                selectScalars(
                        make${selectionFunctionName}Input.bind(this)(),
                    ) as SLWsFromSelection<
                        ReturnType<typeof make${selectionFunctionName}Input>
                    >,
            `
                    : ""
            }`;
        }
        const makeSelectionFunctionInputReturnTypeParts = new Map<
            string,
            [argsPart: string, retPart: string]
        >();

        const selectionFunction = `
            export function make${selectionFunctionName}Input(this: any) ${this.typeMeta.isUnion ? "" : `: ReturnTypeFrom${selectionFunctionName}`} {
                return {
                    ${this.typeMeta.fields
                        .map(
                            (field) =>
                                [
                                    field,
                                    this.makeSelectionFunctionInputObjectValueForField(
                                        field,
                                        this.typeMeta.isInput
                                            ? []
                                            : [this.typeName],
                                    ),
                                ] as const,
                        )
                        .map(([field, fieldSlfn]) => {
                            const lazyModiferType = `
                            $lazy: (
                                ${
                                    field.hasArgs
                                        ? `args: ${this.typeName}${field.name
                                              .slice(0, 1)
                                              .toUpperCase()}${field.name.slice(1)}Args`
                                        : ""
                                }
                            ) => Promise<"T">`;
                            makeSelectionFunctionInputReturnTypeParts.set(
                                field.name,
                                [
                                    `${
                                        field.hasArgs
                                            ? `(
                                        args: ${this.typeName}${field.name
                                            .slice(0, 1)
                                            .toUpperCase()}${field.name.slice(1)}Args
                                    ) =>`
                                            : ""
                                    }`,
                                    `${
                                        field.type.isScalar || field.type.isEnum
                                            ? `SelectionWrapperImpl<"${field.name}", "${field.type.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}", ${field.type.isList}, {}, ${
                                                  field.hasArgs
                                                      ? `${this.typeName}${field.name
                                                            .slice(0, 1)
                                                            .toUpperCase()}${field.name.slice(1)}Args`
                                                      : "undefined"
                                              }>`
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
                                                ${
                                                    isRootType
                                                        ? `,
                                                { 
                                                    ${lazyModiferType} ${
                                                        this.authConfig
                                                            ? `& {
                                                        auth: (auth: FnOrPromisOrPrimitive) => Promise<"T">;
                                                    }`
                                                            : ""
                                                    };
                                                    ${this.authConfig ? `auth: (auth: FnOrPromisOrPrimitive) => Promise<"T"> & {${lazyModiferType}}` : ""}
                                                },
                                                "$lazy" ${this.authConfig ? `| "auth"` : ""},
                                                AS_PROMISE
                                                `
                                                        : ""
                                                }
                                            >
                                        >`
                                    }`,
                                ],
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
        type ReturnTypeFrom${selectionFunctionName}RetTypes<AS_PROMISE = 0> = {
        ${Array.from(makeSelectionFunctionInputReturnTypeParts)
            .map(([k, [argsPart, retPart]]) => `${k}: ${retPart}`)
            .join("\n")}
        }
        type ReturnTypeFrom${selectionFunctionName} = {
            ${Array.from(makeSelectionFunctionInputReturnTypeParts)
                .map(
                    ([k, [argsPart, retPart]]) =>
                        `${k}: ${argsPart} ReturnTypeFrom${selectionFunctionName}RetTypes["${k}"]`,
                )
                .join("\n")}
        } & {
            $fragment: <F extends (this: any, ...args: any[]) => any>(
                f: F,
            ) => (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>;
            ${
                typeHasScalars
                    ? `
            $scalars: () => SLWsFromSelection<ReturnType<typeof ${`make${selectionFunctionName}Input`}>>;
            `
                    : ""
            }
        };`;
        this.collector.addSelectionFunction(
            this.typeMeta,
            `${selectionFunctionReturnType}
            ${selectionFunction}
        `,
        );

        return selectionFunctionName;
    }

    public static makeRootOperationFunction(
        collector: Collector,
        authConfig?: {
            headerName: string;
        },
    ): string {
        // get the root operation types
        const QueryTypeName = collector.QueryTypeName;
        const MutationTypeName = collector.MutationTypeName;
        const SubscriptionTypeName = collector.SubscriptionTypeName;
        const availOperations = [
            QueryTypeName,
            MutationTypeName,
            SubscriptionTypeName,
        ].filter(Boolean) as string[];

        const directives = [...collector.types.values()]
            .filter((t) =>
                t.isDirective?.locations.some((l) =>
                    [
                        DirectiveLocation.FIELD,
                        DirectiveLocation.FRAGMENT_SPREAD,
                        DirectiveLocation.INLINE_FRAGMENT,
                    ].includes(l),
                ),
            )
            .map((t) => {
                return `"${t.isDirective!.name}": ${new GeneratorSelectionTypeFlavorDefault(
                    t.name,
                    collector,
                    {},
                ).makeDirective()}`;
            });

        const rootOperationFunction = `
            ${
                directives?.length
                    ? `export const $directives = {
                        ${directives.join(",\n")}
                    } as const;`
                    : ""
            }
            export function _makeRootOperationInput(this: any) {
                return {
                    ${availOperations
                        .filter((op) => collector.types.has(op))
                        .map((op) => {
                            return `${op}: ${op}Selection.bind({
                                collector: this,
                                isRootType: "${op}",
                    }),`;
                        })
                        .join("\n")}

                    ${
                        directives?.length
                            ? `
                        $directives,`
                            : ""
                    }
                } as const;
            };

            function __client__ <
                T extends object,
                F extends ReturnType<typeof _makeRootOperationInput>>(
                this: any, 
                s: (selection: F) => T
            ) {
                const root = new OperationSelectionCollector(undefined, undefined, new RootOperation());
                const rootRef = { ref: root };
                const selection: F = _makeRootOperationInput.bind(rootRef)() as any;
                const r = s(selection);
                const _result = new SelectionWrapper(undefined, undefined, undefined, r, root, undefined) as unknown as T;
                Object.keys(r).forEach((key) => (_result as T)[key as keyof T]);
                
                type excludeLazy<T> = { [key in Exclude<keyof T, "$lazy">]: T[key] };

                // remove the $lazy property from the result
                const result = _result as {
                    [k in keyof T]: T[k] extends { $lazy: any }
                        ? // if T[k] is an array and has a $lazy property, return the type of the array elements
                        T[k] extends (infer U)[] & { $lazy: any }
                            ? U[]
                            : // if T[k] is an object and has a $lazy property, return the type of the object
                            excludeLazy<T[k]>
                        : // if T[k] is a function and has a $lazy property, return the type of the function
                        T[k] extends (args: infer A) => Promise<infer R>
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

                const resultProxy = new Proxy(
                    {},
                    {
                        get(_t, _prop) {
                            const rAtProp = result[_prop as keyof T];
                            if (typeof rAtProp === "function") {
                                return rAtProp;
                            }
                            const promise = new Promise((resolve, reject) => {
                                root.execute()
                                    .catch(reject)
                                    .then(() => {
                                        resolve(rAtProp);
                                    });
                            });
                            if (String(_prop) === "then") {
                                return promise.then.bind(promise);
                            }
                            return promise;
                        },
                    },
                ) as any;

                return ${
                    authConfig
                        ? `new Proxy(
                    {},
                    {
                        get(_t, _prop) {
                            if (String(_prop) === "auth") {
                                return (auth: FnOrPromisOrPrimitive) => {
                                    root.op!.setAuth(auth);
                                    return resultProxy;
                                };
                            }
                            return resultProxy[_prop];
                        },
                    },
                )`
                        : `resultProxy`
                } as finalReturnTypeBasedOnIfHasLazyPromises & {
                    auth: (
                        auth: FnOrPromisOrPrimitive,
                    ) => finalReturnTypeBasedOnIfHasLazyPromises;
                };
            };

            const __init__ = (options: {
                ${authConfig ? `auth?: FnOrPromisOrPrimitive;` : ""}
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
                ${
                    authConfig
                        ? `
                if (typeof options.auth === "string") {
                    RootOperation[OPTIONS].headers = {
                        "${authConfig.headerName}": options.auth,
                    };
                } else if (typeof options.auth === "function" ) {
                    RootOperation[OPTIONS]._auth_fn = options.auth;
                }
                else if (options.auth) {
                    RootOperation[OPTIONS].headers = options.auth;
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

            const _makeOperationShortcut = <O extends ${availOperations.map((op) => `"${op}"`).join(" | ")}>(
                operation: O,
                field: Exclude<
                    ${
                        availOperations.length === 1
                            ? `keyof ReturnTypeFrom${availOperations[0]}Selection,`
                            : `typeof operation extends "${availOperations[0]}"
                        ? keyof ReturnTypeFrom${availOperations[0]}Selection
                        : ${
                            availOperations.length > 2
                                ? `
                            typeof operation extends "${availOperations[1]}"
                            ? keyof ReturnTypeFrom${availOperations[1]}Selection
                            : keyof ReturnTypeFrom${availOperations[2]}Selection,`
                                : `keyof ReturnTypeFrom${availOperations[1]}Selection,`
                        }`
                    }
                    "$fragment" | "$scalars"
                >,
            ) => {
                const root = new OperationSelectionCollector(
                    undefined,
                    undefined,
                    new RootOperation(),
                );
                const rootRef = { ref: root };

                let fieldFn: ${availOperations
                    .map(
                        (opType) => `
                    ReturnTypeFrom${opType}Selection[Exclude<
                        keyof ReturnTypeFrom${opType}Selection,
                        "$fragment" | "$scalars"
                    >]`,
                    )
                    .join(" | ")};
                
                    ${
                        availOperations.length > 1
                            ? `if (operation === "${availOperations[0]}") {`
                            : ""
                    }
                    fieldFn =
                        make${availOperations[0]}SelectionInput.bind(rootRef)()[
                            field as Exclude<
                                keyof ReturnTypeFrom${availOperations[0]}Selection,
                                "$fragment" | "$scalars"
                            >
                        ];
                ${
                    availOperations.length > 1
                        ? `} else ${
                              availOperations.length > 2
                                  ? `if (operation === "${availOperations[1]}")`
                                  : ""
                          }`
                        : ""
                }${
                    availOperations.length > 1
                        ? `{
                    fieldFn =
                        make${availOperations[1]}SelectionInput.bind(rootRef)()[
                            field as Exclude<
                                keyof ReturnTypeFrom${availOperations[1]}Selection,
                                "$fragment" | "$scalars"
                            >
                        ];
                }`
                        : ""
                }
                ${
                    availOperations.length > 2
                        ? `else {
                    fieldFn =
                        make${availOperations[2]}SelectionInput.bind(rootRef)()[
                            field as Exclude<
                                keyof ReturnTypeFrom${availOperations[2]}Selection,
                                "$fragment" | "$scalars"
                            >
                        ];
                }`
                        : ""
                }

                if (typeof fieldFn === "function") {
                    const makeSubSelectionFn =
                        (
                            opFnArgs?: Exclude<
                                Parameters<typeof fieldFn>[0],
                                (args: any) => any
                            >,
                        ) =>
                        (opFnSelectionCb: (selection: unknown) => unknown) => {
                            const fieldSLFN =
                                opFnArgs === undefined
                                    ? fieldFn
                                    : (
                                        fieldFn as (
                                            args: typeof opFnArgs,
                                        ) => (s: typeof opFnSelectionCb) => unknown
                                    )(opFnArgs);

                            const fieldSlw = fieldSLFN(
                                opFnSelectionCb as any,
                            ) as unknown as SelectionWrapperImpl<
                                typeof field,
                                string,
                                number,
                                any,
                                typeof opFnArgs
                            >;
                            const opSlw = new SelectionWrapper(
                                undefined,
                                undefined,
                                undefined,
                                { [field]: fieldSlw },
                                new OperationSelectionCollector(
                                    operation + "Selection",
                                    root,
                                ),
                                root,
                            );
                            fieldSlw[SLW_PARENT_SLW] = opSlw;
                            opSlw[SLW_IS_ROOT_TYPE] = operation;
                            opSlw[SLW_PARENT_COLLECTOR] = opSlw[SLW_COLLECTOR];
                            // access the keys of the proxy object, to register operations
                            (opSlw as any)[field as any];
                            const rootSlw = new SelectionWrapper(
                                undefined,
                                undefined,
                                undefined,
                                opSlw,
                                root,
                            );
                            opSlw[ROOT_OP_COLLECTOR] = rootRef;
                            // access the keys of the proxy object, to register operations
                            (rootSlw as any)[field as any];
                                
                            const resultProxy = new Proxy(
                                {},
                                {
                                    get(_t, _prop) {
                                        if (String(_prop) === "$lazy") {
                                            return (fieldSlw as any)["$lazy"].bind({
                                                parentSlw: opSlw,
                                                key: field,
                                            });
                                        } else {
                                            const result = new Promise((resolve, reject) => {
                                                root.execute()
                                                    .catch(reject)
                                                    .then(() => {
                                                        resolve((rootSlw as any)[field]);
                                                    });
                                            });
                                            if (String(_prop) === "then") {
                                                return result.then.bind(result);
                                            }
                                            return result;
                                        }
                                    },
                                },
                            ) as any;

                            return ${
                                authConfig
                                    ? `new Proxy(
                                {},
                                {
                                    get(_t, _prop) {
                                        if (String(_prop) === "auth") {
                                            return (auth: FnOrPromisOrPrimitive) => {
                                                root.op!.setAuth(auth);
                                                return resultProxy;
                                            };
                                        }
                                        return resultProxy[_prop];
                                    },
                                },
                            )`
                                    : `resultProxy`
                            };
                        };

                    // if the fieldFn is the SLFN subselection function without an (args) => .. wrapper
                    if (fieldFn.name === "bound _SLFN") {
                        return makeSubSelectionFn();
                    }
                    return (
                        opFnArgs: Exclude<
                            Parameters<typeof fieldFn>[0],
                            (args: any) => any
                        >,
                    ) => {
                        return makeSubSelectionFn(opFnArgs);
                    };
                } else {
                    const fieldSlw = fieldFn as SelectionWrapperImpl<any, any, any>;
                    const opSlw = new SelectionWrapper(
                        undefined,
                        undefined,
                        undefined,
                        { [field]: fieldSlw },
                        new OperationSelectionCollector(operation + "Selection", root),
                        root,
                    );
                    fieldSlw[ROOT_OP_COLLECTOR] = rootRef;
                    opSlw[SLW_IS_ROOT_TYPE] = operation;
                    opSlw[SLW_PARENT_COLLECTOR] = opSlw[SLW_COLLECTOR];
                    opSlw[SLW_PARENT_SLW] = opSlw;
                    // access the keys of the proxy object, to register operations
                    (opSlw as any)[field as any];
                    const rootSlw = new SelectionWrapper(
                        undefined,
                        undefined,
                        undefined,
                        opSlw,
                        root,
                    );
                    opSlw[ROOT_OP_COLLECTOR] = rootRef;
                    // access the keys of the proxy object, to register operations
                    (rootSlw as any)[field as any];

                    const resultProxy = new Proxy(
                        {},
                        {
                            get(_t, _prop) {
                                if (String(_prop) === "$lazy") {
                                    return (fieldSlw as any)["$lazy"].bind({
                                        parentSlw: opSlw,
                                        key: field,
                                    });
                                } else {
                                    const result = new Promise((resolve, reject) => {
                                        root.execute()
                                            .catch(reject)
                                            .then(() => {
                                                resolve((rootSlw as any)[field]);
                                            });
                                    });
                                    if (String(_prop) === "then") {
                                        return result.then.bind(result);
                                    }
                                    return result;
                                }
                            },
                        },
                    ) as any;

                    return ${
                        authConfig
                            ? `new Proxy(
                        {},
                        {
                            get(_t, _prop) {
                                if (String(_prop) === "auth") {
                                    return (auth: FnOrPromisOrPrimitive) => {
                                        root.op!.setAuth(auth);
                                        return resultProxy;
                                    };
                                }
                                return resultProxy[_prop];
                            },
                        },
                    )`
                            : `resultProxy`
                    };
                }
            };

            ${availOperations
                .map(
                    (operation) => `
                Object.defineProperty(__client__, "${operation.toLowerCase()}", {
                    enumerable: false,
                    get() {
                        return new Proxy(
                            {},
                            {
                                get(
                                    target,
                                    op: Exclude<
                                        keyof ReturnTypeFrom${operation}Selection,
                                        "$fragment" | "$scalars"
                                    >,
                                ) {
                                    return _makeOperationShortcut("${operation}", op);
                                },
                            },
                        );
                    },
                });
            `,
                )
                .join("\n")}

            export default __client__ as typeof __client__ & {
                init: typeof __init__;
            } & {
                ${availOperations
                    .map(
                        (op) =>
                            `${op?.toLowerCase()}: {
                                [field in Exclude<
                                    keyof ReturnType<typeof make${op}SelectionInput>,
                                    "$fragment" | "$scalars"
                                >]: ReturnType<
                                    typeof make${op}SelectionInput
                                >[field] extends SelectionWrapperImpl<
                                    infer FN,
                                    infer TTNP,
                                    infer TTAD,
                                    infer VT,
                                    infer AT
                                >
                                    ? ToTArrayWithDepth<SLW_TPN_ToType<TTNP>, TTAD> & {
                                        $lazy: () => Promise<
                                            ToTArrayWithDepth<SLW_TPN_ToType<TTNP>, TTAD>
                                        > ${
                                            authConfig
                                                ? `& {
                                                    auth: (
                                                        auth: FnOrPromisOrPrimitive,
                                                    ) => Promise<
                                                        ToTArrayWithDepth<SLW_TPN_ToType<TTNP>, TTAD>
                                                    >
                                                }
                                            `
                                                : ""
                                        };
                                        ${
                                            authConfig
                                                ? `auth: (token: FnOrPromisOrPrimitive) => Promise<"T"> & {
                                            $lazy: () => Promise<
                                                ToTArrayWithDepth<SLW_TPN_ToType<TTNP>, TTAD>
                                            >;
                                        };`
                                                : ""
                                        }
                                    }
                                    : ReturnType<typeof make${op}SelectionInput>[field]extends (
                                            args: infer A,
                                        ) => (selection: any) => any
                                    ? (args: A) => ReturnTypeFrom${op}SelectionRetTypes<1>[field]
                                    : ReturnType<typeof make${op}SelectionInput>[field] extends (
                                        args: infer _A,
                                    ) => SelectionWrapperImpl<
                                        infer _FN,
                                        infer _TTNP,
                                        infer _TTAD,
                                        infer _VT,
                                        infer _AT
                                    >
                                    ? (args: _A) => ToTArrayWithDepth<
                                        SLW_TPN_ToType<_TTNP>,
                                        _TTAD
                                    > & {
                                        $lazy: (args: _A) => Promise<
                                            ToTArrayWithDepth<SLW_TPN_ToType<_TTNP>, _TTAD>
                                        > ${
                                            authConfig
                                                ? `& {
                                                    auth: (
                                                        auth: FnOrPromisOrPrimitive,
                                                    ) => Promise<
                                                        ToTArrayWithDepth<SLW_TPN_ToType<_TTNP>, _TTAD>
                                                    >;
                                                }
                                            `
                                                : ""
                                        };
                                        ${
                                            authConfig
                                                ? `auth: (token: FnOrPromisOrPrimitive) => Promise<"T"> & {
                                            $lazy: () => Promise<
                                                ToTArrayWithDepth<SLW_TPN_ToType<_TTNP>, _TTAD>
                                            >;
                                        };`
                                                : ""
                                        }
                                    }
                                    : ReturnTypeFrom${op}SelectionRetTypes<1>[field];
                            };`,
                    )
                    .join("\n")}
            }
        `;

        return rootOperationFunction;
    }
}
