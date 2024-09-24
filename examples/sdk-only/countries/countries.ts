const Proxy = global.Proxy;
Proxy.prototype = {};

export const OPTIONS = Symbol("OPTIONS");
export class RootOperation {
    public static [OPTIONS] = {
        headers: {},
        _auth_fn: undefined as
            | (() => string | { [key: string]: string })
            | (() => Promise<string | { [key: string]: string }>)
            | undefined,
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
                rootSlw: SelectionWrapperImpl<string, string, number, any>;
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
                            ? `(${selection.variableDefinitions.join(", ")}) `
                            : ""
                    }${selection.selection}`,
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
        const res = await fetch("https://countries.trevorblades.com/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
            body: JSON.stringify({
                query: `${[...query.fragments.values()].join("\n")}\n ${query.query}`.trim(),
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

export type OperationSelectionCollectorRef = {
    ref: OperationSelectionCollector;
};
export class OperationSelectionCollector {
    constructor(
        public readonly name?: string,
        public readonly parent?:
            | OperationSelectionCollector
            | OperationSelectionCollectorRef,
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
        SelectionWrapperImpl<string, string, number, any>
    >();
    public registerSelection(
        id: string,
        selection: SelectionWrapperImpl<string, string, number, any, any>,
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

                    const fragment = `fragment ${fragmentName} on ${value[SLW_FIELD_TYPENAME]} ${subSelection}`;
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
        rendered += "}";
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

export const SLW_RECREATE_VALUE_CALLBACK = Symbol(
    "SLW_RECREATE_VALUE_CALLBACK",
);

export class SelectionWrapperImpl<
    fieldName extends string,
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
    [ROOT_OP_COLLECTOR]?: OperationSelectionCollectorRef;
    readonly [SLW_PARENT_COLLECTOR]?: OperationSelectionCollector;
    readonly [SLW_COLLECTOR]?: OperationSelectionCollector;

    [SLW_FIELD_NAME]?: fieldName;
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

    [SLW_PARENT_SLW]?: SelectionWrapperImpl<string, string, number, any, any>;
    [SLW_LAZY_FLAG]?: boolean;

    [SLW_RECREATE_VALUE_CALLBACK]?: () => valueT;
    constructor(
        fieldName?: fieldName,
        typeNamePure?: typeNamePure,
        typeArrDepth?: typeArrDepth,
        value?: valueT,
        collector?: OperationSelectionCollector,
        parent?: OperationSelectionCollector | OperationSelectionCollectorRef,
        args?: argsT,
        argsMeta?: Record<string, string>,
        reCreateValueCallback?: () => valueT,
    ) {
        this[SLW_FIELD_NAME] = fieldName;
        this[SLW_FIELD_TYPENAME] = typeNamePure;
        this[SLW_FIELD_ARR_DEPTH] = typeArrDepth;
        this[SLW_VALUE] = value;

        this[SLW_ARGS] = args;
        this[SLW_ARGS_META] = argsMeta;

        if (parent instanceof OperationSelectionCollector) {
            this[SLW_PARENT_COLLECTOR] = parent;
        } else if (parent && "ref" in parent) {
            this[SLW_PARENT_COLLECTOR] = parent.ref;
        }

        if (collector instanceof OperationSelectionCollector) {
            this[SLW_COLLECTOR] = collector;

            let rootCollector = collector;
            while (
                rootCollector?.parent instanceof OperationSelectionCollector
            ) {
                rootCollector = rootCollector.parent;
            }
            if (rootCollector.parent && "ref" in rootCollector.parent) {
                this[ROOT_OP_COLLECTOR] = rootCollector.parent;
            }
        }

        if (reCreateValueCallback) {
            this[SLW_RECREATE_VALUE_CALLBACK] = reCreateValueCallback;
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
            const argsStringParts = [];
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
                }
                argsStringParts.push(`${key}: $${varName}`);
            }
            argsString += argsStringParts.join(", ").trim() + ")";
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
    typeNamePure extends string,
    typeArrDepth extends number,
    valueT extends any = any,
    argsT extends Record<string, any> | undefined = undefined,
> extends Proxy<
    SelectionWrapperImpl<fieldName, typeNamePure, typeArrDepth, valueT, argsT>
> {
    constructor(
        fieldName?: fieldName,
        typeNamePure?: typeNamePure,
        typeArrDepth?: typeArrDepth,
        value?: valueT,
        collector?: OperationSelectionCollector,
        parent?: OperationSelectionCollector | OperationSelectionCollectorRef,
        args?: argsT,
        argsMeta?: Record<string, string>,
        reCreateValueCallback?: () => valueT,
    ) {
        super(
            new SelectionWrapperImpl<
                fieldName,
                typeNamePure,
                typeArrDepth,
                valueT,
                argsT
            >(
                fieldName,
                typeNamePure,
                typeArrDepth,
                value,
                collector,
                parent,
                args,
                argsMeta,
                reCreateValueCallback,
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
                            const newRootOpCollectorRef = {
                                ref: new OperationSelectionCollector(
                                    undefined,
                                    undefined,
                                    new RootOperation(),
                                ),
                            };

                            const newThisCollector =
                                new OperationSelectionCollector(
                                    undefined,
                                    newRootOpCollectorRef,
                                );
                            const r =
                                that[SLW_RECREATE_VALUE_CALLBACK]?.bind(
                                    newThisCollector,
                                )();

                            const newThat = new SelectionWrapper(
                                that[SLW_FIELD_NAME],
                                that[SLW_FIELD_TYPENAME],
                                that[SLW_FIELD_ARR_DEPTH],
                                r,
                                newThisCollector,
                                newRootOpCollectorRef,
                                that[SLW_ARGS],
                                that[SLW_ARGS_META],
                            );
                            Object.keys(r!).forEach(
                                (key) =>
                                    (newThat as valueT)[key as keyof valueT],
                            );

                            newThat[SLW_IS_ROOT_TYPE] = that[SLW_IS_ROOT_TYPE];
                            newThat[SLW_IS_ON_TYPE_FRAGMENT] =
                                that[SLW_IS_ON_TYPE_FRAGMENT];
                            newThat[SLW_IS_FRAGMENT] = that[SLW_IS_FRAGMENT];

                            newThat[SLW_PARENT_SLW] = parentSlw;
                            parentSlw[SLW_COLLECTOR]?.registerSelection(
                                key,
                                newThat,
                            );
                            newThat[SLW_ARGS] = {
                                ...(that[SLW_ARGS] ?? {}),
                                ...args,
                            } as argsT;

                            newThat[SLW_LAZY_FLAG] = true;
                            newThat[SLW_OP_PATH] = that[SLW_OP_PATH];

                            newRootOpCollectorRef.ref.registerSelection(
                                newThat[SLW_FIELD_NAME]!,
                                newThat,
                            );

                            return newThat;
                        }
                        target[SLW_LAZY_FLAG] = true;
                        lazy[SLW_LAZY_FLAG] = true;
                        return lazy;
                    }
                    if (
                        prop === SLW_UID ||
                        prop === SLW_FIELD_NAME ||
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
                        prop === SLW_RENDER_WITH_ARGS ||
                        prop === SLW_RECREATE_VALUE_CALLBACK
                    ) {
                        return target[
                            prop as keyof SelectionWrapperImpl<
                                fieldName,
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
                            target[ROOT_OP_COLLECTOR]!.ref.registerSelection(
                                target[SLW_FIELD_NAME]!,
                                target,
                            );
                            return (resolve: (v: any) => any, reject: any) =>
                                target[ROOT_OP_COLLECTOR]!.ref.execute()
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

                    if (target[ROOT_OP_COLLECTOR]?.ref.isExecuted) {
                        const getResultDataForTarget = (
                            t: SelectionWrapperImpl<
                                fieldName,
                                typeNamePure,
                                typeArrDepth,
                                valueT,
                                argsT
                            >,
                        ): valueT | undefined => {
                            const data = t[
                                ROOT_OP_COLLECTOR
                            ]!.ref.getOperationResultPath<valueT>(
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

export interface ScalarTypeMapWithCustom {}
export interface ScalarTypeMapDefault {
    String: string;
    Int: number;
    Float: number;
    Boolean: boolean;
    ID: string;
    Date: Date;
    DateTime: Date;
    Time: Date;
    JSON: Record<string, any>;
}

type SelectionFnParent =
    | {
          collector:
              | OperationSelectionCollector
              | OperationSelectionCollectorRef;
          fieldName?: string;
          args?: Record<string, any>;
          argsMeta?: Record<string, string>;

          isRootType?: "Query" | "Mutation" | "Subscription";
          onTypeFragment?: string;
          isFragment?: string;
      }
    | undefined;

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

export type Directive_includeArgs = {
    /** Included when true. */
    if: boolean;
};
export type Directive_skipArgs = {
    /** Skipped when true. */
    if: boolean;
};
export type CountryNotNullArrayNotNullNameArgs = {
    lang?: string;
};
export type CountryNotNullNameArgs = {
    lang?: string;
};
export type CountryNameArgs = {
    lang?: string;
};
export type QueryContinentArgs = {
    code: string;
};
export type QueryContinentsArgs = {
    filter?: ContinentFilterInput;
};
export type QueryCountriesArgs = {
    filter?: CountryFilterInput;
};
export type QueryCountryArgs = {
    code: string;
};
export type QueryLanguageArgs = {
    code: string;
};
export type QueryLanguagesArgs = {
    filter?: LanguageFilterInput;
};
export const Directive_includeArgsMeta = { if: "Boolean!" } as const;
export const Directive_skipArgsMeta = { if: "Boolean!" } as const;
export const CountryNotNullArrayNotNullNameArgsMeta = {
    lang: "String",
} as const;
export const CountryNotNullNameArgsMeta = { lang: "String" } as const;
export const CountryNameArgsMeta = { lang: "String" } as const;
export const QueryContinentArgsMeta = { code: "ID!" } as const;
export const QueryContinentsArgsMeta = {
    filter: "ContinentFilterInput",
} as const;
export const QueryCountriesArgsMeta = { filter: "CountryFilterInput" } as const;
export const QueryCountryArgsMeta = { code: "ID!" } as const;
export const QueryLanguageArgsMeta = { code: "ID!" } as const;
export const QueryLanguagesArgsMeta = {
    filter: "LanguageFilterInput",
} as const;

export type ContinentFilterInput = {
    code?: StringQueryOperatorInput;
};

export type StringQueryOperatorInput = {
    eq?: string;
    in?: Array<string>;
    ne?: string;
    nin?: Array<string>;
    regex?: string;
};

export type CountryFilterInput = {
    code?: StringQueryOperatorInput;
    continent?: StringQueryOperatorInput;
    currency?: StringQueryOperatorInput;
    name?: StringQueryOperatorInput;
};

export type LanguageFilterInput = {
    code?: StringQueryOperatorInput;
};

type ReturnTypeFromCountryNotNullArrayNotNullSelection = {
    awsRegion: SelectionWrapper<"awsRegion", "String", 0, {}, undefined>;
    capital: SelectionWrapper<"capital", "String", 0, {}, undefined>;
    code: SelectionWrapper<"code", "ID", 0, {}, undefined>;
    continent: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContinentNotNullSelectionInput>,
            "ContinentNotNullSelection",
            "Continent",
            0
        >
    >;
    currencies: SelectionWrapper<"currencies", "String", 1, {}, undefined>;
    currency: SelectionWrapper<"currency", "String", 0, {}, undefined>;
    emoji: SelectionWrapper<"emoji", "String", 0, {}, undefined>;
    emojiU: SelectionWrapper<"emojiU", "String", 0, {}, undefined>;
    languages: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLanguageNotNullArrayNotNullSelectionInput>,
            "LanguageNotNullArrayNotNullSelection",
            "Language",
            1
        >
    >;
    name: (
        args: CountryNotNullArrayNotNullNameArgs,
    ) => SelectionWrapper<
        "name",
        "String",
        0,
        {},
        CountryNotNullArrayNotNullNameArgs
    >;
    native: SelectionWrapper<"native", "String", 0, {}, undefined>;
    phone: SelectionWrapper<"phone", "String", 0, {}, undefined>;
    phones: SelectionWrapper<"phones", "String", 1, {}, undefined>;
    states: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStateNotNullArrayNotNullSelectionInput>,
            "StateNotNullArrayNotNullSelection",
            "State",
            1
        >
    >;
    subdivisions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSubdivisionNotNullArrayNotNullSelectionInput>,
            "SubdivisionNotNullArrayNotNullSelection",
            "Subdivision",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCountryNotNullArrayNotNullSelectionInput>
    >;
};

export function makeCountryNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromCountryNotNullArrayNotNullSelection {
    return {
        awsRegion: new SelectionWrapper(
            "awsRegion",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        capital: new SelectionWrapper(
            "capital",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        code: new SelectionWrapper("code", "ID", 0, {}, this, undefined),
        continent: ContinentNotNullSelection.bind({
            collector: this,
            fieldName: "continent",
        }),
        currencies: new SelectionWrapper(
            "currencies",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        currency: new SelectionWrapper(
            "currency",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        emoji: new SelectionWrapper("emoji", "String", 0, {}, this, undefined),
        emojiU: new SelectionWrapper(
            "emojiU",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        languages: LanguageNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "languages",
        }),
        name: (args: CountryNotNullArrayNotNullNameArgs) =>
            new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                this,
                undefined,
                args,
                CountryNotNullArrayNotNullNameArgsMeta,
            ),
        native: new SelectionWrapper(
            "native",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        phone: new SelectionWrapper("phone", "String", 0, {}, this, undefined),
        phones: new SelectionWrapper(
            "phones",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        states: StateNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "states",
        }),
        subdivisions: SubdivisionNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "subdivisions",
        }),

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
                makeCountryNotNullArrayNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCountryNotNullArrayNotNullSelectionInput>
            >,
    } as const;
}
export const CountryNotNullArrayNotNullSelection = makeSLFN(
    makeCountryNotNullArrayNotNullSelectionInput,
    "CountryNotNullArrayNotNullSelection",
    "Country",
    1,
);

type ReturnTypeFromContinentNotNullSelection = {
    code: SelectionWrapper<"code", "ID", 0, {}, undefined>;
    countries: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountryNotNullArrayNotNullSelectionInput>,
            "CountryNotNullArrayNotNullSelection",
            "Country",
            1
        >
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeContinentNotNullSelectionInput>
    >;
};

export function makeContinentNotNullSelectionInput(
    this: any,
): ReturnTypeFromContinentNotNullSelection {
    return {
        code: new SelectionWrapper("code", "ID", 0, {}, this, undefined),
        countries: CountryNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "countries",
        }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

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
                makeContinentNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeContinentNotNullSelectionInput>
            >,
    } as const;
}
export const ContinentNotNullSelection = makeSLFN(
    makeContinentNotNullSelectionInput,
    "ContinentNotNullSelection",
    "Continent",
    0,
);

type ReturnTypeFromLanguageNotNullArrayNotNullSelection = {
    code: SelectionWrapper<"code", "ID", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    native: SelectionWrapper<"native", "String", 0, {}, undefined>;
    rtl: SelectionWrapper<"rtl", "Boolean", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLanguageNotNullArrayNotNullSelectionInput>
    >;
};

export function makeLanguageNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromLanguageNotNullArrayNotNullSelection {
    return {
        code: new SelectionWrapper("code", "ID", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        native: new SelectionWrapper(
            "native",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        rtl: new SelectionWrapper("rtl", "Boolean", 0, {}, this, undefined),

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
                makeLanguageNotNullArrayNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLanguageNotNullArrayNotNullSelectionInput>
            >,
    } as const;
}
export const LanguageNotNullArrayNotNullSelection = makeSLFN(
    makeLanguageNotNullArrayNotNullSelectionInput,
    "LanguageNotNullArrayNotNullSelection",
    "Language",
    1,
);

type ReturnTypeFromStateNotNullArrayNotNullSelection = {
    code: SelectionWrapper<"code", "String", 0, {}, undefined>;
    country: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountryNotNullSelectionInput>,
            "CountryNotNullSelection",
            "Country",
            0
        >
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStateNotNullArrayNotNullSelectionInput>
    >;
};

export function makeStateNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromStateNotNullArrayNotNullSelection {
    return {
        code: new SelectionWrapper("code", "String", 0, {}, this, undefined),
        country: CountryNotNullSelection.bind({
            collector: this,
            fieldName: "country",
        }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

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
                makeStateNotNullArrayNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeStateNotNullArrayNotNullSelectionInput>
            >,
    } as const;
}
export const StateNotNullArrayNotNullSelection = makeSLFN(
    makeStateNotNullArrayNotNullSelectionInput,
    "StateNotNullArrayNotNullSelection",
    "State",
    1,
);

type ReturnTypeFromCountryNotNullSelection = {
    awsRegion: SelectionWrapper<"awsRegion", "String", 0, {}, undefined>;
    capital: SelectionWrapper<"capital", "String", 0, {}, undefined>;
    code: SelectionWrapper<"code", "ID", 0, {}, undefined>;
    continent: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContinentNotNullSelectionInput>,
            "ContinentNotNullSelection",
            "Continent",
            0
        >
    >;
    currencies: SelectionWrapper<"currencies", "String", 1, {}, undefined>;
    currency: SelectionWrapper<"currency", "String", 0, {}, undefined>;
    emoji: SelectionWrapper<"emoji", "String", 0, {}, undefined>;
    emojiU: SelectionWrapper<"emojiU", "String", 0, {}, undefined>;
    languages: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLanguageNotNullArrayNotNullSelectionInput>,
            "LanguageNotNullArrayNotNullSelection",
            "Language",
            1
        >
    >;
    name: (
        args: CountryNotNullNameArgs,
    ) => SelectionWrapper<"name", "String", 0, {}, CountryNotNullNameArgs>;
    native: SelectionWrapper<"native", "String", 0, {}, undefined>;
    phone: SelectionWrapper<"phone", "String", 0, {}, undefined>;
    phones: SelectionWrapper<"phones", "String", 1, {}, undefined>;
    states: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStateNotNullArrayNotNullSelectionInput>,
            "StateNotNullArrayNotNullSelection",
            "State",
            1
        >
    >;
    subdivisions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSubdivisionNotNullArrayNotNullSelectionInput>,
            "SubdivisionNotNullArrayNotNullSelection",
            "Subdivision",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCountryNotNullSelectionInput>
    >;
};

export function makeCountryNotNullSelectionInput(
    this: any,
): ReturnTypeFromCountryNotNullSelection {
    return {
        awsRegion: new SelectionWrapper(
            "awsRegion",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        capital: new SelectionWrapper(
            "capital",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        code: new SelectionWrapper("code", "ID", 0, {}, this, undefined),
        continent: ContinentNotNullSelection.bind({
            collector: this,
            fieldName: "continent",
        }),
        currencies: new SelectionWrapper(
            "currencies",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        currency: new SelectionWrapper(
            "currency",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        emoji: new SelectionWrapper("emoji", "String", 0, {}, this, undefined),
        emojiU: new SelectionWrapper(
            "emojiU",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        languages: LanguageNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "languages",
        }),
        name: (args: CountryNotNullNameArgs) =>
            new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                this,
                undefined,
                args,
                CountryNotNullNameArgsMeta,
            ),
        native: new SelectionWrapper(
            "native",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        phone: new SelectionWrapper("phone", "String", 0, {}, this, undefined),
        phones: new SelectionWrapper(
            "phones",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        states: StateNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "states",
        }),
        subdivisions: SubdivisionNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "subdivisions",
        }),

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
                makeCountryNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCountryNotNullSelectionInput>
            >,
    } as const;
}
export const CountryNotNullSelection = makeSLFN(
    makeCountryNotNullSelectionInput,
    "CountryNotNullSelection",
    "Country",
    0,
);

type ReturnTypeFromSubdivisionNotNullArrayNotNullSelection = {
    code: SelectionWrapper<"code", "ID", 0, {}, undefined>;
    emoji: SelectionWrapper<"emoji", "String", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSubdivisionNotNullArrayNotNullSelectionInput>
    >;
};

export function makeSubdivisionNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromSubdivisionNotNullArrayNotNullSelection {
    return {
        code: new SelectionWrapper("code", "ID", 0, {}, this, undefined),
        emoji: new SelectionWrapper("emoji", "String", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

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
                makeSubdivisionNotNullArrayNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<
                    typeof makeSubdivisionNotNullArrayNotNullSelectionInput
                >
            >,
    } as const;
}
export const SubdivisionNotNullArrayNotNullSelection = makeSLFN(
    makeSubdivisionNotNullArrayNotNullSelectionInput,
    "SubdivisionNotNullArrayNotNullSelection",
    "Subdivision",
    1,
);

type ReturnTypeFromContinentSelection = {
    code: SelectionWrapper<"code", "ID", 0, {}, undefined>;
    countries: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountryNotNullArrayNotNullSelectionInput>,
            "CountryNotNullArrayNotNullSelection",
            "Country",
            1
        >
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeContinentSelectionInput>
    >;
};

export function makeContinentSelectionInput(
    this: any,
): ReturnTypeFromContinentSelection {
    return {
        code: new SelectionWrapper("code", "ID", 0, {}, this, undefined),
        countries: CountryNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "countries",
        }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

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
                makeContinentSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeContinentSelectionInput>
            >,
    } as const;
}
export const ContinentSelection = makeSLFN(
    makeContinentSelectionInput,
    "ContinentSelection",
    "Continent",
    0,
);

type ReturnTypeFromContinentNotNullArrayNotNullSelection = {
    code: SelectionWrapper<"code", "ID", 0, {}, undefined>;
    countries: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountryNotNullArrayNotNullSelectionInput>,
            "CountryNotNullArrayNotNullSelection",
            "Country",
            1
        >
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeContinentNotNullArrayNotNullSelectionInput>
    >;
};

export function makeContinentNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromContinentNotNullArrayNotNullSelection {
    return {
        code: new SelectionWrapper("code", "ID", 0, {}, this, undefined),
        countries: CountryNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "countries",
        }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

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
                makeContinentNotNullArrayNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<
                    typeof makeContinentNotNullArrayNotNullSelectionInput
                >
            >,
    } as const;
}
export const ContinentNotNullArrayNotNullSelection = makeSLFN(
    makeContinentNotNullArrayNotNullSelectionInput,
    "ContinentNotNullArrayNotNullSelection",
    "Continent",
    1,
);

type ReturnTypeFromCountrySelection = {
    awsRegion: SelectionWrapper<"awsRegion", "String", 0, {}, undefined>;
    capital: SelectionWrapper<"capital", "String", 0, {}, undefined>;
    code: SelectionWrapper<"code", "ID", 0, {}, undefined>;
    continent: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContinentNotNullSelectionInput>,
            "ContinentNotNullSelection",
            "Continent",
            0
        >
    >;
    currencies: SelectionWrapper<"currencies", "String", 1, {}, undefined>;
    currency: SelectionWrapper<"currency", "String", 0, {}, undefined>;
    emoji: SelectionWrapper<"emoji", "String", 0, {}, undefined>;
    emojiU: SelectionWrapper<"emojiU", "String", 0, {}, undefined>;
    languages: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLanguageNotNullArrayNotNullSelectionInput>,
            "LanguageNotNullArrayNotNullSelection",
            "Language",
            1
        >
    >;
    name: (
        args: CountryNameArgs,
    ) => SelectionWrapper<"name", "String", 0, {}, CountryNameArgs>;
    native: SelectionWrapper<"native", "String", 0, {}, undefined>;
    phone: SelectionWrapper<"phone", "String", 0, {}, undefined>;
    phones: SelectionWrapper<"phones", "String", 1, {}, undefined>;
    states: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStateNotNullArrayNotNullSelectionInput>,
            "StateNotNullArrayNotNullSelection",
            "State",
            1
        >
    >;
    subdivisions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSubdivisionNotNullArrayNotNullSelectionInput>,
            "SubdivisionNotNullArrayNotNullSelection",
            "Subdivision",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCountrySelectionInput>
    >;
};

export function makeCountrySelectionInput(
    this: any,
): ReturnTypeFromCountrySelection {
    return {
        awsRegion: new SelectionWrapper(
            "awsRegion",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        capital: new SelectionWrapper(
            "capital",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        code: new SelectionWrapper("code", "ID", 0, {}, this, undefined),
        continent: ContinentNotNullSelection.bind({
            collector: this,
            fieldName: "continent",
        }),
        currencies: new SelectionWrapper(
            "currencies",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        currency: new SelectionWrapper(
            "currency",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        emoji: new SelectionWrapper("emoji", "String", 0, {}, this, undefined),
        emojiU: new SelectionWrapper(
            "emojiU",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        languages: LanguageNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "languages",
        }),
        name: (args: CountryNameArgs) =>
            new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                this,
                undefined,
                args,
                CountryNameArgsMeta,
            ),
        native: new SelectionWrapper(
            "native",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        phone: new SelectionWrapper("phone", "String", 0, {}, this, undefined),
        phones: new SelectionWrapper(
            "phones",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        states: StateNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "states",
        }),
        subdivisions: SubdivisionNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "subdivisions",
        }),

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
                makeCountrySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCountrySelectionInput>
            >,
    } as const;
}
export const CountrySelection = makeSLFN(
    makeCountrySelectionInput,
    "CountrySelection",
    "Country",
    0,
);

type ReturnTypeFromLanguageSelection = {
    code: SelectionWrapper<"code", "ID", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
    native: SelectionWrapper<"native", "String", 0, {}, undefined>;
    rtl: SelectionWrapper<"rtl", "Boolean", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLanguageSelectionInput>
    >;
};

export function makeLanguageSelectionInput(
    this: any,
): ReturnTypeFromLanguageSelection {
    return {
        code: new SelectionWrapper("code", "ID", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        native: new SelectionWrapper(
            "native",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        rtl: new SelectionWrapper("rtl", "Boolean", 0, {}, this, undefined),

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
                makeLanguageSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLanguageSelectionInput>
            >,
    } as const;
}
export const LanguageSelection = makeSLFN(
    makeLanguageSelectionInput,
    "LanguageSelection",
    "Language",
    0,
);

type ReturnTypeFromQuerySelection = {
    continent: (args: QueryContinentArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContinentSelectionInput>,
            "ContinentSelection",
            "Continent",
            0,
            {
                $lazy: (args: QueryContinentArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    continents: (args: QueryContinentsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContinentNotNullArrayNotNullSelectionInput>,
            "ContinentNotNullArrayNotNullSelection",
            "Continent",
            1,
            {
                $lazy: (args: QueryContinentsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    countries: (args: QueryCountriesArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountryNotNullArrayNotNullSelectionInput>,
            "CountryNotNullArrayNotNullSelection",
            "Country",
            1,
            {
                $lazy: (args: QueryCountriesArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    country: (args: QueryCountryArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountrySelectionInput>,
            "CountrySelection",
            "Country",
            0,
            {
                $lazy: (args: QueryCountryArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    language: (args: QueryLanguageArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLanguageSelectionInput>,
            "LanguageSelection",
            "Language",
            0,
            {
                $lazy: (args: QueryLanguageArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    languages: (args: QueryLanguagesArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLanguageNotNullArrayNotNullSelectionInput>,
            "LanguageNotNullArrayNotNullSelection",
            "Language",
            1,
            {
                $lazy: (args: QueryLanguagesArgs) => Promise<"T">;
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
        continent: (args: QueryContinentArgs) =>
            ContinentSelection.bind({
                collector: this,
                fieldName: "continent",
                args,
                argsMeta: QueryContinentArgsMeta,
            }),
        continents: (args: QueryContinentsArgs) =>
            ContinentNotNullArrayNotNullSelection.bind({
                collector: this,
                fieldName: "continents",
                args,
                argsMeta: QueryContinentsArgsMeta,
            }),
        countries: (args: QueryCountriesArgs) =>
            CountryNotNullArrayNotNullSelection.bind({
                collector: this,
                fieldName: "countries",
                args,
                argsMeta: QueryCountriesArgsMeta,
            }),
        country: (args: QueryCountryArgs) =>
            CountrySelection.bind({
                collector: this,
                fieldName: "country",
                args,
                argsMeta: QueryCountryArgsMeta,
            }),
        language: (args: QueryLanguageArgs) =>
            LanguageSelection.bind({
                collector: this,
                fieldName: "language",
                args,
                argsMeta: QueryLanguageArgsMeta,
            }),
        languages: (args: QueryLanguagesArgs) =>
            LanguageNotNullArrayNotNullSelection.bind({
                collector: this,
                fieldName: "languages",
                args,
                argsMeta: QueryLanguagesArgsMeta,
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

type ReturnTypeFromStateSelection = {
    code: SelectionWrapper<"code", "String", 0, {}, undefined>;
    country: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountryNotNullSelectionInput>,
            "CountryNotNullSelection",
            "Country",
            0
        >
    >;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStateSelectionInput>
    >;
};

export function makeStateSelectionInput(
    this: any,
): ReturnTypeFromStateSelection {
    return {
        code: new SelectionWrapper("code", "String", 0, {}, this, undefined),
        country: CountryNotNullSelection.bind({
            collector: this,
            fieldName: "country",
        }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

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
                makeStateSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeStateSelectionInput>>,
    } as const;
}
export const StateSelection = makeSLFN(
    makeStateSelectionInput,
    "StateSelection",
    "State",
    0,
);

type ReturnTypeFromSubdivisionSelection = {
    code: SelectionWrapper<"code", "ID", 0, {}, undefined>;
    emoji: SelectionWrapper<"emoji", "String", 0, {}, undefined>;
    name: SelectionWrapper<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSubdivisionSelectionInput>
    >;
};

export function makeSubdivisionSelectionInput(
    this: any,
): ReturnTypeFromSubdivisionSelection {
    return {
        code: new SelectionWrapper("code", "ID", 0, {}, this, undefined),
        emoji: new SelectionWrapper("emoji", "String", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),

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
                makeSubdivisionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeSubdivisionSelectionInput>
            >,
    } as const;
}
export const SubdivisionSelection = makeSLFN(
    makeSubdivisionSelectionInput,
    "SubdivisionSelection",
    "Subdivision",
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

type __AuthenticationArg__ =
    | string
    | { [key: string]: string }
    | (() => string | { [key: string]: string })
    | (() => Promise<string | { [key: string]: string }>);
function __client__<
    T extends object,
    F extends ReturnType<typeof _makeRootOperationInput>,
>(this: any, s: (selection: F) => T) {
    const root = new OperationSelectionCollector(
        undefined,
        undefined,
        new RootOperation(),
    );
    const rootRef = { ref: root };
    const selection: F = _makeRootOperationInput.bind(rootRef)() as any;
    const r = s(selection);
    const _result = new SelectionWrapper(
        undefined,
        undefined,
        undefined,
        r,
        root,
        undefined,
    ) as unknown as T;
    Object.keys(r).forEach((key) => (_result as T)[key as keyof T]);
    const result = _result as {
        [k in keyof T]: T[k] extends (...args: infer A) => any
            ? (...args: A) => Omit<ReturnType<T[k]>, "$lazy">
            : Omit<T[k], "$lazy">;
    };
    type TR = typeof result;

    let headers: Record<string, string> | undefined = undefined;
    const finalPromise = {
        then: (resolve: (value: TR) => void, reject: (reason: any) => void) => {
            const doExecute = () => {
                root.execute(headers)
                    .then(() => {
                        resolve(result);
                    })
                    .catch(reject);
            };
            if (typeof RootOperation[OPTIONS]._auth_fn === "function") {
                const tokenOrPromise = RootOperation[OPTIONS]._auth_fn();
                if (tokenOrPromise instanceof Promise) {
                    tokenOrPromise.then((t) => {
                        if (typeof t === "string")
                            headers = { Authorization: t };
                        else headers = t;

                        doExecute();
                    });
                } else if (typeof tokenOrPromise === "string") {
                    headers = { Authorization: tokenOrPromise };

                    doExecute();
                } else {
                    headers = tokenOrPromise;

                    doExecute();
                }
            } else {
                doExecute();
            }
        },
    };

    Object.defineProperty(finalPromise, "auth", {
        enumerable: false,
        get: function () {
            return function (auth: __AuthenticationArg__) {
                if (typeof auth === "string") {
                    headers = { Authorization: auth };
                } else if (typeof auth === "function") {
                    const tokenOrPromise = auth();
                    if (tokenOrPromise instanceof Promise) {
                        return tokenOrPromise.then((t) => {
                            if (typeof t === "string")
                                headers = { Authorization: t };
                            else headers = t;

                            return finalPromise as Promise<TR>;
                        });
                    }
                    if (typeof tokenOrPromise === "string") {
                        headers = { Authorization: tokenOrPromise };
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
        auth: (auth: __AuthenticationArg__) => Promise<TR>;
    };
}

const __init__ = (options: {
    auth?: __AuthenticationArg__;
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
    if (typeof options.auth === "string") {
        RootOperation[OPTIONS].headers = {
            Authorization: options.auth,
        };
    } else if (typeof options.auth === "function") {
        RootOperation[OPTIONS]._auth_fn = options.auth;
    } else if (options.auth) {
        RootOperation[OPTIONS].headers = options.auth;
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
