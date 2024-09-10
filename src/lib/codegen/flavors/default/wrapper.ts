const Proxy = global.Proxy;
Proxy.prototype = {};

const OPTIONS = Symbol("OPTIONS");
export class RootOperation {
    public static [OPTIONS] = {
        headers: {},
        scalars: {
            DateTime: (value: string) => new Date(value),
            Date: (value: string) => new Date(value),
            Time: (value: string) => new Date(value),
            JSON: (value: string) => JSON.parse(value),
        },
    };

    private utilSet = (obj: Record<string, any>, path: string[], value: any) =>
        path.reduce(
            (o, p, i, a) => (o[p] = a.length - 1 === i ? value : o[p] || {}),
            obj,
        );

    private rootCollector: OperationSelectionCollector | undefined = undefined;
    public registerRootCollector(collector: OperationSelectionCollector) {
        this.rootCollector = collector;
    }
    public async execute(headers: Record<string, string> = {}) {
        if (!this.rootCollector) {
            throw new Error("RootOperation has no registered collector");
        }

        type selection = ReturnType<
            typeof OperationSelectionCollector.prototype.renderSelections
        >;
        const operations: {
            [key: string]: {
                selection: selection;
                rootSlw: SelectionWrapperImpl<
                    string,
                    string,
                    string,
                    number,
                    any
                >;
            };
        } = {};
        for (const [
            opName,
            opSelection,
        ] of this.rootCollector?.selections.entries()) {
            if (opSelection[SLW_LAZY_FLAG]) continue;

            let rootSlw = opSelection;
            while (!rootSlw[SLW_IS_ROOT_TYPE]) {
                if (!rootSlw[SLW_PARENT_SLW]) break;
                rootSlw = rootSlw[SLW_PARENT_SLW]!;
            }

            const selection = rootSlw[SLW_COLLECTOR]!.renderSelections(
                [opName],
                {},
                new Map(),
                opSelection === rootSlw ? [] : [opSelection],
            );

            operations[opName] = {
                selection,
                rootSlw,
            };
        }

        const ops = Object.entries(operations).reduce(
            (acc, [opName, { selection, rootSlw }]) => ({
                ...acc,
                [opName]: {
                    query: `${rootSlw[SLW_IS_ROOT_TYPE]?.toLowerCase()} ${opName} ${
                        selection.variableDefinitions.length
                            ? `(${selection.variableDefinitions.join(", ")})`
                            : ""
                    } ${selection.selection}
                    `,
                    variables: selection.variables,
                    fragments: selection.usedFragments,
                },
            }),
            {} as Record<
                string,
                {
                    query: string;
                    variables: any;
                    fragments: Map<string, string>;
                }
            >,
        );
        // const subscription = `{${subscriptions.join("")}}`;

        const results = Object.fromEntries(
            await Promise.all([
                ...Object.entries(ops).map(
                    async ([opName, op]) =>
                        [
                            opName,
                            await this.executeOperation(op, headers),
                        ] as const,
                ),
            ]),
        );

        return results;
    }

    private async executeOperation(
        query: {
            query: string;
            variables: any;
            fragments: Map<string, string>;
        },
        headers: Record<string, string> = {},
    ) {
        const res = await fetch("[ENDPOINT]", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
            body: JSON.stringify({
                query: `
                ${[...query.fragments.values()].join("\n")}
                ${query.query}
                `,
                variables: query.variables,
            }),
        });
        const result = (await res.json()) as { data: any; errors: any[] };

        const { data, errors } = result ?? {};
        if (errors?.length > 0) {
            for (const error of errors) {
                if (error.path) {
                    this.utilSet(data, error.path, error);
                }
            }
            if (!data) {
                const err = new Error(JSON.stringify(errors), {
                    cause: "Only errors were returned from the server.",
                });
                throw err;
            }
        }
        return data;
    }
}

export class OperationSelectionCollector {
    constructor(
        public readonly name?: string,
        public readonly parent?: OperationSelectionCollector,
        public readonly op?: RootOperation,
    ) {
        if (op) op.registerRootCollector(this);
    }

    private executed = false;
    private operationResult: any | undefined = undefined;
    public async execute(
        headers: Record<string, string> = RootOperation[OPTIONS].headers,
    ) {
        if (!this.op) {
            throw new Error(
                "OperationSelectionCollector is not registered to a root operation",
            );
        }
        this.operationResult = await this.op.execute(headers);
        this.executed = true;
    }
    public get isExecuted() {
        return this.executed;
    }

