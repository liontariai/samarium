import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { GeneratorSelectionTypeFlavor } from "../../builder/base";
import type { Collector } from "../../builder/collector";
import {
    type CodegenOptions,
    type TypeMeta,
    type FieldMeta,
} from "../../builder/meta";
import { DirectiveLocation } from "graphql";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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
        ["Time", "Date"],
        ["JSON", "Record<string, any>"],
    ]);
    public ScalarTypeMap: Map<string, string> =
        GeneratorSelectionTypeFlavorDefault.ScalarTypeMap;

    public static readonly FieldValueWrapperType = readFileSync(
        join(import.meta.dir ?? __dirname, "wrapper.ts"),
    ).toString();
    public static readonly HelperTypes = `
    export interface ScalarTypeMapWithCustom {}
    export interface ScalarTypeMapDefault {
        ${Array.from(GeneratorSelectionTypeFlavorDefault.ScalarTypeMap)
            .map(([k, v]) => `"${k}": ${v};`)
            .join("\n")}
    };

    type SelectionFnParent = {
        collector: OperationSelectionCollector;
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

    type ReplaceReturnType<T, R> = T extends (...a: any) => any
    ? (
          ...a: Parameters<T>
      ) => ReturnType<T> extends Promise<any> ? Promise<R> : R
    : never;
    type SLW_TPN_ToType<TNP> = TNP extends keyof ScalarTypeMapWithCustom
        ? ScalarTypeMapWithCustom[TNP]
        : TNP extends keyof ScalarTypeMapDefault
        ? ScalarTypeMapDefault[TNP]
        : never;
    type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ...0[]];
    type ToTArrayWithDepth<T, D extends number> = D extends 0
        ? T
        : ToTArrayWithDepth<T[], Prev[D]>;

    export type SLFN<
        T extends object,
        F,
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
    ) => <TT = T, FF = F, EE = E>(
        this: any,
        s: (selection: FF) => TT,
    ) => ToTArrayWithDepth<
        {
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
    > & {
        [k in keyof EE]: k extends REP
            ? EE[k] extends (...args: any) => any
                ? ReplaceReturnType<
                    EE[k],
                    ToTArrayWithDepth<
                        {
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
                    >
                >
                : ToTArrayWithDepth<
                    {
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
                >
            : EE[k];
    };
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
    ) {
        super(typeName, collector, options);
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
        const type =
            this.ScalarTypeMap.get(
                fieldMeta.name
                    .replaceAll("!", "")
                    .replaceAll("[", "")
                    .replaceAll("]", ""),
            ) ?? "any";

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
                            argType =
                                this.ScalarTypeMap.get(
                                    arg.type.name.replaceAll("!", ""),
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
            : `${this.typeName}SelectionFields`;

        if (this.collector.hasSelectionType(this.typeMeta)) {
            return selectionTypeName;
        }

        let selectionType = "";

        if (this.typeMeta.isUnion) {
            const types = this.typeMeta.possibleTypes
                .map(
                    (t) =>
                        `${this.originalTypeNameToTypescriptFriendlyName(t.name)}SelectionFields`,
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
                        argType =
                            this.ScalarTypeMap.get(
                                arg.type.name.replaceAll("!", ""),
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
            string
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
                            makeSelectionFunctionInputReturnTypeParts.set(
                                field.name,
                                `${
                                    field.hasArgs
                                        ? `(
                                        args: ${this.typeName}${field.name
                                            .slice(0, 1)
                                            .toUpperCase()}${field.name.slice(1)}Args
                                    ) =>`
                                        : ""
                                } ${
                                    field.type.isScalar || field.type.isEnum
                                        ? `SelectionWrapper<"${field.name}", "${field.type.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}", ${field.type.isList}, {}, ${
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
                                                ${field.type.isList ?? 0},
                                                { 
                                                    $lazy: (
                                                        ${
                                                            field.hasArgs
                                                                ? `args: ${this.typeName}${field.name
                                                                      .slice(
                                                                          0,
                                                                          1,
                                                                      )
                                                                      .toUpperCase()}${field.name.slice(1)}Args`
                                                                : ""
                                                        }
                                                    ) => Promise<"T">
                                                },
                                                "$lazy"
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
                .map(([k, v]) => `${k}: ${v}`)
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
                    ${
                        QueryTypeName && collector.types.has(QueryTypeName)
                            ? `query: ${QueryTypeName}Selection.bind({
                        collector: this,
                        isRootType: "Query",
                    }),`
                            : ""
                    }
                    ${
                        MutationTypeName &&
                        collector.types.has(MutationTypeName)
                            ? `mutation: ${MutationTypeName}Selection.bind({
                        collector: this,
                        isRootType: "Mutation",
                    }),`
                            : ""
                    }
                    ${
                        SubscriptionTypeName &&
                        collector.types.has(SubscriptionTypeName)
                            ? `subscription: ${SubscriptionTypeName}Selection.bind({
                        collector: this,
                        isRootType: "Subscription",
                    }),`
                            : ""
                    }

                    ${
                        directives?.length
                            ? `
                        $directives,`
                            : ""
                    }
                } as const;
            };

            ${
                authConfig
                    ? `type __AuthenticationArg__ =
            | string
            | { [key: string]: string }
            | (() => string | { [key: string]: string })
            | (() => Promise<string | { [key: string]: string }>);`
                    : ""
            }
            function __client__ <
                T extends object,
                F extends ReturnType<typeof _makeRootOperationInput>>(
                this: any, 
                s: (selection: F) => T
            ) {
                const root = new OperationSelectionCollector(undefined, undefined, new RootOperation());
                const selection: F = _makeRootOperationInput.bind(root)() as any;
                const r = s(selection);
                const _result = new SelectionWrapper(undefined, undefined, undefined, r, root, undefined) as unknown as T;
                Object.keys(r).forEach((key) => (_result as T)[key as keyof T]);
                const result = _result as {
                    [k in keyof T]: T[k] extends (...args: infer A) => any ? (...args: A) => Omit<
                        ReturnType<T[k]>, "$lazy"
                    > : Omit<
                        T[k], "$lazy"
                    >
                };
                type TR = typeof result;
                
                let headers: Record<string, string> | undefined = undefined;
                const finalPromise = {
                    then: (resolve: (value: TR) => void, reject: (reason: any) => void) => {
                        ${
                            authConfig
                                ? `
                            const doExecute = () => {
                                root.execute(headers)
                                    .then(() => {
                                        resolve(result);
                                    })
                                    .catch(reject);
                            }
                            if (typeof RootOperation[OPTIONS]._auth_fn === "function") {
                                const tokenOrPromise = RootOperation[OPTIONS]._auth_fn();
                                if (tokenOrPromise instanceof Promise) {
                                    tokenOrPromise.then((t) => {
                                        if (typeof t === "string")
                                            headers = { "${authConfig.headerName}": t };
                                        else headers = t;
    
                                        doExecute();
                                    });
                                }
                                else if (typeof tokenOrPromise === "string") {
                                    headers = { "${authConfig.headerName}": tokenOrPromise };

                                    doExecute();
                                } else {
                                    headers = tokenOrPromise;

                                    doExecute();
                                }
                            }
                            else {
                                doExecute();
                            }
                        `
                                : `
                            root.execute(headers)
                            .then(() => {
                                resolve(result);
                            })
                            .catch(reject);
                        `
                        }
                    },
                };
                ${
                    authConfig
                        ? `
                Object.defineProperty(finalPromise, "auth", {
                    enumerable: false,
                    get: function () {
                        return function (
                            auth: __AuthenticationArg__,
                        ) {
                            if (typeof auth === "string") {
                                headers = { "${authConfig.headerName}": auth };
                            } else if (typeof auth === "function") {
                                const tokenOrPromise = auth();
                                if (tokenOrPromise instanceof Promise) {
                                    return tokenOrPromise.then((t) => {
                                        if (typeof t === "string")
                                            headers = { "${authConfig.headerName}": t };
                                        else headers = t;

                                        return finalPromise as Promise<TR>;
                                    });
                                }
                                if (typeof tokenOrPromise === "string") {
                                    headers = { "${authConfig.headerName}": tokenOrPromise };
                                } else {
                                    headers = tokenOrPromise;
                                }
                            } else {
                                headers = auth;
                            }

                            return finalPromise as Promise<TR>;
                        };
                    },
                });

                return finalPromise as Promise<TR> & {
                    auth: (
                        auth: __AuthenticationArg__,
                    ) => Promise<TR>;
                };
                `
                        : `
                return finalPromise as Promise<TR>;
                `
                }
            };

            const __init__ = (options: {
                ${authConfig ? `auth?: __AuthenticationArg__;` : ""}
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

            export default __client__ as typeof __client__ & {
                init: typeof __init__;
            };
        `;

        return rootOperationFunction;
    }
}
