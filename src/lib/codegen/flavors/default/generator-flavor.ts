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
import type { GraphQLSchema } from "graphql";

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
    public ScalarTypeMap: Map<string, string> = new Map([
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

    public static readonly FieldValueWrapperType = readFileSync(
        join(import.meta.dir ?? __dirname, "wrapper.ts"),
    ).toString();
    public static readonly HelperTypes = `
    type SelectionFnParent = {
        collector: OperationSelectionCollector;
        fieldName?: string;
        args?: Record<string, any>;
        argsMeta?: Record<string, string>;

        isRootType?: "Query" | "Mutation" | "Subscription";
    } | undefined;

    type CleanupNever<A> = Omit<A, keyof A> & {
        [K in keyof A as A[K] extends never ? never : K]: A[K];
    };
    type Prettify<T> = {
        [K in keyof T]: T[K];
    } & {};

    type ScalarsFromSelection<
        S,
        T,
        R = {
            [K in keyof S]: S[K] extends SelectionWrapperImpl<
                infer FN,
                infer TN,
                infer VT,
                infer AT
            >
                ? FN extends keyof T
                    ? T[FN]
                    : never
                : never;
        },
    > = Prettify<CleanupNever<R>>;
    
    type SelectionHelpers<S, T> = {
        $scalars: () => ScalarsFromSelection<S, T>;
    };
    `;
    public static readonly HelperFunctions = `
    const selectScalars = <S>(selection: Record<string, any>) =>
    Object.fromEntries(
        Object.entries(selection).filter(
            ([k, v]) => v instanceof SelectionWrapperImpl,
        ),
    ) as S;
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

        const enumType = `
            export type ${enumTypeName} = ${this.typeMeta.enumValues
                .map((e) => `"${e.name}"`)
                .join(" | ")};
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
        const description = field.description
            ? `/** ${field.description} */\n`
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
        } else if (field.type.ofType) {
            const selectionType = new GeneratorSelectionTypeFlavorDefault(
                field.type.ofType.name,
                this.collector,
                this.options,
            ).makeSelectionFunction();

            if (field.hasArgs) {
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
                                argType =
                                    this.originalTypeNameToTypescriptTypeName(
                                        arg.type.name,
                                    );
                            }

                            return `${description}${argKey}: ${argType};`;
                        })
                        .join(" ");
                    const argsType = `{ ${argsTypeBody} }`;
                    this.collector.addArgumentType(
                        argsTypeName,
                        `export type ${argsTypeName} = ${argsType};`,
                    );
                }

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

        const selectionType = `
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
        this.collector.addSelectionType(this.typeMeta, selectionType);

        return selectionTypeName;
    }

    protected makeSelectionFunctionInputObjectValueForFieldWrapper(
        fieldName: string,
        fieldMeta: TypeMeta,
    ): string {
        return `new SelectionWrapper("${fieldName}", "${fieldMeta.name}", {}, this)`;
    }

    protected makeSelectionFunctionInputObjectValueForField(
        field: FieldMeta,
        parents: string[] = [],
    ): string {
        const fieldType = field.type;
        if (fieldType.isScalar || fieldType.isEnum) {
            let selectionFunction =
                this.makeSelectionFunctionInputObjectValueForFieldWrapper(
                    field.name,
                    fieldType,
                );

            this.collector.addSelectionFunction(fieldType, selectionFunction);

            return `${field.name}: ${selectionFunction},`;
        } else if (fieldType.ofType) {
            const selectionFunction = new GeneratorSelectionTypeFlavorDefault(
                fieldType.ofType.name,
                this.collector,
                this.options,
            ).makeSelectionFunction();

            if (field.hasArgs) {
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

                return `${field.name}: (args: ${argsTypeName}) => ${selectionFunction}.bind({ collector: this, fieldName: "${field.name}", args, argsMeta: ${argsTypeName}Meta }),`;
            }
            return `${field.name}: ${selectionFunction}.bind({ collector: this, fieldName: "${field.name}" }),`;
        } else {
            console.error(fieldType);
            throw new Error(
                `Unknown type for field ${field.name}: ${fieldType.name}`,
            );
        }
    }

    public makeSelectionFunction(): string {
        if (this.typeMeta.isScalar || this.typeMeta.isEnum) {
            return this.makeSelectionFunctionInputObjectValueForFieldWrapper(
                this.typeName,
                this.typeMeta,
            );
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

        const selectionFunction = `
            export function make${selectionFunctionName}Input(this: any) {
                return {
                    ${this.typeMeta.fields
                        .map((field) =>
                            this.makeSelectionFunctionInputObjectValueForField(
                                field,
                                this.typeMeta.isInput ? [] : [this.typeName],
                            ),
                        )
                        .join("\n")}

                    $scalars: () =>
                        selectScalars(
                            make${selectionFunctionName}Input.bind(this)(),
                        ) as ScalarsFromSelection<
                            ReturnType<typeof make${selectionFunctionName}Input>,
                            ${this.typeName}SelectionFields
                        >,
                } as const;
            };
            export function ${selectionFunctionName} <
                T extends object,
                F extends ${this.typeName}SelectionFields & SelectionHelpers<ReturnType<typeof make${selectionFunctionName}Input>, ${this.typeName}SelectionFields> >(
                this: any, 
                s: (selection: F) => T
            ) {
                let parent: SelectionFnParent = this ?? { collector: new OperationSelectionCollector() };
                function innerFn(this: any){
                    const selection: F = make${selectionFunctionName}Input.bind(this)() as any;
                    const r = s(selection);
                    const _result = new SelectionWrapper(parent?.fieldName, "${
                        this.originalFullTypeName
                    }", r, this, parent?.collector, parent?.args, parent?.argsMeta);
                    _result[SLW_IS_ROOT_TYPE] = parent?.isRootType;
                    
                    Object.keys(r).forEach((key) => (_result as T)[key as keyof T]);
                    const result = _result as unknown as T${this.typeMeta.isList ? "[]" : ""};
                    return result;
                }
                return innerFn.bind(new OperationSelectionCollector("${selectionFunctionName}", parent?.collector))();
            };
        `;
        this.collector.addSelectionFunction(this.typeMeta, selectionFunction);

        return selectionFunctionName;
    }

    public static makeRootOperationFunction(
        schema: GraphQLSchema,
        collector: Collector,
        authConfig?: {
            headerName: string;
        },
    ): string {
        // get the root operation types
        const QueryTypeName = schema.getQueryType()?.name;
        const MutationTypeName = schema.getMutationType()?.name;
        const SubscriptionTypeName = schema.getSubscriptionType()?.name;

        const rootOperationFunction = `
            export type _RootOperationSelectionFields = {
                ${
                    QueryTypeName && collector.types.has(QueryTypeName)
                        ? `query: typeof ${QueryTypeName}Selection;`
                        : ""
                }
                ${
                    MutationTypeName && collector.types.has(MutationTypeName)
                        ? `mutation: typeof ${MutationTypeName}Selection;`
                        : ""
                }
                ${
                    SubscriptionTypeName &&
                    collector.types.has(SubscriptionTypeName)
                        ? `subscription: typeof ${SubscriptionTypeName}Selection;`
                        : ""
                }
            };
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
                F extends _RootOperationSelectionFields>(
                this: any, 
                s: (selection: F) => T
            ) {
                const root = new OperationSelectionCollector(undefined, undefined, new RootOperation());
                const selection: F = _makeRootOperationInput.bind(root)() as any;
                const r = s(selection);
                const result = new SelectionWrapper(undefined, undefined, r, root, undefined) as unknown as T;
                Object.keys(r).forEach((key) => (result as T)[key as keyof T]);
                
                let headers: Record<string, string> | undefined = undefined;
                const finalPromise = {
                    then: (resolve: (value: T) => void, reject: (reason: any) => void) => {
                        root.execute(headers)
                            .then(() => {
                                resolve(result);
                            })
                            .catch(reject);
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

                                        return finalPromise as Promise<T>;
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

                            return finalPromise as Promise<T>;
                        };
                    },
                });

                return finalPromise as Promise<T> & {
                    auth: (
                        auth: __AuthenticationArg__,
                    ) => Promise<T>;
                };
                `
                        : `
                return finalPromise as Promise<T>;
                `
                }
            };

            const __init__ = (options: {
                ${authConfig ? `auth?: string | { [key: string]: string };` : ""}
                headers?: { [key: string]: string };
                scalars?: { 
                    DateTime?: (value: string) => Date,
                    Date?: (value: string) => Date,
                    Time?: (value: string) => Date,
                    JSON?: (v: string) => any 
                };
            }) => {
                ${
                    authConfig
                        ? `
                if (typeof options.auth === "string") {
                    OperationSelectionCollector[OPTIONS].headers = {
                        "${authConfig.headerName}": options.auth,
                    };
                } else if (options.auth) {
                    OperationSelectionCollector[OPTIONS].headers = options.auth;
                }
                `
                        : ""
                }

                if (options.headers) {
                    OperationSelectionCollector[OPTIONS].headers = {
                        ...OperationSelectionCollector[OPTIONS].headers,
                        ...options.headers,
                    };
                }
                if (options.scalars) {
                    OperationSelectionCollector[OPTIONS].scalars = {
                        ...OperationSelectionCollector[OPTIONS].scalars,
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