    public readonly selections = new Map<
        string,
        SelectionWrapperImpl<string, string, string, number, any>
    >();
    public registerSelection(
        id: string,
        selection: SelectionWrapperImpl<
            string,
            string,
            string,
            number,
            any,
            any
        >,
    ) {
        this.selections.set(id, selection);
    }

    public renderSelections(
        path: string[] = [],
        opVars: Record<string, any> = {},
        usedFragments: Map<string, string> = new Map(),
        renderOnlyTheseSelections: SelectionWrapperImpl<
            string,
            string,
            string,
            number,
            any
        >[] = [],
    ) {
        const result: Record<string, string | undefined> = {};
        const varDefs: string[] = [];
        const variables: Record<string, any> = {};

        for (const [key, value] of [...this.selections.entries()].filter(
            ([k, v]) =>
                renderOnlyTheseSelections.length === 0 ||
                renderOnlyTheseSelections.find(
                    (r) => r[SLW_UID] === v[SLW_UID],
                ),
        )) {
            const subPath = [...path, key];
            const {
                selection: fieldSelection,
                variableDefinitions: fieldVarDefs,
                variables: fieldVars,

                directive: directiveRendered,
            } = value[SLW_RENDER_WITH_ARGS](opVars);

            Object.assign(variables, fieldVars);
            Object.assign(opVars, fieldVars);
            varDefs.push(...fieldVarDefs);

            if (directiveRendered) {
                const {
                    variableDefinitions: directiveVarDefs,
                    variables: directiveVars,
                } = directiveRendered;

                varDefs.push(...directiveVarDefs);
                Object.assign(variables, directiveVars);
                Object.assign(opVars, directiveVars);
            }

            value[SLW_REGISTER_PATH](subPath);

            if (value[SLW_PARENT_COLLECTOR] === undefined) {
                if (directiveRendered) {
                    result[key] =
                        `${fieldSelection} ${directiveRendered.rendered}`;
                } else {
                    result[key] = fieldSelection;
                }
            } else if (
                value[SLW_COLLECTOR] instanceof OperationSelectionCollector
            ) {
                const {
                    selection: subSelection,
                    variableDefinitions: subVarDefs,
                    variables: subVars,
                } = value[SLW_COLLECTOR].renderSelections(
                    subPath,
                    opVars,
                    usedFragments,
                );

                if (value[SLW_IS_ON_TYPE_FRAGMENT]) {
                    if (directiveRendered) {
                        result[key] =
                            `... on ${value[SLW_IS_ON_TYPE_FRAGMENT]} ${directiveRendered.rendered} ${subSelection}`;
                    } else {
                        result[key] =
                            `... on ${value[SLW_IS_ON_TYPE_FRAGMENT]} ${subSelection}`;
                    }
                } else if (value[SLW_IS_FRAGMENT]) {
                    const fragmentName = `${key}_${subVarDefs.map((v) => v.split(":")[0].slice(1)).join("_")}`;

                    if (directiveRendered) {
                        result[key] =
                            `...${fragmentName} ${directiveRendered.rendered}`;
                    } else {
                        result[key] = `...${fragmentName}`;
                    }

                    const fragment = `fragment ${fragmentName} on ${value[SLW_FIELD_TYPE]} ${subSelection}`;
                    if (!usedFragments.has(fragmentName)) {
                        usedFragments.set(fragmentName, fragment);
                    } else if (usedFragments.get(fragmentName) !== fragment) {
                        console.warn(
                            `Fragment ${fragmentName} is already defined with a different selection`,
                        );
                    }
                } else {
                    if (directiveRendered) {
                        result[key] =
                            `${fieldSelection} ${directiveRendered.rendered} ${subSelection}`;
                    } else {
                        result[key] = `${fieldSelection} ${subSelection}`;
                    }
                }

                Object.assign(variables, subVars);
                Object.assign(opVars, subVars);
                varDefs.push(...subVarDefs);
            }
        }
        let rendered = "{ ";
        for (const [key, value] of Object.entries(result).filter(
            ([k, v]) => v !== undefined,
        ) as [string, string][]) {
            const keyIsFieldName =
                value.startsWith(`${key} {`) || value.startsWith(`${key} (`);
            const isSubSelection = value.startsWith("{");
            const isOnType = value.startsWith("... on");
            const isFragment = value.startsWith("...");
            if (key === value) {
                rendered += `${key} `;
            } else if (isOnType || isFragment || keyIsFieldName) {
                rendered += `${value} `;
            } else {
                rendered += `${key}${!isSubSelection ? ":" : ""} ${value} `;
            }
        }
        rendered += " }";
        return {
            selection: rendered,
            variableDefinitions: varDefs,
            variables,
            usedFragments,
        };
    }

