import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { GeneratorSelectionTypeFlavor } from "../builder/base";
import type { Collector } from "../builder/collector";
import {
    type CodegenOptions,
    type TypeMeta,
    type FieldMeta,
    type OperationMeta,
    type ParameterMeta,
} from "../builder/meta";

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

    public static readonly FieldValueWrapperType = readFileSync(
        join(import.meta.dir ?? __dirname, "wrapper.ts"),
    ).toString();

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
    public static UnionTypesMapped = (collector: Collector) => {
        return `export interface UnionTypesMapped {
            ${Array.from(collector.types.entries())
                .filter(([_, t]) => t.isUnion)
                .map(
                    ([name, t]) =>
                        [
                            name
                                .replaceAll("[", "")
                                .replaceAll("]", "")
                                .replaceAll("!", ""),
                            t,
                        ] as const,
                )
                .map(
                    ([k, t]) =>
                        `"${k}": ${k}${t.isList && !t.isInput ? "Array" : ""};`,
                )
                .filter((k, i, arr) => arr.indexOf(k) === i)
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
        opPath?: string;
        method?: "get" | "post" | "put" | "delete" | "patch" | "head" | "options" | "trace";
        args?: Record<string, any>;
        argsMeta?: Record<string, { type: string; location: "path" | "query" | "header" | "cookie" | "body" }>;
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
                    function (this: OperationSelectionCollector) {
                        return s(makeSLFNInput.bind(this)() as FF);
                    },
                );

                _result[ROOT_OP_META] = parent?.opPath ? {
                        path: parent.opPath,
                        method: parent.method!,
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
        let enumTypeName =
            this.originalTypeNameToTypescriptTypeNameWithoutModifiers(
                this.originalFullTypeName,
            );

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

        const conformEnumName = (str: string) =>
            str.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[0-9]/, "_$&");

        const enumTypeBody =
            this.typeMeta.enumValues.length === 0
                ? "undefined" // handle empty enums (even though they shouldn't exist, they sometimes do)
                : this.typeMeta.enumValues
                      .map((e) => `"${e.name}"`)
                      .join(" | ");
        const enumEnumBody = this.typeMeta.enumValues
            .map(
                (e) =>
                    `${
                        e.description ? `/** ${e.description} */\n` : ""
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
            this.collector.getEnumTypeByName(enumTypeName) !==
                enumType(enumTypeName)
        ) {
            // in OpenAPI, enums are not unique, so we need to make sure the name is unique
            let i = 0;
            let newEnumTypeName: string[] = [enumTypeName];
            while (this.collector.hasEnumTypeName(newEnumTypeName.join("_"))) {
                newEnumTypeName = [enumTypeName, (++i).toString()];
            }
            this.typeMeta.name = newEnumTypeName.join("_");
            this.collector.addEnumType(
                this.typeMeta,
                enumType(this.typeMeta.name),
            );
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

            return `${description}${field.name}${
                field.type.isNonNull ? "" : "?"
            }: ${selectionType};`;

            //
        } else if (
            field.type.isUnion &&
            field.type.possibleTypes.every((pt) => pt.isScalar || pt.isEnum)
        ) {
            //

            return `${description}${field.name}${
                field.type.isNonNull ? "" : "?"
            }: ${Array.from({ length: field.type.isList })
                .map((_) => "Array<")
                .join("")}${field.type.name
                .replaceAll("!", "")
                .replaceAll("[", "")
                .replaceAll("]", "")}
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

            return `${description}${field.name}${
                field.type.isNonNull ? "" : "?"
            }: ${this.originalTypeNameToTypescriptTypeName(
                field.type.ofType.name,
                !field.type.isInput && field.type.isList ? "Array" : "",
            ).replaceAll("!", "")}`;

            // return `${description}${field.name}${
            //     field.type.isNonNull ? "" : "?"
            // }: ${selectionType};`;
        } else {
            console.error(field.type);
            throw new Error(
                `Unknown type for field ${field.name}: ${field.type.name}`,
            );
        }
    }

    public makeSelectionType(): string {
        if (this.typeMeta.isScalar || this.typeMeta.isEnum) {
            return this.makeSelectionTypeInputValueForFieldWrapperType(
                this.typeName,
                this.typeMeta,
            );
        }
        const selectionTypeName = this.typeMeta.isInput
            ? `${this.originalTypeNameToTypescriptTypeNameWithoutModifiers(
                  this.originalFullTypeName,
              )}`
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
                        ? this.makeSelectionTypeInputValueForFieldWrapperType(
                              t.name,
                              t,
                          )
                        : this.typeMeta.isInput
                          ? `${this.originalTypeNameToTypescriptTypeNameWithoutModifiers(
                                t.name,
                            )}`
                          : `${this.originalTypeNameToTypescriptFriendlyName(
                                t.name,
                            )}`,
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
        return `new SelectionWrapper(
            "${field.name}",
            "${field.type.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}",
            ${field.type.isList ?? 0},
            {},
            this,
            undefined,
            )`;
    }

    protected makeSelectionFunctionInputObjectValueForField(
        field: FieldMeta,
        parents: string[],
    ): string {
        const fieldType = field.type;
        if (
            fieldType.isScalar ||
            fieldType.isEnum ||
            (fieldType.isUnion &&
                fieldType.possibleTypes.every((pt) => pt.isScalar || pt.isEnum))
        ) {
            let selectionFunction =
                this.makeSelectionFunctionInputObjectValueForFieldWrapper(
                    field,
                    parents,
                );

            this.collector.addSelectionFunction(fieldType, selectionFunction);

            return `${field.name}: ${selectionFunction}`;
        } else if (fieldType.ofType) {
            const selectionFunction = new GeneratorSelectionTypeFlavorDefault(
                fieldType.ofType.name,
                this.collector,
                this.options,
            ).makeSelectionFunction();

            return `${field.name}: ${selectionFunction}.bind({ collector: this, fieldName: "${field.name}" })`;
        } else {
            console.error(fieldType);
            throw new Error(
                `Unknown type for field ${field.name}: ${fieldType.name}`,
            );
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
            this.collector.addSelectionFunction(
                this.typeMeta,
                selectionFunctionName,
            );
        }

        const typeHasScalars = this.typeMeta.fields.some(
            (f) => f.type.isScalar || f.type.isEnum,
        );

        let helperFunctions = "";
        if (
            this.typeMeta.isUnion &&
            this.typeMeta.possibleTypes.filter((t) => !t.isScalar && !t.isEnum)
                .length
        ) {
            helperFunctions = `
            $on: {
                ${this.typeMeta.possibleTypes
                    .filter((t) => !t.isScalar && !t.isEnum)
                    .map(
                        (
                            t,
                        ) => `${t.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}: ${this.originalTypeNameToTypescriptFriendlyName(t.name)}Selection.bind({
                        collector: this,
                        fieldName: "",
                    }),`,
                    )
                    .join("\n")}
                }
            `;
        } else {
            helperFunctions = `
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
                                    field.type.isScalar ||
                                    field.type.isEnum ||
                                    (field.type.isUnion &&
                                        field.type.possibleTypes.every(
                                            (pt) => pt.isScalar || pt.isEnum,
                                        ))
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
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n")}
        } & {
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

    public static makeOperationFunctions(
        operations: OperationMeta[],
        collector: Collector,
        options: CodegenOptions,
    ): string[] {
        const fns: string[] = [];

        const conformToTypeKey = (str: string) => {
            if (str.includes("-") || !isNaN(+str.at(0)!)) {
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

                const argsTypeName = `${operation.name
                    .slice(0, 1)
                    .toUpperCase()}${operation.name.slice(1)}Args`;

                if (!collector.hasArgumentMeta(argsTypeName)) {
                    const argsMetaBody = operation.args
                        .map((arg) => {
                            if (
                                arg.name === "$" &&
                                (hoistQueryArgs || hoistBodyArgs)
                            ) {
                                return arg.type.inputFields
                                    .map(
                                        (f) => `${conformToTypeKey(f.name)}: {
                                    type: "${f.type.name}",
                                    location: "${arg.location}",
                                },`,
                                    )
                                    .join("\n");
                            } else if (
                                arg.name === "$" &&
                                !hoistQueryArgs &&
                                !hoistBodyArgs
                            ) {
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
                    collector.addArgumentMeta(
                        argsTypeName,
                        `export const ${argsTypeName}Meta = ${argsMeta} as const;`,
                    );
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
                    const argKey = `${conformToTypeKey(arg.name)}${
                        arg.type.isNonNull ? "" : "?"
                    }`;

                    let argType = "any";
                    if (isScalar) {
                        argType =
                            this.ScalarTypeMap.get(
                                arg.type.name.replaceAll("!", ""),
                            ) ?? "any";
                    } else if (isInput || isEnum) {
                        argType = `${this.originalTypeNameToTypescriptTypeName(
                            arg.type.name,
                        )}`;
                    }

                    return {
                        description: arg.description,
                        argKey,
                        argType,
                    };
                };

                if (!operation.args.length) return undefined;

                const hasAtLeastOneNonNullArg = operation.args.some(
                    (arg) => arg.type.isNonNull,
                );

                const argsTypeName = `${operation.name
                    .slice(0, 1)
                    .toUpperCase()}${operation.name.slice(1)}Args`;

                if (!collector.hasArgumentType(argsTypeName)) {
                    let argsType: string | undefined;

                    if (
                        operation.args.length === 1 &&
                        operation.args[0].name === "$"
                    ) {
                        argsType =
                            operation.args[0].type.isScalar &&
                            operation.args[0].type.scalarTSType
                                ? `ScalarTypeMapWithCustom["${operation.args[0].type.name.replaceAll("!", "").replaceAll("[", "").replaceAll("]", "")}"]`
                                : new GeneratorSelectionTypeFlavorDefault(
                                      operation.args[0].type.name,
                                      collector,
                                      options,
                                  ).makeSelectionType();
                    } else {
                        const argsTypeBody = operation.args
                            .map((arg) => {
                                if (
                                    arg.name === "$" &&
                                    (hoistQueryArgs || hoistBodyArgs)
                                ) {
                                    return arg.type.inputFields
                                        .map((f) => {
                                            const {
                                                description,
                                                argType,
                                                argKey,
                                            } = makeType(f);
                                            return `
                                            ${description ? `/** ${description ?? `${argKey}`} */` : ""}
                                            ${argKey}: ${argType};
                                            `;
                                        })
                                        .join("\n");
                                } else if (
                                    arg.name === "$" &&
                                    !hoistQueryArgs &&
                                    !hoistBodyArgs
                                ) {
                                    const { description, argType } =
                                        makeType(arg);

                                    return `
                                    ${description ? `/** ${description ?? `${arg.location === "query" ? "$query" : "$body"}`} */` : ""}
                                    ${arg.location === "query" ? "$query" : "$body"}: ${argType};
                                    `;
                                }

                                const { description, argType, argKey } =
                                    makeType(arg);

                                return `
                                ${description ? `/** ${description ?? `${argKey}`} */` : ""}
                                ${argKey}: ${argType};
                                `;
                            })
                            .join(" ");

                        argsType = `{ ${argsTypeBody} }`;
                    }

                    collector.addArgumentType(
                        argsTypeName,
                        `export type ${argsTypeName} = ${argsType};`,
                    );
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
                    ? `makeSLFN(
                        () => ({
                            [OP_SCALAR_RESULT]: new SelectionWrapper(
                                "${operation.type.name}",
                                "${operation.type.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}",
                                ${operation.type.isList ?? 0},
                                {},
                                this,
                                undefined,
                                ${argMeta ? `args, ${argMeta.argsTypeName}Meta` : ""}
                            )
                        }),
                        "${operation.name}",
                        "${operation.type.name.replaceAll("[", "").replaceAll("]", "").replaceAll("!", "")}",
                        ${operation.type.isList ?? 0}
                    )`
                    : new GeneratorSelectionTypeFlavorDefault(
                          operation.type.name,
                          collector,
                          options,
                      ).makeSelectionFunction();

            const operationAsOpNameToFunction = `
                ${operation.name}: (${argTypes ? `args: ${argTypes.argsTypeName}` : ""}) => 
                    ${returnTypeSelectionFunctionNameOrScalarOrEnum}.bind({
                        collector: this,
                        fieldName: "${operation.name}",
                        opPath: "${operation.path}",
                        method: "${operation.method}",
                        ${argMeta ? `args, argsMeta: ${argMeta.argsTypeName}Meta` : ""}
                    })${operation.type.isScalar || operation.type.isEnum ? "((s) => s)" : ""},
            `;

            fns.push(operationAsOpNameToFunction);
        }

        return fns;
    }

    public static makeRootOperationFunction(
        operations: OperationMeta[],
        collector: Collector,
        options: CodegenOptions,
        authConfig?: {
            headerName: string;
        },
    ): string {
        const rootOperationFunction = `
            export function _makeRootOperationInput(this: any) {
                return {
                    ${this.makeOperationFunctions(operations, collector, options).join("\n")}
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

                let headers: Record<string, string> | undefined = undefined;
                let returnValue: finalReturnTypeBasedOnIfHasLazyPromises;
                
                if (Object.values(result).some((v) => typeof v !== "function")) {
                    returnValue = new Promise((resolve, reject) => {
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
                        }) as finalReturnTypeBasedOnIfHasLazyPromises;
                }
                else {
                    returnValue = result as finalReturnTypeBasedOnIfHasLazyPromises;
                }
                
                ${
                    authConfig
                        ? `
                Object.defineProperty(returnValue, "auth", {
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

                                        return returnValue;
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

                            return returnValue;
                        };
                    },
                });

                return returnValue as finalReturnTypeBasedOnIfHasLazyPromises & {
                    auth: (
                        auth: __AuthenticationArg__,
                    ) => finalReturnTypeBasedOnIfHasLazyPromises;
                };
                `
                        : `
                return returnValue;
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