    private utilGet = (obj: Record<string, any>, path: string[]) =>
        path.reduce((o, p) => o?.[p], obj);
    public getOperationResultPath<T>(path: string[] = [], type?: string): T {
        if (!this.op) {
            throw new Error(
                "OperationSelectionCollector is not registered to a root operation",
            );
        }

        let result = this.operationResult;

        if (path.length === 0) return result as T;

        result = this.utilGet(result, path) as T;

        if (type && result && type in RootOperation[OPTIONS].scalars) {
            let depth = 0;
            let finalResult = result instanceof Array ? [...result] : result;

            while (result instanceof Array) {
                result = result[0];
                depth++;
            }

            const deepParse = (
                res: any | any[],
                depth: number,
                parse: (v: string) => any,
            ) => {
                if (depth === 0) {
                    return parse(res);
                }
                return res.map((rarr: any) =>
                    deepParse(rarr, depth - 1, parse),
                );
            };

            return deepParse(
                finalResult,
                depth,
                RootOperation[OPTIONS].scalars[
                    type as keyof (typeof RootOperation)[typeof OPTIONS]["scalars"]
                ],
            ) as T;
        }

        return result as T;
    }
}

export const SLW_UID = Symbol("SLW_UID");
export const SLW_FIELD_NAME = Symbol("SLW_FIELD_NAME");
export const SLW_FIELD_TYPE = Symbol("SLW_FIELD_TYPE");
export const SLW_FIELD_TYPENAME = Symbol("SLW_FIELD_TYPENAME");
export const SLW_FIELD_ARR_DEPTH = Symbol("SLW_FIELD_ARR_DEPTH");
export const SLW_IS_ROOT_TYPE = Symbol("SLW_IS_ROOT_TYPE");
export const SLW_IS_ON_TYPE_FRAGMENT = Symbol("SLW_IS_ON_TYPE_FRAGMENT");
export const SLW_IS_FRAGMENT = Symbol("SLW_IS_FRAGMENT");
export const SLW_VALUE = Symbol("SLW_VALUE");
export const SLW_ARGS = Symbol("SLW_ARGS");
export const SLW_ARGS_META = Symbol("SLW_ARGS_META");
export const SLW_DIRECTIVE = Symbol("SLW_DIRECTIVE");
export const SLW_DIRECTIVE_ARGS = Symbol("SLW_DIRECTIVE_ARGS");
export const SLW_DIRECTIVE_ARGS_META = Symbol("SLW_DIRECTIVE_ARGS_META");
export const SLW_PARENT_SLW = Symbol("SLW_PARENT_SLW");
export const SLW_LAZY_FLAG = Symbol("SLW_LAZY_FLAG");

export const OP = Symbol("OP");
export const ROOT_OP_COLLECTOR = Symbol("ROOT_OP_COLLECTOR");
export const SLW_PARENT_COLLECTOR = Symbol("SLW_PARENT_COLLECTOR");
export const SLW_COLLECTOR = Symbol("SLW_COLLECTOR");
export const SLW_OP_PATH = Symbol("SLW_OP_PATH");
export const SLW_REGISTER_PATH = Symbol("SLW_REGISTER_PATH");
export const SLW_RENDER_WITH_ARGS = Symbol("SLW_RENDER_WITH_ARGS");

export class SelectionWrapperImpl<
    fieldName extends string,
    typeName extends string,
    typeNamePure extends string,
    typeArrDepth extends number,
    valueT extends any = any,
    argsT extends Record<string, any> | undefined = undefined,
> {
    private generateUniqueId(): string {
        return (
            performance.now().toString(36) +
            Math.random().toString(36).substring(2)
        );
    }

    readonly [SLW_UID] = this.generateUniqueId();
    readonly [ROOT_OP_COLLECTOR]?: OperationSelectionCollector;
    readonly [SLW_PARENT_COLLECTOR]?: OperationSelectionCollector;
    readonly [SLW_COLLECTOR]?: OperationSelectionCollector;

    [SLW_FIELD_NAME]?: fieldName;
    [SLW_FIELD_TYPE]?: typeName;
    [SLW_FIELD_TYPENAME]?: typeNamePure;
    [SLW_FIELD_ARR_DEPTH]?: typeArrDepth;
    [SLW_VALUE]?: valueT;

    [SLW_IS_ROOT_TYPE]?: "Query" | "Mutation" | "Subscription";
    [SLW_IS_ON_TYPE_FRAGMENT]?: string;
    [SLW_IS_FRAGMENT]?: string;

    [SLW_ARGS]?: argsT;
    [SLW_ARGS_META]?: Record<string, string>;
    [SLW_DIRECTIVE]?: string;
    [SLW_DIRECTIVE_ARGS]?: Record<string, any>;
    [SLW_DIRECTIVE_ARGS_META]?: Record<string, string>;

    [SLW_PARENT_SLW]?: SelectionWrapperImpl<
        string,
        string,
        string,
        number,
        any,
        any
    >;
    [SLW_LAZY_FLAG]?: boolean;

    constructor(
        fieldName?: fieldName,
        typeName?: typeName,
        typeNamePure?: typeNamePure,
        typeArrDepth?: typeArrDepth,
        value?: valueT,
        collector?: OperationSelectionCollector,
        parent?: OperationSelectionCollector,
        args?: argsT,
        argsMeta?: Record<string, string>,
    ) {
        this[SLW_FIELD_NAME] = fieldName;
        this[SLW_FIELD_TYPE] = typeName;
        this[SLW_FIELD_TYPENAME] = typeNamePure;
        this[SLW_FIELD_ARR_DEPTH] = typeArrDepth;
        this[SLW_VALUE] = value;

        this[SLW_ARGS] = args;
        this[SLW_ARGS_META] = argsMeta;

        if (parent instanceof OperationSelectionCollector) {
            this[SLW_PARENT_COLLECTOR] = parent;
        }
        if (collector instanceof OperationSelectionCollector) {
            this[SLW_COLLECTOR] = collector;

            let rootCollector = collector;
            while (rootCollector?.parent) {
                rootCollector = rootCollector.parent;
            }
            this[ROOT_OP_COLLECTOR] = rootCollector;
        }
    }

    [SLW_OP_PATH]?: string;
    [SLW_REGISTER_PATH](path: string[]) {
        if (!this[SLW_OP_PATH]) this[SLW_OP_PATH] = path.join(".");
    }
    [SLW_RENDER_WITH_ARGS](opVars: Record<string, any> = {}) {
        const renderArgsString = (
            args: Record<string, any>,
            argsMeta: Record<string, string>,
        ) => {
            const argToVarMap: Record<string, string> = {};
            let argsString = "(";
            for (const key of Object.keys(args)) {
                let varName = key;
                if (opVars[key] !== undefined) {
                    varName = `${key}_${
                        Object.keys(opVars).filter((k) => k.startsWith(key))
                            .length
                    }`;
                    argToVarMap[varName] = varName;
                    args[varName] = args[key];
                    argsMeta[varName] = argsMeta[key];
                    delete args[key];
                    delete argsMeta[key];
                }
                argsString += `${key}: $${varName} `;
            }
            argsString += ")";
            return { argsString, argToVarMap };
        };

        const directiveRender = {
            rendered: undefined as string | undefined,
            variables: {} as Record<string, any>,
            variableDefinitions: [] as string[],
        };
        if (this[SLW_DIRECTIVE]) {
            const directive = this[SLW_DIRECTIVE];

            if (this[SLW_DIRECTIVE_ARGS]) {
                const args = this[SLW_DIRECTIVE_ARGS];
                const argsMeta = this[SLW_DIRECTIVE_ARGS_META]!;

                const { argsString, argToVarMap } = renderArgsString(
                    args,
                    argsMeta,
                );

                directiveRender.rendered = `@${directive}${Object.keys(args).length ? argsString : ""}`;
                directiveRender.variables = args;
                directiveRender.variableDefinitions = Object.keys(args).map(
                    (key) => {
                        const varName = argToVarMap[key] ?? key;
                        return `$${varName}: ${argsMeta[key]}`;
                    },
                );
            } else {
                directiveRender.rendered = `@${directive}`;
            }
        }

        if (this[SLW_ARGS]) {
            const args = this[SLW_ARGS];
            const argsMeta = this[SLW_ARGS_META]!;

            const { argsString, argToVarMap } = renderArgsString(
                args,
                argsMeta,
            );
            return {
                selection: `${this[SLW_FIELD_NAME]}${Object.keys(args).length ? argsString : ""}`,
                variables: args,
                variableDefinitions: Object.keys(args).map((key) => {
                    const varName = argToVarMap[key] ?? key;
                    return `$${varName}: ${argsMeta[key]}`;
                }),

                directive: directiveRender.rendered
                    ? directiveRender
                    : undefined,
            };
        }
        return {
            selection: this[SLW_FIELD_NAME],
            variables: {},
            variableDefinitions: [] as string[],

            directive: directiveRender.rendered ? directiveRender : undefined,
        };
    }
}
export class SelectionWrapper<
    fieldName extends string,
    typeName extends string,
    typeNamePure extends string,
    typeArrDepth extends number,
    valueT extends any = any,
    argsT extends Record<string, any> | undefined = undefined,
> extends Proxy<
    SelectionWrapperImpl<
        fieldName,
        typeName,
        typeNamePure,
        typeArrDepth,
        valueT,
        argsT
    >
> {
    constructor(
        fieldName?: fieldName,
        typeName?: typeName,
        typeNamePure?: typeNamePure,
        typeArrDepth?: typeArrDepth,
        value?: valueT,
        collector?: OperationSelectionCollector,
        parent?: OperationSelectionCollector,
        args?: argsT,
        argsMeta?: Record<string, string>,
    ) {
        super(
            new SelectionWrapperImpl<
                fieldName,
                typeName,
                typeNamePure,
                typeArrDepth,
                valueT,
                argsT
            >(
                fieldName,
                typeName,
                typeNamePure,
                typeArrDepth,
                value,
                collector,
                parent,
                args,
                argsMeta,
            ),
            {
                // implement ProxyHandler methods
                ownKeys() {
                    return Reflect.ownKeys(value ?? {});
                },
                getOwnPropertyDescriptor(target, prop) {
                    return Reflect.getOwnPropertyDescriptor(value ?? {}, prop);
                },
                has(target, prop) {
                    if (prop === Symbol.for("nodejs.util.inspect.custom"))
                        return true;
                    return Reflect.has(value ?? {}, prop);
                },
                get: (target, prop) => {
                    if (prop === "$lazy") {
                        const that = this;
                        function lazy(
                            this: {
                                parentSlw: SelectionWrapperImpl<
                                    fieldName,
                                    typeName,
                                    typeNamePure,
                                    typeArrDepth,
                                    valueT,
                                    argsT
                                >;
                                key: string;
                            },
                            args?: argsT,
                        ) {
                            const { parentSlw, key } = this;
                            that[SLW_PARENT_SLW] = parentSlw;
                            parentSlw[SLW_COLLECTOR]?.registerSelection(
                                key,
                                that,
                            );

                            that[SLW_ARGS] = {
                                ...(that[SLW_ARGS] ?? {}),
                                ...args,
                            } as argsT;
                            return that;
                        }
                        target[SLW_LAZY_FLAG] = true;
                        lazy[SLW_LAZY_FLAG] = true;
                        return lazy;
                    }
                    if (
                        prop === SLW_UID ||
                        prop === SLW_FIELD_NAME ||
                        prop === SLW_FIELD_TYPE ||
                        prop === SLW_FIELD_TYPENAME ||
                        prop === SLW_FIELD_ARR_DEPTH ||
                        prop === SLW_IS_ROOT_TYPE ||
                        prop === SLW_IS_ON_TYPE_FRAGMENT ||
                        prop === SLW_IS_FRAGMENT ||
                        prop === SLW_VALUE ||
                        prop === SLW_ARGS ||
                        prop === SLW_ARGS_META ||
                        prop === SLW_DIRECTIVE ||
                        prop === SLW_DIRECTIVE_ARGS ||
                        prop === SLW_DIRECTIVE_ARGS_META ||
                        prop === SLW_PARENT_SLW ||
                        prop === SLW_LAZY_FLAG ||
                        prop === ROOT_OP_COLLECTOR ||
                        prop === SLW_PARENT_COLLECTOR ||
                        prop === SLW_COLLECTOR ||
                        prop === SLW_OP_PATH ||
                        prop === SLW_REGISTER_PATH ||
                        prop === SLW_RENDER_WITH_ARGS
                    ) {
                        return target[
                            prop as keyof SelectionWrapperImpl<
                                fieldName,
                                typeName,
                                typeNamePure,
                                typeArrDepth,
                                valueT
                            >
                        ];
                    }
                    if (prop === SLW_VALUE) {
                        return value;
                    }
                    if (prop === "then") {
                        if (target[SLW_LAZY_FLAG]) {
                            target[SLW_LAZY_FLAG] = false;
                            target[ROOT_OP_COLLECTOR]!.registerSelection(
                                target[SLW_FIELD_NAME]!,
                                target,
                            );
                            return (resolve: (v: any) => any, reject: any) =>
                                target[ROOT_OP_COLLECTOR]!.execute()
                                    .catch(reject)
                                    .then(() => {
                                        resolve(
                                            new Promise(() => {
                                                resolve(this);
                                            }),
                                        );
                                        target[SLW_LAZY_FLAG] = true;
                                    });
                        }
                        return this;
                    }

                    let slw_value = target[SLW_VALUE] as
                        | Record<string, any>
                        | undefined;

                    if (target[ROOT_OP_COLLECTOR]?.isExecuted) {
                        const getResultDataForTarget = (
                            t: SelectionWrapperImpl<
                                fieldName,
                                typeName,
                                typeNamePure,
                                typeArrDepth,
                                valueT,
                                argsT
                            >,
                        ): valueT | undefined => {
                            const data = t[
                                ROOT_OP_COLLECTOR
                            ]!.getOperationResultPath<valueT>(
                                t[SLW_OP_PATH]?.split(".") ?? [],
                                t[SLW_FIELD_TYPENAME],
                            );
                            return data;
                        };

                        if (!Object.hasOwn(slw_value ?? {}, String(prop))) {
                            const data = getResultDataForTarget(target);
                            if (data === undefined) return undefined;
                            const proto = Object.getPrototypeOf(data);
                            if (Object.hasOwn(proto, prop)) {
                                const v = (data as any)[prop];
                                if (typeof v === "function")
                                    return v.bind(data);
                                return v;
                            }
                            return () => data;
                        }

                        const slw = slw_value?.[String(prop)];

                        if (
                            slw instanceof SelectionWrapperImpl &&
                            slw[SLW_PARENT_COLLECTOR]
                        ) {
                            return slw;
                        } else if (slw instanceof SelectionWrapperImpl) {
                            return getResultDataForTarget(slw);
                        } else if (slw[SLW_LAZY_FLAG]) {
                            return slw;
                        }

                        return getResultDataForTarget(target);
                    }

                    if (
                        Object.hasOwn(slw_value ?? {}, String(prop)) &&
                        slw_value?.[String(prop)] instanceof
                            SelectionWrapperImpl
                    ) {
                        if (target[SLW_COLLECTOR]) {
                            target[SLW_COLLECTOR].registerSelection(
                                String(prop),
                                slw_value[String(prop)],
                            );
                        }
                        if (!slw_value[String(prop)][SLW_PARENT_SLW]) {
                            slw_value[String(prop)][SLW_PARENT_SLW] = target;
                        }
                    }
                    if (slw_value?.[String(prop)]?.[SLW_LAZY_FLAG]) {
                        if (!slw_value[String(prop)][SLW_PARENT_SLW]) {
                            const lazyFn = slw_value[String(prop)];
                            slw_value[String(prop)] = lazyFn.bind({
                                parentSlw: target,
                                key: String(prop),
                            });
                            slw_value[String(prop)][SLW_PARENT_SLW] = target;
                            slw_value[String(prop)][SLW_LAZY_FLAG] = true;
                        }
                    }

                    return slw_value?.[String(prop)] ?? undefined;
                },
            },
        );
    }
}
