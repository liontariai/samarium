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
        const res = await fetch(
            "https://swapi-graphql.netlify.app/.netlify/functions/index",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...headers,
                },
                body: JSON.stringify({
                    query: `${[...query.fragments.values()].join("\n")}\n ${query.query}`.trim(),
                    variables: query.variables,
                }),
            },
        );
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
export type FilmSpeciesConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type FilmStarshipConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type FilmVehicleConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type FilmCharacterConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type FilmPlanetConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type SpeciesPersonConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type SpeciesFilmConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type PlanetResidentConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type PlanetFilmConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type PersonFilmConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type PersonStarshipConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type PersonVehicleConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type FilmArraySpeciesConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type FilmArrayStarshipConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type FilmArrayVehicleConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type FilmArrayCharacterConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type FilmArrayPlanetConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type StarshipPilotConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type StarshipFilmConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type PersonArrayFilmConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type PersonArrayStarshipConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type PersonArrayVehicleConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type StarshipArrayPilotConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type StarshipArrayFilmConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type VehiclePilotConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type VehicleFilmConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type VehicleArrayPilotConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type VehicleArrayFilmConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type PlanetArrayResidentConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type PlanetArrayFilmConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type SpeciesArrayPersonConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type SpeciesArrayFilmConnectionArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type RootAllFilmsArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type RootFilmArgs = {
    id?: string;
    filmID?: string;
};
export type RootAllPeopleArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type RootPersonArgs = {
    id?: string;
    personID?: string;
};
export type RootAllPlanetsArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type RootPlanetArgs = {
    id?: string;
    planetID?: string;
};
export type RootAllSpeciesArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type RootSpeciesArgs = {
    id?: string;
    speciesID?: string;
};
export type RootAllStarshipsArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type RootStarshipArgs = {
    id?: string;
    starshipID?: string;
};
export type RootAllVehiclesArgs = {
    after?: string;
    first?: number;
    before?: string;
    last?: number;
};
export type RootVehicleArgs = {
    id?: string;
    vehicleID?: string;
};
export type RootNodeArgs = {
    /** The ID of an object */ id: string;
};
export const Directive_includeArgsMeta = { if: "Boolean!" } as const;
export const Directive_skipArgsMeta = { if: "Boolean!" } as const;
export const FilmArraySpeciesConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const PersonArrayFilmConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const StarshipArrayPilotConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const StarshipArrayFilmConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const PersonArrayStarshipConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const VehiclePilotConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const VehicleFilmConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const VehicleArrayPilotConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const VehicleArrayFilmConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const PersonArrayVehicleConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const StarshipPilotConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const StarshipFilmConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const FilmArrayStarshipConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const FilmArrayVehicleConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const FilmArrayCharacterConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const PlanetArrayResidentConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const PlanetArrayFilmConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const FilmArrayPlanetConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const PersonFilmConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const PersonStarshipConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const PersonVehicleConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const PlanetResidentConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const PlanetFilmConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const SpeciesPersonConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const SpeciesFilmConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const SpeciesArrayPersonConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const SpeciesArrayFilmConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const FilmSpeciesConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const FilmStarshipConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const FilmVehicleConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const FilmCharacterConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const FilmPlanetConnectionArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const RootAllFilmsArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const RootFilmArgsMeta = { id: "ID", filmID: "ID" } as const;
export const RootAllPeopleArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const RootPersonArgsMeta = { id: "ID", personID: "ID" } as const;
export const RootAllPlanetsArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const RootPlanetArgsMeta = { id: "ID", planetID: "ID" } as const;
export const RootAllSpeciesArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const RootSpeciesArgsMeta = { id: "ID", speciesID: "ID" } as const;
export const RootAllStarshipsArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const RootStarshipArgsMeta = { id: "ID", starshipID: "ID" } as const;
export const RootAllVehiclesArgsMeta = {
    after: "String",
    first: "Int",
    before: "String",
    last: "Int",
} as const;
export const RootVehicleArgsMeta = { id: "ID", vehicleID: "ID" } as const;
export const RootNodeArgsMeta = { id: "ID!" } as const;

type ReturnTypeFromPageInfoNotNullSelection = {
    hasNextPage: SelectionWrapperImpl<
        "hasNextPage",
        "Boolean",
        0,
        {},
        undefined
    >;
    hasPreviousPage: SelectionWrapperImpl<
        "hasPreviousPage",
        "Boolean",
        0,
        {},
        undefined
    >;
    startCursor: SelectionWrapperImpl<
        "startCursor",
        "String",
        0,
        {},
        undefined
    >;
    endCursor: SelectionWrapperImpl<"endCursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePageInfoNotNullSelectionInput>
    >;
};

export function makePageInfoNotNullSelectionInput(
    this: any,
): ReturnTypeFromPageInfoNotNullSelection {
    return {
        hasNextPage: new SelectionWrapper(
            "hasNextPage",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        hasPreviousPage: new SelectionWrapper(
            "hasPreviousPage",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        startCursor: new SelectionWrapper(
            "startCursor",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        endCursor: new SelectionWrapper(
            "endCursor",
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
                makePageInfoNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePageInfoNotNullSelectionInput>
            >,
    } as const;
}
export const PageInfoNotNullSelection = makeSLFN(
    makePageInfoNotNullSelectionInput,
    "PageInfoNotNullSelection",
    "PageInfo",
    0,
);

type ReturnTypeFromFilmsEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSelectionInput>,
            "FilmSelection",
            "Film",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmsEdgeArraySelectionInput>
    >;
};

export function makeFilmsEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromFilmsEdgeArraySelection {
    return {
        node: FilmSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeFilmsEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmsEdgeArraySelectionInput>
            >,
    } as const;
}
export const FilmsEdgeArraySelection = makeSLFN(
    makeFilmsEdgeArraySelectionInput,
    "FilmsEdgeArraySelection",
    "FilmsEdge",
    1,
);

type ReturnTypeFromFilmSelection = {
    title: SelectionWrapperImpl<"title", "String", 0, {}, undefined>;
    episodeID: SelectionWrapperImpl<"episodeID", "Int", 0, {}, undefined>;
    openingCrawl: SelectionWrapperImpl<
        "openingCrawl",
        "String",
        0,
        {},
        undefined
    >;
    director: SelectionWrapperImpl<"director", "String", 0, {}, undefined>;
    producers: SelectionWrapperImpl<"producers", "String", 1, {}, undefined>;
    releaseDate: SelectionWrapperImpl<
        "releaseDate",
        "String",
        0,
        {},
        undefined
    >;
    speciesConnection: (
        args: FilmSpeciesConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSpeciesConnectionSelectionInput>,
            "FilmSpeciesConnectionSelection",
            "FilmSpeciesConnection",
            0
        >
    >;
    starshipConnection: (
        args: FilmStarshipConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmStarshipsConnectionSelectionInput>,
            "FilmStarshipsConnectionSelection",
            "FilmStarshipsConnection",
            0
        >
    >;
    vehicleConnection: (
        args: FilmVehicleConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmVehiclesConnectionSelectionInput>,
            "FilmVehiclesConnectionSelection",
            "FilmVehiclesConnection",
            0
        >
    >;
    characterConnection: (
        args: FilmCharacterConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmCharactersConnectionSelectionInput>,
            "FilmCharactersConnectionSelection",
            "FilmCharactersConnection",
            0
        >
    >;
    planetConnection: (
        args: FilmPlanetConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmPlanetsConnectionSelectionInput>,
            "FilmPlanetsConnectionSelection",
            "FilmPlanetsConnection",
            0
        >
    >;
    created: SelectionWrapperImpl<"created", "String", 0, {}, undefined>;
    edited: SelectionWrapperImpl<"edited", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmSelectionInput>
    >;
};

export function makeFilmSelectionInput(this: any): ReturnTypeFromFilmSelection {
    return {
        title: new SelectionWrapper("title", "String", 0, {}, this, undefined),
        episodeID: new SelectionWrapper(
            "episodeID",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        openingCrawl: new SelectionWrapper(
            "openingCrawl",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        director: new SelectionWrapper(
            "director",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        producers: new SelectionWrapper(
            "producers",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        releaseDate: new SelectionWrapper(
            "releaseDate",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        speciesConnection: (args: FilmSpeciesConnectionArgs) =>
            FilmSpeciesConnectionSelection.bind({
                collector: this,
                fieldName: "speciesConnection",
                args,
                argsMeta: FilmSpeciesConnectionArgsMeta,
            }),
        starshipConnection: (args: FilmStarshipConnectionArgs) =>
            FilmStarshipsConnectionSelection.bind({
                collector: this,
                fieldName: "starshipConnection",
                args,
                argsMeta: FilmStarshipConnectionArgsMeta,
            }),
        vehicleConnection: (args: FilmVehicleConnectionArgs) =>
            FilmVehiclesConnectionSelection.bind({
                collector: this,
                fieldName: "vehicleConnection",
                args,
                argsMeta: FilmVehicleConnectionArgsMeta,
            }),
        characterConnection: (args: FilmCharacterConnectionArgs) =>
            FilmCharactersConnectionSelection.bind({
                collector: this,
                fieldName: "characterConnection",
                args,
                argsMeta: FilmCharacterConnectionArgsMeta,
            }),
        planetConnection: (args: FilmPlanetConnectionArgs) =>
            FilmPlanetsConnectionSelection.bind({
                collector: this,
                fieldName: "planetConnection",
                args,
                argsMeta: FilmPlanetConnectionArgsMeta,
            }),
        created: new SelectionWrapper(
            "created",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        edited: new SelectionWrapper(
            "edited",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),

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
                makeFilmSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeFilmSelectionInput>>,
    } as const;
}
export const FilmSelection = makeSLFN(
    makeFilmSelectionInput,
    "FilmSelection",
    "Film",
    0,
);

type ReturnTypeFromFilmSpeciesConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSpeciesEdgeArraySelectionInput>,
            "FilmSpeciesEdgeArraySelection",
            "FilmSpeciesEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    species: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesArraySelectionInput>,
            "SpeciesArraySelection",
            "Species",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmSpeciesConnectionSelectionInput>
    >;
};

export function makeFilmSpeciesConnectionSelectionInput(
    this: any,
): ReturnTypeFromFilmSpeciesConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: FilmSpeciesEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        species: SpeciesArraySelection.bind({
            collector: this,
            fieldName: "species",
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
                makeFilmSpeciesConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmSpeciesConnectionSelectionInput>
            >,
    } as const;
}
export const FilmSpeciesConnectionSelection = makeSLFN(
    makeFilmSpeciesConnectionSelectionInput,
    "FilmSpeciesConnectionSelection",
    "FilmSpeciesConnection",
    0,
);

type ReturnTypeFromFilmSpeciesEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesSelectionInput>,
            "SpeciesSelection",
            "Species",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmSpeciesEdgeArraySelectionInput>
    >;
};

export function makeFilmSpeciesEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromFilmSpeciesEdgeArraySelection {
    return {
        node: SpeciesSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeFilmSpeciesEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmSpeciesEdgeArraySelectionInput>
            >,
    } as const;
}
export const FilmSpeciesEdgeArraySelection = makeSLFN(
    makeFilmSpeciesEdgeArraySelectionInput,
    "FilmSpeciesEdgeArraySelection",
    "FilmSpeciesEdge",
    1,
);

type ReturnTypeFromSpeciesSelection = {
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    classification: SelectionWrapperImpl<
        "classification",
        "String",
        0,
        {},
        undefined
    >;
    designation: SelectionWrapperImpl<
        "designation",
        "String",
        0,
        {},
        undefined
    >;
    averageHeight: SelectionWrapperImpl<
        "averageHeight",
        "Float",
        0,
        {},
        undefined
    >;
    averageLifespan: SelectionWrapperImpl<
        "averageLifespan",
        "Int",
        0,
        {},
        undefined
    >;
    eyeColors: SelectionWrapperImpl<"eyeColors", "String", 1, {}, undefined>;
    hairColors: SelectionWrapperImpl<"hairColors", "String", 1, {}, undefined>;
    skinColors: SelectionWrapperImpl<"skinColors", "String", 1, {}, undefined>;
    language: SelectionWrapperImpl<"language", "String", 0, {}, undefined>;
    homeworld: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetSelectionInput>,
            "PlanetSelection",
            "Planet",
            0
        >
    >;
    personConnection: (
        args: SpeciesPersonConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesPeopleConnectionSelectionInput>,
            "SpeciesPeopleConnectionSelection",
            "SpeciesPeopleConnection",
            0
        >
    >;
    filmConnection: (
        args: SpeciesFilmConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesFilmsConnectionSelectionInput>,
            "SpeciesFilmsConnectionSelection",
            "SpeciesFilmsConnection",
            0
        >
    >;
    created: SelectionWrapperImpl<"created", "String", 0, {}, undefined>;
    edited: SelectionWrapperImpl<"edited", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSpeciesSelectionInput>
    >;
};

export function makeSpeciesSelectionInput(
    this: any,
): ReturnTypeFromSpeciesSelection {
    return {
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        classification: new SelectionWrapper(
            "classification",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        designation: new SelectionWrapper(
            "designation",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        averageHeight: new SelectionWrapper(
            "averageHeight",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        averageLifespan: new SelectionWrapper(
            "averageLifespan",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        eyeColors: new SelectionWrapper(
            "eyeColors",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        hairColors: new SelectionWrapper(
            "hairColors",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        skinColors: new SelectionWrapper(
            "skinColors",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        language: new SelectionWrapper(
            "language",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        homeworld: PlanetSelection.bind({
            collector: this,
            fieldName: "homeworld",
        }),
        personConnection: (args: SpeciesPersonConnectionArgs) =>
            SpeciesPeopleConnectionSelection.bind({
                collector: this,
                fieldName: "personConnection",
                args,
                argsMeta: SpeciesPersonConnectionArgsMeta,
            }),
        filmConnection: (args: SpeciesFilmConnectionArgs) =>
            SpeciesFilmsConnectionSelection.bind({
                collector: this,
                fieldName: "filmConnection",
                args,
                argsMeta: SpeciesFilmConnectionArgsMeta,
            }),
        created: new SelectionWrapper(
            "created",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        edited: new SelectionWrapper(
            "edited",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),

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
                makeSpeciesSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeSpeciesSelectionInput>
            >,
    } as const;
}
export const SpeciesSelection = makeSLFN(
    makeSpeciesSelectionInput,
    "SpeciesSelection",
    "Species",
    0,
);

type ReturnTypeFromPlanetSelection = {
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    diameter: SelectionWrapperImpl<"diameter", "Int", 0, {}, undefined>;
    rotationPeriod: SelectionWrapperImpl<
        "rotationPeriod",
        "Int",
        0,
        {},
        undefined
    >;
    orbitalPeriod: SelectionWrapperImpl<
        "orbitalPeriod",
        "Int",
        0,
        {},
        undefined
    >;
    gravity: SelectionWrapperImpl<"gravity", "String", 0, {}, undefined>;
    population: SelectionWrapperImpl<"population", "Float", 0, {}, undefined>;
    climates: SelectionWrapperImpl<"climates", "String", 1, {}, undefined>;
    terrains: SelectionWrapperImpl<"terrains", "String", 1, {}, undefined>;
    surfaceWater: SelectionWrapperImpl<
        "surfaceWater",
        "Float",
        0,
        {},
        undefined
    >;
    residentConnection: (
        args: PlanetResidentConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetResidentsConnectionSelectionInput>,
            "PlanetResidentsConnectionSelection",
            "PlanetResidentsConnection",
            0
        >
    >;
    filmConnection: (
        args: PlanetFilmConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetFilmsConnectionSelectionInput>,
            "PlanetFilmsConnectionSelection",
            "PlanetFilmsConnection",
            0
        >
    >;
    created: SelectionWrapperImpl<"created", "String", 0, {}, undefined>;
    edited: SelectionWrapperImpl<"edited", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePlanetSelectionInput>
    >;
};

export function makePlanetSelectionInput(
    this: any,
): ReturnTypeFromPlanetSelection {
    return {
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        diameter: new SelectionWrapper(
            "diameter",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        rotationPeriod: new SelectionWrapper(
            "rotationPeriod",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        orbitalPeriod: new SelectionWrapper(
            "orbitalPeriod",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        gravity: new SelectionWrapper(
            "gravity",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        population: new SelectionWrapper(
            "population",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        climates: new SelectionWrapper(
            "climates",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        terrains: new SelectionWrapper(
            "terrains",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        surfaceWater: new SelectionWrapper(
            "surfaceWater",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        residentConnection: (args: PlanetResidentConnectionArgs) =>
            PlanetResidentsConnectionSelection.bind({
                collector: this,
                fieldName: "residentConnection",
                args,
                argsMeta: PlanetResidentConnectionArgsMeta,
            }),
        filmConnection: (args: PlanetFilmConnectionArgs) =>
            PlanetFilmsConnectionSelection.bind({
                collector: this,
                fieldName: "filmConnection",
                args,
                argsMeta: PlanetFilmConnectionArgsMeta,
            }),
        created: new SelectionWrapper(
            "created",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        edited: new SelectionWrapper(
            "edited",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),

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
                makePlanetSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makePlanetSelectionInput>>,
    } as const;
}
export const PlanetSelection = makeSLFN(
    makePlanetSelectionInput,
    "PlanetSelection",
    "Planet",
    0,
);

type ReturnTypeFromPlanetResidentsConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetResidentsEdgeArraySelectionInput>,
            "PlanetResidentsEdgeArraySelection",
            "PlanetResidentsEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    residents: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonArraySelectionInput>,
            "PersonArraySelection",
            "Person",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePlanetResidentsConnectionSelectionInput>
    >;
};

export function makePlanetResidentsConnectionSelectionInput(
    this: any,
): ReturnTypeFromPlanetResidentsConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: PlanetResidentsEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        residents: PersonArraySelection.bind({
            collector: this,
            fieldName: "residents",
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
                makePlanetResidentsConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePlanetResidentsConnectionSelectionInput>
            >,
    } as const;
}
export const PlanetResidentsConnectionSelection = makeSLFN(
    makePlanetResidentsConnectionSelectionInput,
    "PlanetResidentsConnectionSelection",
    "PlanetResidentsConnection",
    0,
);

type ReturnTypeFromPlanetResidentsEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonSelectionInput>,
            "PersonSelection",
            "Person",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePlanetResidentsEdgeArraySelectionInput>
    >;
};

export function makePlanetResidentsEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromPlanetResidentsEdgeArraySelection {
    return {
        node: PersonSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makePlanetResidentsEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePlanetResidentsEdgeArraySelectionInput>
            >,
    } as const;
}
export const PlanetResidentsEdgeArraySelection = makeSLFN(
    makePlanetResidentsEdgeArraySelectionInput,
    "PlanetResidentsEdgeArraySelection",
    "PlanetResidentsEdge",
    1,
);

type ReturnTypeFromPersonSelection = {
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    birthYear: SelectionWrapperImpl<"birthYear", "String", 0, {}, undefined>;
    eyeColor: SelectionWrapperImpl<"eyeColor", "String", 0, {}, undefined>;
    gender: SelectionWrapperImpl<"gender", "String", 0, {}, undefined>;
    hairColor: SelectionWrapperImpl<"hairColor", "String", 0, {}, undefined>;
    height: SelectionWrapperImpl<"height", "Int", 0, {}, undefined>;
    mass: SelectionWrapperImpl<"mass", "Float", 0, {}, undefined>;
    skinColor: SelectionWrapperImpl<"skinColor", "String", 0, {}, undefined>;
    homeworld: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetSelectionInput>,
            "PlanetSelection",
            "Planet",
            0
        >
    >;
    filmConnection: (
        args: PersonFilmConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonFilmsConnectionSelectionInput>,
            "PersonFilmsConnectionSelection",
            "PersonFilmsConnection",
            0
        >
    >;
    species: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesSelectionInput>,
            "SpeciesSelection",
            "Species",
            0
        >
    >;
    starshipConnection: (
        args: PersonStarshipConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonStarshipsConnectionSelectionInput>,
            "PersonStarshipsConnectionSelection",
            "PersonStarshipsConnection",
            0
        >
    >;
    vehicleConnection: (
        args: PersonVehicleConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonVehiclesConnectionSelectionInput>,
            "PersonVehiclesConnectionSelection",
            "PersonVehiclesConnection",
            0
        >
    >;
    created: SelectionWrapperImpl<"created", "String", 0, {}, undefined>;
    edited: SelectionWrapperImpl<"edited", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePersonSelectionInput>
    >;
};

export function makePersonSelectionInput(
    this: any,
): ReturnTypeFromPersonSelection {
    return {
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        birthYear: new SelectionWrapper(
            "birthYear",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        eyeColor: new SelectionWrapper(
            "eyeColor",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        gender: new SelectionWrapper(
            "gender",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        hairColor: new SelectionWrapper(
            "hairColor",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        height: new SelectionWrapper("height", "Int", 0, {}, this, undefined),
        mass: new SelectionWrapper("mass", "Float", 0, {}, this, undefined),
        skinColor: new SelectionWrapper(
            "skinColor",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        homeworld: PlanetSelection.bind({
            collector: this,
            fieldName: "homeworld",
        }),
        filmConnection: (args: PersonFilmConnectionArgs) =>
            PersonFilmsConnectionSelection.bind({
                collector: this,
                fieldName: "filmConnection",
                args,
                argsMeta: PersonFilmConnectionArgsMeta,
            }),
        species: SpeciesSelection.bind({
            collector: this,
            fieldName: "species",
        }),
        starshipConnection: (args: PersonStarshipConnectionArgs) =>
            PersonStarshipsConnectionSelection.bind({
                collector: this,
                fieldName: "starshipConnection",
                args,
                argsMeta: PersonStarshipConnectionArgsMeta,
            }),
        vehicleConnection: (args: PersonVehicleConnectionArgs) =>
            PersonVehiclesConnectionSelection.bind({
                collector: this,
                fieldName: "vehicleConnection",
                args,
                argsMeta: PersonVehicleConnectionArgsMeta,
            }),
        created: new SelectionWrapper(
            "created",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        edited: new SelectionWrapper(
            "edited",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),

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
                makePersonSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makePersonSelectionInput>>,
    } as const;
}
export const PersonSelection = makeSLFN(
    makePersonSelectionInput,
    "PersonSelection",
    "Person",
    0,
);

type ReturnTypeFromPersonFilmsConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonFilmsEdgeArraySelectionInput>,
            "PersonFilmsEdgeArraySelection",
            "PersonFilmsEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    films: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmArraySelectionInput>,
            "FilmArraySelection",
            "Film",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePersonFilmsConnectionSelectionInput>
    >;
};

export function makePersonFilmsConnectionSelectionInput(
    this: any,
): ReturnTypeFromPersonFilmsConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: PersonFilmsEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        films: FilmArraySelection.bind({ collector: this, fieldName: "films" }),

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
                makePersonFilmsConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePersonFilmsConnectionSelectionInput>
            >,
    } as const;
}
export const PersonFilmsConnectionSelection = makeSLFN(
    makePersonFilmsConnectionSelectionInput,
    "PersonFilmsConnectionSelection",
    "PersonFilmsConnection",
    0,
);

type ReturnTypeFromPersonFilmsEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSelectionInput>,
            "FilmSelection",
            "Film",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePersonFilmsEdgeArraySelectionInput>
    >;
};

export function makePersonFilmsEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromPersonFilmsEdgeArraySelection {
    return {
        node: FilmSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makePersonFilmsEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePersonFilmsEdgeArraySelectionInput>
            >,
    } as const;
}
export const PersonFilmsEdgeArraySelection = makeSLFN(
    makePersonFilmsEdgeArraySelectionInput,
    "PersonFilmsEdgeArraySelection",
    "PersonFilmsEdge",
    1,
);

type ReturnTypeFromFilmArraySelection = {
    title: SelectionWrapperImpl<"title", "String", 0, {}, undefined>;
    episodeID: SelectionWrapperImpl<"episodeID", "Int", 0, {}, undefined>;
    openingCrawl: SelectionWrapperImpl<
        "openingCrawl",
        "String",
        0,
        {},
        undefined
    >;
    director: SelectionWrapperImpl<"director", "String", 0, {}, undefined>;
    producers: SelectionWrapperImpl<"producers", "String", 1, {}, undefined>;
    releaseDate: SelectionWrapperImpl<
        "releaseDate",
        "String",
        0,
        {},
        undefined
    >;
    speciesConnection: (
        args: FilmArraySpeciesConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSpeciesConnectionSelectionInput>,
            "FilmSpeciesConnectionSelection",
            "FilmSpeciesConnection",
            0
        >
    >;
    starshipConnection: (
        args: FilmArrayStarshipConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmStarshipsConnectionSelectionInput>,
            "FilmStarshipsConnectionSelection",
            "FilmStarshipsConnection",
            0
        >
    >;
    vehicleConnection: (
        args: FilmArrayVehicleConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmVehiclesConnectionSelectionInput>,
            "FilmVehiclesConnectionSelection",
            "FilmVehiclesConnection",
            0
        >
    >;
    characterConnection: (
        args: FilmArrayCharacterConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmCharactersConnectionSelectionInput>,
            "FilmCharactersConnectionSelection",
            "FilmCharactersConnection",
            0
        >
    >;
    planetConnection: (
        args: FilmArrayPlanetConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmPlanetsConnectionSelectionInput>,
            "FilmPlanetsConnectionSelection",
            "FilmPlanetsConnection",
            0
        >
    >;
    created: SelectionWrapperImpl<"created", "String", 0, {}, undefined>;
    edited: SelectionWrapperImpl<"edited", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmArraySelectionInput>
    >;
};

export function makeFilmArraySelectionInput(
    this: any,
): ReturnTypeFromFilmArraySelection {
    return {
        title: new SelectionWrapper("title", "String", 0, {}, this, undefined),
        episodeID: new SelectionWrapper(
            "episodeID",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        openingCrawl: new SelectionWrapper(
            "openingCrawl",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        director: new SelectionWrapper(
            "director",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        producers: new SelectionWrapper(
            "producers",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        releaseDate: new SelectionWrapper(
            "releaseDate",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        speciesConnection: (args: FilmArraySpeciesConnectionArgs) =>
            FilmSpeciesConnectionSelection.bind({
                collector: this,
                fieldName: "speciesConnection",
                args,
                argsMeta: FilmArraySpeciesConnectionArgsMeta,
            }),
        starshipConnection: (args: FilmArrayStarshipConnectionArgs) =>
            FilmStarshipsConnectionSelection.bind({
                collector: this,
                fieldName: "starshipConnection",
                args,
                argsMeta: FilmArrayStarshipConnectionArgsMeta,
            }),
        vehicleConnection: (args: FilmArrayVehicleConnectionArgs) =>
            FilmVehiclesConnectionSelection.bind({
                collector: this,
                fieldName: "vehicleConnection",
                args,
                argsMeta: FilmArrayVehicleConnectionArgsMeta,
            }),
        characterConnection: (args: FilmArrayCharacterConnectionArgs) =>
            FilmCharactersConnectionSelection.bind({
                collector: this,
                fieldName: "characterConnection",
                args,
                argsMeta: FilmArrayCharacterConnectionArgsMeta,
            }),
        planetConnection: (args: FilmArrayPlanetConnectionArgs) =>
            FilmPlanetsConnectionSelection.bind({
                collector: this,
                fieldName: "planetConnection",
                args,
                argsMeta: FilmArrayPlanetConnectionArgsMeta,
            }),
        created: new SelectionWrapper(
            "created",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        edited: new SelectionWrapper(
            "edited",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),

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
                makeFilmArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmArraySelectionInput>
            >,
    } as const;
}
export const FilmArraySelection = makeSLFN(
    makeFilmArraySelectionInput,
    "FilmArraySelection",
    "Film",
    1,
);

type ReturnTypeFromFilmStarshipsConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmStarshipsEdgeArraySelectionInput>,
            "FilmStarshipsEdgeArraySelection",
            "FilmStarshipsEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    starships: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipArraySelectionInput>,
            "StarshipArraySelection",
            "Starship",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmStarshipsConnectionSelectionInput>
    >;
};

export function makeFilmStarshipsConnectionSelectionInput(
    this: any,
): ReturnTypeFromFilmStarshipsConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: FilmStarshipsEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        starships: StarshipArraySelection.bind({
            collector: this,
            fieldName: "starships",
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
                makeFilmStarshipsConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmStarshipsConnectionSelectionInput>
            >,
    } as const;
}
export const FilmStarshipsConnectionSelection = makeSLFN(
    makeFilmStarshipsConnectionSelectionInput,
    "FilmStarshipsConnectionSelection",
    "FilmStarshipsConnection",
    0,
);

type ReturnTypeFromFilmStarshipsEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipSelectionInput>,
            "StarshipSelection",
            "Starship",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmStarshipsEdgeArraySelectionInput>
    >;
};

export function makeFilmStarshipsEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromFilmStarshipsEdgeArraySelection {
    return {
        node: StarshipSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeFilmStarshipsEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmStarshipsEdgeArraySelectionInput>
            >,
    } as const;
}
export const FilmStarshipsEdgeArraySelection = makeSLFN(
    makeFilmStarshipsEdgeArraySelectionInput,
    "FilmStarshipsEdgeArraySelection",
    "FilmStarshipsEdge",
    1,
);

type ReturnTypeFromStarshipSelection = {
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    model: SelectionWrapperImpl<"model", "String", 0, {}, undefined>;
    starshipClass: SelectionWrapperImpl<
        "starshipClass",
        "String",
        0,
        {},
        undefined
    >;
    manufacturers: SelectionWrapperImpl<
        "manufacturers",
        "String",
        1,
        {},
        undefined
    >;
    costInCredits: SelectionWrapperImpl<
        "costInCredits",
        "Float",
        0,
        {},
        undefined
    >;
    length: SelectionWrapperImpl<"length", "Float", 0, {}, undefined>;
    crew: SelectionWrapperImpl<"crew", "String", 0, {}, undefined>;
    passengers: SelectionWrapperImpl<"passengers", "String", 0, {}, undefined>;
    maxAtmospheringSpeed: SelectionWrapperImpl<
        "maxAtmospheringSpeed",
        "Int",
        0,
        {},
        undefined
    >;
    hyperdriveRating: SelectionWrapperImpl<
        "hyperdriveRating",
        "Float",
        0,
        {},
        undefined
    >;
    MGLT: SelectionWrapperImpl<"MGLT", "Int", 0, {}, undefined>;
    cargoCapacity: SelectionWrapperImpl<
        "cargoCapacity",
        "Float",
        0,
        {},
        undefined
    >;
    consumables: SelectionWrapperImpl<
        "consumables",
        "String",
        0,
        {},
        undefined
    >;
    pilotConnection: (
        args: StarshipPilotConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipPilotsConnectionSelectionInput>,
            "StarshipPilotsConnectionSelection",
            "StarshipPilotsConnection",
            0
        >
    >;
    filmConnection: (
        args: StarshipFilmConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipFilmsConnectionSelectionInput>,
            "StarshipFilmsConnectionSelection",
            "StarshipFilmsConnection",
            0
        >
    >;
    created: SelectionWrapperImpl<"created", "String", 0, {}, undefined>;
    edited: SelectionWrapperImpl<"edited", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStarshipSelectionInput>
    >;
};

export function makeStarshipSelectionInput(
    this: any,
): ReturnTypeFromStarshipSelection {
    return {
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        model: new SelectionWrapper("model", "String", 0, {}, this, undefined),
        starshipClass: new SelectionWrapper(
            "starshipClass",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        manufacturers: new SelectionWrapper(
            "manufacturers",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        costInCredits: new SelectionWrapper(
            "costInCredits",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        length: new SelectionWrapper("length", "Float", 0, {}, this, undefined),
        crew: new SelectionWrapper("crew", "String", 0, {}, this, undefined),
        passengers: new SelectionWrapper(
            "passengers",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        maxAtmospheringSpeed: new SelectionWrapper(
            "maxAtmospheringSpeed",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        hyperdriveRating: new SelectionWrapper(
            "hyperdriveRating",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        MGLT: new SelectionWrapper("MGLT", "Int", 0, {}, this, undefined),
        cargoCapacity: new SelectionWrapper(
            "cargoCapacity",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        consumables: new SelectionWrapper(
            "consumables",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        pilotConnection: (args: StarshipPilotConnectionArgs) =>
            StarshipPilotsConnectionSelection.bind({
                collector: this,
                fieldName: "pilotConnection",
                args,
                argsMeta: StarshipPilotConnectionArgsMeta,
            }),
        filmConnection: (args: StarshipFilmConnectionArgs) =>
            StarshipFilmsConnectionSelection.bind({
                collector: this,
                fieldName: "filmConnection",
                args,
                argsMeta: StarshipFilmConnectionArgsMeta,
            }),
        created: new SelectionWrapper(
            "created",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        edited: new SelectionWrapper(
            "edited",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),

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
                makeStarshipSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeStarshipSelectionInput>
            >,
    } as const;
}
export const StarshipSelection = makeSLFN(
    makeStarshipSelectionInput,
    "StarshipSelection",
    "Starship",
    0,
);

type ReturnTypeFromStarshipPilotsConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipPilotsEdgeArraySelectionInput>,
            "StarshipPilotsEdgeArraySelection",
            "StarshipPilotsEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    pilots: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonArraySelectionInput>,
            "PersonArraySelection",
            "Person",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStarshipPilotsConnectionSelectionInput>
    >;
};

export function makeStarshipPilotsConnectionSelectionInput(
    this: any,
): ReturnTypeFromStarshipPilotsConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: StarshipPilotsEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        pilots: PersonArraySelection.bind({
            collector: this,
            fieldName: "pilots",
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
                makeStarshipPilotsConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeStarshipPilotsConnectionSelectionInput>
            >,
    } as const;
}
export const StarshipPilotsConnectionSelection = makeSLFN(
    makeStarshipPilotsConnectionSelectionInput,
    "StarshipPilotsConnectionSelection",
    "StarshipPilotsConnection",
    0,
);

type ReturnTypeFromStarshipPilotsEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonSelectionInput>,
            "PersonSelection",
            "Person",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStarshipPilotsEdgeArraySelectionInput>
    >;
};

export function makeStarshipPilotsEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromStarshipPilotsEdgeArraySelection {
    return {
        node: PersonSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeStarshipPilotsEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeStarshipPilotsEdgeArraySelectionInput>
            >,
    } as const;
}
export const StarshipPilotsEdgeArraySelection = makeSLFN(
    makeStarshipPilotsEdgeArraySelectionInput,
    "StarshipPilotsEdgeArraySelection",
    "StarshipPilotsEdge",
    1,
);

type ReturnTypeFromPersonArraySelection = {
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    birthYear: SelectionWrapperImpl<"birthYear", "String", 0, {}, undefined>;
    eyeColor: SelectionWrapperImpl<"eyeColor", "String", 0, {}, undefined>;
    gender: SelectionWrapperImpl<"gender", "String", 0, {}, undefined>;
    hairColor: SelectionWrapperImpl<"hairColor", "String", 0, {}, undefined>;
    height: SelectionWrapperImpl<"height", "Int", 0, {}, undefined>;
    mass: SelectionWrapperImpl<"mass", "Float", 0, {}, undefined>;
    skinColor: SelectionWrapperImpl<"skinColor", "String", 0, {}, undefined>;
    homeworld: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetSelectionInput>,
            "PlanetSelection",
            "Planet",
            0
        >
    >;
    filmConnection: (
        args: PersonArrayFilmConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonFilmsConnectionSelectionInput>,
            "PersonFilmsConnectionSelection",
            "PersonFilmsConnection",
            0
        >
    >;
    species: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesSelectionInput>,
            "SpeciesSelection",
            "Species",
            0
        >
    >;
    starshipConnection: (
        args: PersonArrayStarshipConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonStarshipsConnectionSelectionInput>,
            "PersonStarshipsConnectionSelection",
            "PersonStarshipsConnection",
            0
        >
    >;
    vehicleConnection: (
        args: PersonArrayVehicleConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonVehiclesConnectionSelectionInput>,
            "PersonVehiclesConnectionSelection",
            "PersonVehiclesConnection",
            0
        >
    >;
    created: SelectionWrapperImpl<"created", "String", 0, {}, undefined>;
    edited: SelectionWrapperImpl<"edited", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePersonArraySelectionInput>
    >;
};

export function makePersonArraySelectionInput(
    this: any,
): ReturnTypeFromPersonArraySelection {
    return {
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        birthYear: new SelectionWrapper(
            "birthYear",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        eyeColor: new SelectionWrapper(
            "eyeColor",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        gender: new SelectionWrapper(
            "gender",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        hairColor: new SelectionWrapper(
            "hairColor",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        height: new SelectionWrapper("height", "Int", 0, {}, this, undefined),
        mass: new SelectionWrapper("mass", "Float", 0, {}, this, undefined),
        skinColor: new SelectionWrapper(
            "skinColor",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        homeworld: PlanetSelection.bind({
            collector: this,
            fieldName: "homeworld",
        }),
        filmConnection: (args: PersonArrayFilmConnectionArgs) =>
            PersonFilmsConnectionSelection.bind({
                collector: this,
                fieldName: "filmConnection",
                args,
                argsMeta: PersonArrayFilmConnectionArgsMeta,
            }),
        species: SpeciesSelection.bind({
            collector: this,
            fieldName: "species",
        }),
        starshipConnection: (args: PersonArrayStarshipConnectionArgs) =>
            PersonStarshipsConnectionSelection.bind({
                collector: this,
                fieldName: "starshipConnection",
                args,
                argsMeta: PersonArrayStarshipConnectionArgsMeta,
            }),
        vehicleConnection: (args: PersonArrayVehicleConnectionArgs) =>
            PersonVehiclesConnectionSelection.bind({
                collector: this,
                fieldName: "vehicleConnection",
                args,
                argsMeta: PersonArrayVehicleConnectionArgsMeta,
            }),
        created: new SelectionWrapper(
            "created",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        edited: new SelectionWrapper(
            "edited",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),

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
                makePersonArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePersonArraySelectionInput>
            >,
    } as const;
}
export const PersonArraySelection = makeSLFN(
    makePersonArraySelectionInput,
    "PersonArraySelection",
    "Person",
    1,
);

type ReturnTypeFromPersonStarshipsConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonStarshipsEdgeArraySelectionInput>,
            "PersonStarshipsEdgeArraySelection",
            "PersonStarshipsEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    starships: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipArraySelectionInput>,
            "StarshipArraySelection",
            "Starship",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePersonStarshipsConnectionSelectionInput>
    >;
};

export function makePersonStarshipsConnectionSelectionInput(
    this: any,
): ReturnTypeFromPersonStarshipsConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: PersonStarshipsEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        starships: StarshipArraySelection.bind({
            collector: this,
            fieldName: "starships",
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
                makePersonStarshipsConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePersonStarshipsConnectionSelectionInput>
            >,
    } as const;
}
export const PersonStarshipsConnectionSelection = makeSLFN(
    makePersonStarshipsConnectionSelectionInput,
    "PersonStarshipsConnectionSelection",
    "PersonStarshipsConnection",
    0,
);

type ReturnTypeFromPersonStarshipsEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipSelectionInput>,
            "StarshipSelection",
            "Starship",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePersonStarshipsEdgeArraySelectionInput>
    >;
};

export function makePersonStarshipsEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromPersonStarshipsEdgeArraySelection {
    return {
        node: StarshipSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makePersonStarshipsEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePersonStarshipsEdgeArraySelectionInput>
            >,
    } as const;
}
export const PersonStarshipsEdgeArraySelection = makeSLFN(
    makePersonStarshipsEdgeArraySelectionInput,
    "PersonStarshipsEdgeArraySelection",
    "PersonStarshipsEdge",
    1,
);

type ReturnTypeFromStarshipArraySelection = {
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    model: SelectionWrapperImpl<"model", "String", 0, {}, undefined>;
    starshipClass: SelectionWrapperImpl<
        "starshipClass",
        "String",
        0,
        {},
        undefined
    >;
    manufacturers: SelectionWrapperImpl<
        "manufacturers",
        "String",
        1,
        {},
        undefined
    >;
    costInCredits: SelectionWrapperImpl<
        "costInCredits",
        "Float",
        0,
        {},
        undefined
    >;
    length: SelectionWrapperImpl<"length", "Float", 0, {}, undefined>;
    crew: SelectionWrapperImpl<"crew", "String", 0, {}, undefined>;
    passengers: SelectionWrapperImpl<"passengers", "String", 0, {}, undefined>;
    maxAtmospheringSpeed: SelectionWrapperImpl<
        "maxAtmospheringSpeed",
        "Int",
        0,
        {},
        undefined
    >;
    hyperdriveRating: SelectionWrapperImpl<
        "hyperdriveRating",
        "Float",
        0,
        {},
        undefined
    >;
    MGLT: SelectionWrapperImpl<"MGLT", "Int", 0, {}, undefined>;
    cargoCapacity: SelectionWrapperImpl<
        "cargoCapacity",
        "Float",
        0,
        {},
        undefined
    >;
    consumables: SelectionWrapperImpl<
        "consumables",
        "String",
        0,
        {},
        undefined
    >;
    pilotConnection: (
        args: StarshipArrayPilotConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipPilotsConnectionSelectionInput>,
            "StarshipPilotsConnectionSelection",
            "StarshipPilotsConnection",
            0
        >
    >;
    filmConnection: (
        args: StarshipArrayFilmConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipFilmsConnectionSelectionInput>,
            "StarshipFilmsConnectionSelection",
            "StarshipFilmsConnection",
            0
        >
    >;
    created: SelectionWrapperImpl<"created", "String", 0, {}, undefined>;
    edited: SelectionWrapperImpl<"edited", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStarshipArraySelectionInput>
    >;
};

export function makeStarshipArraySelectionInput(
    this: any,
): ReturnTypeFromStarshipArraySelection {
    return {
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        model: new SelectionWrapper("model", "String", 0, {}, this, undefined),
        starshipClass: new SelectionWrapper(
            "starshipClass",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        manufacturers: new SelectionWrapper(
            "manufacturers",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        costInCredits: new SelectionWrapper(
            "costInCredits",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        length: new SelectionWrapper("length", "Float", 0, {}, this, undefined),
        crew: new SelectionWrapper("crew", "String", 0, {}, this, undefined),
        passengers: new SelectionWrapper(
            "passengers",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        maxAtmospheringSpeed: new SelectionWrapper(
            "maxAtmospheringSpeed",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        hyperdriveRating: new SelectionWrapper(
            "hyperdriveRating",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        MGLT: new SelectionWrapper("MGLT", "Int", 0, {}, this, undefined),
        cargoCapacity: new SelectionWrapper(
            "cargoCapacity",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        consumables: new SelectionWrapper(
            "consumables",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        pilotConnection: (args: StarshipArrayPilotConnectionArgs) =>
            StarshipPilotsConnectionSelection.bind({
                collector: this,
                fieldName: "pilotConnection",
                args,
                argsMeta: StarshipArrayPilotConnectionArgsMeta,
            }),
        filmConnection: (args: StarshipArrayFilmConnectionArgs) =>
            StarshipFilmsConnectionSelection.bind({
                collector: this,
                fieldName: "filmConnection",
                args,
                argsMeta: StarshipArrayFilmConnectionArgsMeta,
            }),
        created: new SelectionWrapper(
            "created",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        edited: new SelectionWrapper(
            "edited",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),

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
                makeStarshipArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeStarshipArraySelectionInput>
            >,
    } as const;
}
export const StarshipArraySelection = makeSLFN(
    makeStarshipArraySelectionInput,
    "StarshipArraySelection",
    "Starship",
    1,
);

type ReturnTypeFromStarshipFilmsConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipFilmsEdgeArraySelectionInput>,
            "StarshipFilmsEdgeArraySelection",
            "StarshipFilmsEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    films: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmArraySelectionInput>,
            "FilmArraySelection",
            "Film",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStarshipFilmsConnectionSelectionInput>
    >;
};

export function makeStarshipFilmsConnectionSelectionInput(
    this: any,
): ReturnTypeFromStarshipFilmsConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: StarshipFilmsEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        films: FilmArraySelection.bind({ collector: this, fieldName: "films" }),

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
                makeStarshipFilmsConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeStarshipFilmsConnectionSelectionInput>
            >,
    } as const;
}
export const StarshipFilmsConnectionSelection = makeSLFN(
    makeStarshipFilmsConnectionSelectionInput,
    "StarshipFilmsConnectionSelection",
    "StarshipFilmsConnection",
    0,
);

type ReturnTypeFromStarshipFilmsEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSelectionInput>,
            "FilmSelection",
            "Film",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStarshipFilmsEdgeArraySelectionInput>
    >;
};

export function makeStarshipFilmsEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromStarshipFilmsEdgeArraySelection {
    return {
        node: FilmSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeStarshipFilmsEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeStarshipFilmsEdgeArraySelectionInput>
            >,
    } as const;
}
export const StarshipFilmsEdgeArraySelection = makeSLFN(
    makeStarshipFilmsEdgeArraySelectionInput,
    "StarshipFilmsEdgeArraySelection",
    "StarshipFilmsEdge",
    1,
);

type ReturnTypeFromPersonVehiclesConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonVehiclesEdgeArraySelectionInput>,
            "PersonVehiclesEdgeArraySelection",
            "PersonVehiclesEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    vehicles: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehicleArraySelectionInput>,
            "VehicleArraySelection",
            "Vehicle",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePersonVehiclesConnectionSelectionInput>
    >;
};

export function makePersonVehiclesConnectionSelectionInput(
    this: any,
): ReturnTypeFromPersonVehiclesConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: PersonVehiclesEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        vehicles: VehicleArraySelection.bind({
            collector: this,
            fieldName: "vehicles",
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
                makePersonVehiclesConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePersonVehiclesConnectionSelectionInput>
            >,
    } as const;
}
export const PersonVehiclesConnectionSelection = makeSLFN(
    makePersonVehiclesConnectionSelectionInput,
    "PersonVehiclesConnectionSelection",
    "PersonVehiclesConnection",
    0,
);

type ReturnTypeFromPersonVehiclesEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehicleSelectionInput>,
            "VehicleSelection",
            "Vehicle",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePersonVehiclesEdgeArraySelectionInput>
    >;
};

export function makePersonVehiclesEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromPersonVehiclesEdgeArraySelection {
    return {
        node: VehicleSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makePersonVehiclesEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePersonVehiclesEdgeArraySelectionInput>
            >,
    } as const;
}
export const PersonVehiclesEdgeArraySelection = makeSLFN(
    makePersonVehiclesEdgeArraySelectionInput,
    "PersonVehiclesEdgeArraySelection",
    "PersonVehiclesEdge",
    1,
);

type ReturnTypeFromVehicleSelection = {
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    model: SelectionWrapperImpl<"model", "String", 0, {}, undefined>;
    vehicleClass: SelectionWrapperImpl<
        "vehicleClass",
        "String",
        0,
        {},
        undefined
    >;
    manufacturers: SelectionWrapperImpl<
        "manufacturers",
        "String",
        1,
        {},
        undefined
    >;
    costInCredits: SelectionWrapperImpl<
        "costInCredits",
        "Float",
        0,
        {},
        undefined
    >;
    length: SelectionWrapperImpl<"length", "Float", 0, {}, undefined>;
    crew: SelectionWrapperImpl<"crew", "String", 0, {}, undefined>;
    passengers: SelectionWrapperImpl<"passengers", "String", 0, {}, undefined>;
    maxAtmospheringSpeed: SelectionWrapperImpl<
        "maxAtmospheringSpeed",
        "Int",
        0,
        {},
        undefined
    >;
    cargoCapacity: SelectionWrapperImpl<
        "cargoCapacity",
        "Float",
        0,
        {},
        undefined
    >;
    consumables: SelectionWrapperImpl<
        "consumables",
        "String",
        0,
        {},
        undefined
    >;
    pilotConnection: (
        args: VehiclePilotConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehiclePilotsConnectionSelectionInput>,
            "VehiclePilotsConnectionSelection",
            "VehiclePilotsConnection",
            0
        >
    >;
    filmConnection: (
        args: VehicleFilmConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehicleFilmsConnectionSelectionInput>,
            "VehicleFilmsConnectionSelection",
            "VehicleFilmsConnection",
            0
        >
    >;
    created: SelectionWrapperImpl<"created", "String", 0, {}, undefined>;
    edited: SelectionWrapperImpl<"edited", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeVehicleSelectionInput>
    >;
};

export function makeVehicleSelectionInput(
    this: any,
): ReturnTypeFromVehicleSelection {
    return {
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        model: new SelectionWrapper("model", "String", 0, {}, this, undefined),
        vehicleClass: new SelectionWrapper(
            "vehicleClass",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        manufacturers: new SelectionWrapper(
            "manufacturers",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        costInCredits: new SelectionWrapper(
            "costInCredits",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        length: new SelectionWrapper("length", "Float", 0, {}, this, undefined),
        crew: new SelectionWrapper("crew", "String", 0, {}, this, undefined),
        passengers: new SelectionWrapper(
            "passengers",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        maxAtmospheringSpeed: new SelectionWrapper(
            "maxAtmospheringSpeed",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        cargoCapacity: new SelectionWrapper(
            "cargoCapacity",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        consumables: new SelectionWrapper(
            "consumables",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        pilotConnection: (args: VehiclePilotConnectionArgs) =>
            VehiclePilotsConnectionSelection.bind({
                collector: this,
                fieldName: "pilotConnection",
                args,
                argsMeta: VehiclePilotConnectionArgsMeta,
            }),
        filmConnection: (args: VehicleFilmConnectionArgs) =>
            VehicleFilmsConnectionSelection.bind({
                collector: this,
                fieldName: "filmConnection",
                args,
                argsMeta: VehicleFilmConnectionArgsMeta,
            }),
        created: new SelectionWrapper(
            "created",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        edited: new SelectionWrapper(
            "edited",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),

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
                makeVehicleSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeVehicleSelectionInput>
            >,
    } as const;
}
export const VehicleSelection = makeSLFN(
    makeVehicleSelectionInput,
    "VehicleSelection",
    "Vehicle",
    0,
);

type ReturnTypeFromVehiclePilotsConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehiclePilotsEdgeArraySelectionInput>,
            "VehiclePilotsEdgeArraySelection",
            "VehiclePilotsEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    pilots: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonArraySelectionInput>,
            "PersonArraySelection",
            "Person",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeVehiclePilotsConnectionSelectionInput>
    >;
};

export function makeVehiclePilotsConnectionSelectionInput(
    this: any,
): ReturnTypeFromVehiclePilotsConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: VehiclePilotsEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        pilots: PersonArraySelection.bind({
            collector: this,
            fieldName: "pilots",
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
                makeVehiclePilotsConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeVehiclePilotsConnectionSelectionInput>
            >,
    } as const;
}
export const VehiclePilotsConnectionSelection = makeSLFN(
    makeVehiclePilotsConnectionSelectionInput,
    "VehiclePilotsConnectionSelection",
    "VehiclePilotsConnection",
    0,
);

type ReturnTypeFromVehiclePilotsEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonSelectionInput>,
            "PersonSelection",
            "Person",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeVehiclePilotsEdgeArraySelectionInput>
    >;
};

export function makeVehiclePilotsEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromVehiclePilotsEdgeArraySelection {
    return {
        node: PersonSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeVehiclePilotsEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeVehiclePilotsEdgeArraySelectionInput>
            >,
    } as const;
}
export const VehiclePilotsEdgeArraySelection = makeSLFN(
    makeVehiclePilotsEdgeArraySelectionInput,
    "VehiclePilotsEdgeArraySelection",
    "VehiclePilotsEdge",
    1,
);

type ReturnTypeFromVehicleFilmsConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehicleFilmsEdgeArraySelectionInput>,
            "VehicleFilmsEdgeArraySelection",
            "VehicleFilmsEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    films: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmArraySelectionInput>,
            "FilmArraySelection",
            "Film",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeVehicleFilmsConnectionSelectionInput>
    >;
};

export function makeVehicleFilmsConnectionSelectionInput(
    this: any,
): ReturnTypeFromVehicleFilmsConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: VehicleFilmsEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        films: FilmArraySelection.bind({ collector: this, fieldName: "films" }),

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
                makeVehicleFilmsConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeVehicleFilmsConnectionSelectionInput>
            >,
    } as const;
}
export const VehicleFilmsConnectionSelection = makeSLFN(
    makeVehicleFilmsConnectionSelectionInput,
    "VehicleFilmsConnectionSelection",
    "VehicleFilmsConnection",
    0,
);

type ReturnTypeFromVehicleFilmsEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSelectionInput>,
            "FilmSelection",
            "Film",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeVehicleFilmsEdgeArraySelectionInput>
    >;
};

export function makeVehicleFilmsEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromVehicleFilmsEdgeArraySelection {
    return {
        node: FilmSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeVehicleFilmsEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeVehicleFilmsEdgeArraySelectionInput>
            >,
    } as const;
}
export const VehicleFilmsEdgeArraySelection = makeSLFN(
    makeVehicleFilmsEdgeArraySelectionInput,
    "VehicleFilmsEdgeArraySelection",
    "VehicleFilmsEdge",
    1,
);

type ReturnTypeFromVehicleArraySelection = {
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    model: SelectionWrapperImpl<"model", "String", 0, {}, undefined>;
    vehicleClass: SelectionWrapperImpl<
        "vehicleClass",
        "String",
        0,
        {},
        undefined
    >;
    manufacturers: SelectionWrapperImpl<
        "manufacturers",
        "String",
        1,
        {},
        undefined
    >;
    costInCredits: SelectionWrapperImpl<
        "costInCredits",
        "Float",
        0,
        {},
        undefined
    >;
    length: SelectionWrapperImpl<"length", "Float", 0, {}, undefined>;
    crew: SelectionWrapperImpl<"crew", "String", 0, {}, undefined>;
    passengers: SelectionWrapperImpl<"passengers", "String", 0, {}, undefined>;
    maxAtmospheringSpeed: SelectionWrapperImpl<
        "maxAtmospheringSpeed",
        "Int",
        0,
        {},
        undefined
    >;
    cargoCapacity: SelectionWrapperImpl<
        "cargoCapacity",
        "Float",
        0,
        {},
        undefined
    >;
    consumables: SelectionWrapperImpl<
        "consumables",
        "String",
        0,
        {},
        undefined
    >;
    pilotConnection: (
        args: VehicleArrayPilotConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehiclePilotsConnectionSelectionInput>,
            "VehiclePilotsConnectionSelection",
            "VehiclePilotsConnection",
            0
        >
    >;
    filmConnection: (
        args: VehicleArrayFilmConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehicleFilmsConnectionSelectionInput>,
            "VehicleFilmsConnectionSelection",
            "VehicleFilmsConnection",
            0
        >
    >;
    created: SelectionWrapperImpl<"created", "String", 0, {}, undefined>;
    edited: SelectionWrapperImpl<"edited", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeVehicleArraySelectionInput>
    >;
};

export function makeVehicleArraySelectionInput(
    this: any,
): ReturnTypeFromVehicleArraySelection {
    return {
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        model: new SelectionWrapper("model", "String", 0, {}, this, undefined),
        vehicleClass: new SelectionWrapper(
            "vehicleClass",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        manufacturers: new SelectionWrapper(
            "manufacturers",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        costInCredits: new SelectionWrapper(
            "costInCredits",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        length: new SelectionWrapper("length", "Float", 0, {}, this, undefined),
        crew: new SelectionWrapper("crew", "String", 0, {}, this, undefined),
        passengers: new SelectionWrapper(
            "passengers",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        maxAtmospheringSpeed: new SelectionWrapper(
            "maxAtmospheringSpeed",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        cargoCapacity: new SelectionWrapper(
            "cargoCapacity",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        consumables: new SelectionWrapper(
            "consumables",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        pilotConnection: (args: VehicleArrayPilotConnectionArgs) =>
            VehiclePilotsConnectionSelection.bind({
                collector: this,
                fieldName: "pilotConnection",
                args,
                argsMeta: VehicleArrayPilotConnectionArgsMeta,
            }),
        filmConnection: (args: VehicleArrayFilmConnectionArgs) =>
            VehicleFilmsConnectionSelection.bind({
                collector: this,
                fieldName: "filmConnection",
                args,
                argsMeta: VehicleArrayFilmConnectionArgsMeta,
            }),
        created: new SelectionWrapper(
            "created",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        edited: new SelectionWrapper(
            "edited",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),

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
                makeVehicleArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeVehicleArraySelectionInput>
            >,
    } as const;
}
export const VehicleArraySelection = makeSLFN(
    makeVehicleArraySelectionInput,
    "VehicleArraySelection",
    "Vehicle",
    1,
);

type ReturnTypeFromFilmVehiclesConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmVehiclesEdgeArraySelectionInput>,
            "FilmVehiclesEdgeArraySelection",
            "FilmVehiclesEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    vehicles: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehicleArraySelectionInput>,
            "VehicleArraySelection",
            "Vehicle",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmVehiclesConnectionSelectionInput>
    >;
};

export function makeFilmVehiclesConnectionSelectionInput(
    this: any,
): ReturnTypeFromFilmVehiclesConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: FilmVehiclesEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        vehicles: VehicleArraySelection.bind({
            collector: this,
            fieldName: "vehicles",
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
                makeFilmVehiclesConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmVehiclesConnectionSelectionInput>
            >,
    } as const;
}
export const FilmVehiclesConnectionSelection = makeSLFN(
    makeFilmVehiclesConnectionSelectionInput,
    "FilmVehiclesConnectionSelection",
    "FilmVehiclesConnection",
    0,
);

type ReturnTypeFromFilmVehiclesEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehicleSelectionInput>,
            "VehicleSelection",
            "Vehicle",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmVehiclesEdgeArraySelectionInput>
    >;
};

export function makeFilmVehiclesEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromFilmVehiclesEdgeArraySelection {
    return {
        node: VehicleSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeFilmVehiclesEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmVehiclesEdgeArraySelectionInput>
            >,
    } as const;
}
export const FilmVehiclesEdgeArraySelection = makeSLFN(
    makeFilmVehiclesEdgeArraySelectionInput,
    "FilmVehiclesEdgeArraySelection",
    "FilmVehiclesEdge",
    1,
);

type ReturnTypeFromFilmCharactersConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmCharactersEdgeArraySelectionInput>,
            "FilmCharactersEdgeArraySelection",
            "FilmCharactersEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    characters: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonArraySelectionInput>,
            "PersonArraySelection",
            "Person",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmCharactersConnectionSelectionInput>
    >;
};

export function makeFilmCharactersConnectionSelectionInput(
    this: any,
): ReturnTypeFromFilmCharactersConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: FilmCharactersEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        characters: PersonArraySelection.bind({
            collector: this,
            fieldName: "characters",
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
                makeFilmCharactersConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmCharactersConnectionSelectionInput>
            >,
    } as const;
}
export const FilmCharactersConnectionSelection = makeSLFN(
    makeFilmCharactersConnectionSelectionInput,
    "FilmCharactersConnectionSelection",
    "FilmCharactersConnection",
    0,
);

type ReturnTypeFromFilmCharactersEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonSelectionInput>,
            "PersonSelection",
            "Person",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmCharactersEdgeArraySelectionInput>
    >;
};

export function makeFilmCharactersEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromFilmCharactersEdgeArraySelection {
    return {
        node: PersonSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeFilmCharactersEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmCharactersEdgeArraySelectionInput>
            >,
    } as const;
}
export const FilmCharactersEdgeArraySelection = makeSLFN(
    makeFilmCharactersEdgeArraySelectionInput,
    "FilmCharactersEdgeArraySelection",
    "FilmCharactersEdge",
    1,
);

type ReturnTypeFromFilmPlanetsConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmPlanetsEdgeArraySelectionInput>,
            "FilmPlanetsEdgeArraySelection",
            "FilmPlanetsEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    planets: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetArraySelectionInput>,
            "PlanetArraySelection",
            "Planet",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmPlanetsConnectionSelectionInput>
    >;
};

export function makeFilmPlanetsConnectionSelectionInput(
    this: any,
): ReturnTypeFromFilmPlanetsConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: FilmPlanetsEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        planets: PlanetArraySelection.bind({
            collector: this,
            fieldName: "planets",
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
                makeFilmPlanetsConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmPlanetsConnectionSelectionInput>
            >,
    } as const;
}
export const FilmPlanetsConnectionSelection = makeSLFN(
    makeFilmPlanetsConnectionSelectionInput,
    "FilmPlanetsConnectionSelection",
    "FilmPlanetsConnection",
    0,
);

type ReturnTypeFromFilmPlanetsEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetSelectionInput>,
            "PlanetSelection",
            "Planet",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmPlanetsEdgeArraySelectionInput>
    >;
};

export function makeFilmPlanetsEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromFilmPlanetsEdgeArraySelection {
    return {
        node: PlanetSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeFilmPlanetsEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmPlanetsEdgeArraySelectionInput>
            >,
    } as const;
}
export const FilmPlanetsEdgeArraySelection = makeSLFN(
    makeFilmPlanetsEdgeArraySelectionInput,
    "FilmPlanetsEdgeArraySelection",
    "FilmPlanetsEdge",
    1,
);

type ReturnTypeFromPlanetArraySelection = {
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    diameter: SelectionWrapperImpl<"diameter", "Int", 0, {}, undefined>;
    rotationPeriod: SelectionWrapperImpl<
        "rotationPeriod",
        "Int",
        0,
        {},
        undefined
    >;
    orbitalPeriod: SelectionWrapperImpl<
        "orbitalPeriod",
        "Int",
        0,
        {},
        undefined
    >;
    gravity: SelectionWrapperImpl<"gravity", "String", 0, {}, undefined>;
    population: SelectionWrapperImpl<"population", "Float", 0, {}, undefined>;
    climates: SelectionWrapperImpl<"climates", "String", 1, {}, undefined>;
    terrains: SelectionWrapperImpl<"terrains", "String", 1, {}, undefined>;
    surfaceWater: SelectionWrapperImpl<
        "surfaceWater",
        "Float",
        0,
        {},
        undefined
    >;
    residentConnection: (
        args: PlanetArrayResidentConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetResidentsConnectionSelectionInput>,
            "PlanetResidentsConnectionSelection",
            "PlanetResidentsConnection",
            0
        >
    >;
    filmConnection: (
        args: PlanetArrayFilmConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetFilmsConnectionSelectionInput>,
            "PlanetFilmsConnectionSelection",
            "PlanetFilmsConnection",
            0
        >
    >;
    created: SelectionWrapperImpl<"created", "String", 0, {}, undefined>;
    edited: SelectionWrapperImpl<"edited", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePlanetArraySelectionInput>
    >;
};

export function makePlanetArraySelectionInput(
    this: any,
): ReturnTypeFromPlanetArraySelection {
    return {
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        diameter: new SelectionWrapper(
            "diameter",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        rotationPeriod: new SelectionWrapper(
            "rotationPeriod",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        orbitalPeriod: new SelectionWrapper(
            "orbitalPeriod",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        gravity: new SelectionWrapper(
            "gravity",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        population: new SelectionWrapper(
            "population",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        climates: new SelectionWrapper(
            "climates",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        terrains: new SelectionWrapper(
            "terrains",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        surfaceWater: new SelectionWrapper(
            "surfaceWater",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        residentConnection: (args: PlanetArrayResidentConnectionArgs) =>
            PlanetResidentsConnectionSelection.bind({
                collector: this,
                fieldName: "residentConnection",
                args,
                argsMeta: PlanetArrayResidentConnectionArgsMeta,
            }),
        filmConnection: (args: PlanetArrayFilmConnectionArgs) =>
            PlanetFilmsConnectionSelection.bind({
                collector: this,
                fieldName: "filmConnection",
                args,
                argsMeta: PlanetArrayFilmConnectionArgsMeta,
            }),
        created: new SelectionWrapper(
            "created",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        edited: new SelectionWrapper(
            "edited",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),

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
                makePlanetArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePlanetArraySelectionInput>
            >,
    } as const;
}
export const PlanetArraySelection = makeSLFN(
    makePlanetArraySelectionInput,
    "PlanetArraySelection",
    "Planet",
    1,
);

type ReturnTypeFromPlanetFilmsConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetFilmsEdgeArraySelectionInput>,
            "PlanetFilmsEdgeArraySelection",
            "PlanetFilmsEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    films: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmArraySelectionInput>,
            "FilmArraySelection",
            "Film",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePlanetFilmsConnectionSelectionInput>
    >;
};

export function makePlanetFilmsConnectionSelectionInput(
    this: any,
): ReturnTypeFromPlanetFilmsConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: PlanetFilmsEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        films: FilmArraySelection.bind({ collector: this, fieldName: "films" }),

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
                makePlanetFilmsConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePlanetFilmsConnectionSelectionInput>
            >,
    } as const;
}
export const PlanetFilmsConnectionSelection = makeSLFN(
    makePlanetFilmsConnectionSelectionInput,
    "PlanetFilmsConnectionSelection",
    "PlanetFilmsConnection",
    0,
);

type ReturnTypeFromPlanetFilmsEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSelectionInput>,
            "FilmSelection",
            "Film",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePlanetFilmsEdgeArraySelectionInput>
    >;
};

export function makePlanetFilmsEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromPlanetFilmsEdgeArraySelection {
    return {
        node: FilmSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makePlanetFilmsEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePlanetFilmsEdgeArraySelectionInput>
            >,
    } as const;
}
export const PlanetFilmsEdgeArraySelection = makeSLFN(
    makePlanetFilmsEdgeArraySelectionInput,
    "PlanetFilmsEdgeArraySelection",
    "PlanetFilmsEdge",
    1,
);

type ReturnTypeFromSpeciesPeopleConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesPeopleEdgeArraySelectionInput>,
            "SpeciesPeopleEdgeArraySelection",
            "SpeciesPeopleEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    people: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonArraySelectionInput>,
            "PersonArraySelection",
            "Person",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSpeciesPeopleConnectionSelectionInput>
    >;
};

export function makeSpeciesPeopleConnectionSelectionInput(
    this: any,
): ReturnTypeFromSpeciesPeopleConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: SpeciesPeopleEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        people: PersonArraySelection.bind({
            collector: this,
            fieldName: "people",
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
                makeSpeciesPeopleConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeSpeciesPeopleConnectionSelectionInput>
            >,
    } as const;
}
export const SpeciesPeopleConnectionSelection = makeSLFN(
    makeSpeciesPeopleConnectionSelectionInput,
    "SpeciesPeopleConnectionSelection",
    "SpeciesPeopleConnection",
    0,
);

type ReturnTypeFromSpeciesPeopleEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonSelectionInput>,
            "PersonSelection",
            "Person",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSpeciesPeopleEdgeArraySelectionInput>
    >;
};

export function makeSpeciesPeopleEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromSpeciesPeopleEdgeArraySelection {
    return {
        node: PersonSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeSpeciesPeopleEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeSpeciesPeopleEdgeArraySelectionInput>
            >,
    } as const;
}
export const SpeciesPeopleEdgeArraySelection = makeSLFN(
    makeSpeciesPeopleEdgeArraySelectionInput,
    "SpeciesPeopleEdgeArraySelection",
    "SpeciesPeopleEdge",
    1,
);

type ReturnTypeFromSpeciesFilmsConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesFilmsEdgeArraySelectionInput>,
            "SpeciesFilmsEdgeArraySelection",
            "SpeciesFilmsEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    films: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmArraySelectionInput>,
            "FilmArraySelection",
            "Film",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSpeciesFilmsConnectionSelectionInput>
    >;
};

export function makeSpeciesFilmsConnectionSelectionInput(
    this: any,
): ReturnTypeFromSpeciesFilmsConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: SpeciesFilmsEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        films: FilmArraySelection.bind({ collector: this, fieldName: "films" }),

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
                makeSpeciesFilmsConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeSpeciesFilmsConnectionSelectionInput>
            >,
    } as const;
}
export const SpeciesFilmsConnectionSelection = makeSLFN(
    makeSpeciesFilmsConnectionSelectionInput,
    "SpeciesFilmsConnectionSelection",
    "SpeciesFilmsConnection",
    0,
);

type ReturnTypeFromSpeciesFilmsEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSelectionInput>,
            "FilmSelection",
            "Film",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSpeciesFilmsEdgeArraySelectionInput>
    >;
};

export function makeSpeciesFilmsEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromSpeciesFilmsEdgeArraySelection {
    return {
        node: FilmSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeSpeciesFilmsEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeSpeciesFilmsEdgeArraySelectionInput>
            >,
    } as const;
}
export const SpeciesFilmsEdgeArraySelection = makeSLFN(
    makeSpeciesFilmsEdgeArraySelectionInput,
    "SpeciesFilmsEdgeArraySelection",
    "SpeciesFilmsEdge",
    1,
);

type ReturnTypeFromSpeciesArraySelection = {
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    classification: SelectionWrapperImpl<
        "classification",
        "String",
        0,
        {},
        undefined
    >;
    designation: SelectionWrapperImpl<
        "designation",
        "String",
        0,
        {},
        undefined
    >;
    averageHeight: SelectionWrapperImpl<
        "averageHeight",
        "Float",
        0,
        {},
        undefined
    >;
    averageLifespan: SelectionWrapperImpl<
        "averageLifespan",
        "Int",
        0,
        {},
        undefined
    >;
    eyeColors: SelectionWrapperImpl<"eyeColors", "String", 1, {}, undefined>;
    hairColors: SelectionWrapperImpl<"hairColors", "String", 1, {}, undefined>;
    skinColors: SelectionWrapperImpl<"skinColors", "String", 1, {}, undefined>;
    language: SelectionWrapperImpl<"language", "String", 0, {}, undefined>;
    homeworld: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetSelectionInput>,
            "PlanetSelection",
            "Planet",
            0
        >
    >;
    personConnection: (
        args: SpeciesArrayPersonConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesPeopleConnectionSelectionInput>,
            "SpeciesPeopleConnectionSelection",
            "SpeciesPeopleConnection",
            0
        >
    >;
    filmConnection: (
        args: SpeciesArrayFilmConnectionArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesFilmsConnectionSelectionInput>,
            "SpeciesFilmsConnectionSelection",
            "SpeciesFilmsConnection",
            0
        >
    >;
    created: SelectionWrapperImpl<"created", "String", 0, {}, undefined>;
    edited: SelectionWrapperImpl<"edited", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSpeciesArraySelectionInput>
    >;
};

export function makeSpeciesArraySelectionInput(
    this: any,
): ReturnTypeFromSpeciesArraySelection {
    return {
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        classification: new SelectionWrapper(
            "classification",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        designation: new SelectionWrapper(
            "designation",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        averageHeight: new SelectionWrapper(
            "averageHeight",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        averageLifespan: new SelectionWrapper(
            "averageLifespan",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        eyeColors: new SelectionWrapper(
            "eyeColors",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        hairColors: new SelectionWrapper(
            "hairColors",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        skinColors: new SelectionWrapper(
            "skinColors",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        language: new SelectionWrapper(
            "language",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        homeworld: PlanetSelection.bind({
            collector: this,
            fieldName: "homeworld",
        }),
        personConnection: (args: SpeciesArrayPersonConnectionArgs) =>
            SpeciesPeopleConnectionSelection.bind({
                collector: this,
                fieldName: "personConnection",
                args,
                argsMeta: SpeciesArrayPersonConnectionArgsMeta,
            }),
        filmConnection: (args: SpeciesArrayFilmConnectionArgs) =>
            SpeciesFilmsConnectionSelection.bind({
                collector: this,
                fieldName: "filmConnection",
                args,
                argsMeta: SpeciesArrayFilmConnectionArgsMeta,
            }),
        created: new SelectionWrapper(
            "created",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        edited: new SelectionWrapper(
            "edited",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),

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
                makeSpeciesArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeSpeciesArraySelectionInput>
            >,
    } as const;
}
export const SpeciesArraySelection = makeSLFN(
    makeSpeciesArraySelectionInput,
    "SpeciesArraySelection",
    "Species",
    1,
);

type ReturnTypeFromFilmsConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmsEdgeArraySelectionInput>,
            "FilmsEdgeArraySelection",
            "FilmsEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    films: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmArraySelectionInput>,
            "FilmArraySelection",
            "Film",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmsConnectionSelectionInput>
    >;
};

export function makeFilmsConnectionSelectionInput(
    this: any,
): ReturnTypeFromFilmsConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: FilmsEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        films: FilmArraySelection.bind({ collector: this, fieldName: "films" }),

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
                makeFilmsConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmsConnectionSelectionInput>
            >,
    } as const;
}
export const FilmsConnectionSelection = makeSLFN(
    makeFilmsConnectionSelectionInput,
    "FilmsConnectionSelection",
    "FilmsConnection",
    0,
);

type ReturnTypeFromPeopleEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonSelectionInput>,
            "PersonSelection",
            "Person",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePeopleEdgeArraySelectionInput>
    >;
};

export function makePeopleEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromPeopleEdgeArraySelection {
    return {
        node: PersonSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makePeopleEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePeopleEdgeArraySelectionInput>
            >,
    } as const;
}
export const PeopleEdgeArraySelection = makeSLFN(
    makePeopleEdgeArraySelectionInput,
    "PeopleEdgeArraySelection",
    "PeopleEdge",
    1,
);

type ReturnTypeFromPeopleConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePeopleEdgeArraySelectionInput>,
            "PeopleEdgeArraySelection",
            "PeopleEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    people: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonArraySelectionInput>,
            "PersonArraySelection",
            "Person",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePeopleConnectionSelectionInput>
    >;
};

export function makePeopleConnectionSelectionInput(
    this: any,
): ReturnTypeFromPeopleConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: PeopleEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        people: PersonArraySelection.bind({
            collector: this,
            fieldName: "people",
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
                makePeopleConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePeopleConnectionSelectionInput>
            >,
    } as const;
}
export const PeopleConnectionSelection = makeSLFN(
    makePeopleConnectionSelectionInput,
    "PeopleConnectionSelection",
    "PeopleConnection",
    0,
);

type ReturnTypeFromPlanetsEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetSelectionInput>,
            "PlanetSelection",
            "Planet",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePlanetsEdgeArraySelectionInput>
    >;
};

export function makePlanetsEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromPlanetsEdgeArraySelection {
    return {
        node: PlanetSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makePlanetsEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePlanetsEdgeArraySelectionInput>
            >,
    } as const;
}
export const PlanetsEdgeArraySelection = makeSLFN(
    makePlanetsEdgeArraySelectionInput,
    "PlanetsEdgeArraySelection",
    "PlanetsEdge",
    1,
);

type ReturnTypeFromPlanetsConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetsEdgeArraySelectionInput>,
            "PlanetsEdgeArraySelection",
            "PlanetsEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    planets: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetArraySelectionInput>,
            "PlanetArraySelection",
            "Planet",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePlanetsConnectionSelectionInput>
    >;
};

export function makePlanetsConnectionSelectionInput(
    this: any,
): ReturnTypeFromPlanetsConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: PlanetsEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        planets: PlanetArraySelection.bind({
            collector: this,
            fieldName: "planets",
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
                makePlanetsConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePlanetsConnectionSelectionInput>
            >,
    } as const;
}
export const PlanetsConnectionSelection = makeSLFN(
    makePlanetsConnectionSelectionInput,
    "PlanetsConnectionSelection",
    "PlanetsConnection",
    0,
);

type ReturnTypeFromSpeciesEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesSelectionInput>,
            "SpeciesSelection",
            "Species",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSpeciesEdgeArraySelectionInput>
    >;
};

export function makeSpeciesEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromSpeciesEdgeArraySelection {
    return {
        node: SpeciesSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeSpeciesEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeSpeciesEdgeArraySelectionInput>
            >,
    } as const;
}
export const SpeciesEdgeArraySelection = makeSLFN(
    makeSpeciesEdgeArraySelectionInput,
    "SpeciesEdgeArraySelection",
    "SpeciesEdge",
    1,
);

type ReturnTypeFromSpeciesConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesEdgeArraySelectionInput>,
            "SpeciesEdgeArraySelection",
            "SpeciesEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    species: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesArraySelectionInput>,
            "SpeciesArraySelection",
            "Species",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSpeciesConnectionSelectionInput>
    >;
};

export function makeSpeciesConnectionSelectionInput(
    this: any,
): ReturnTypeFromSpeciesConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: SpeciesEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        species: SpeciesArraySelection.bind({
            collector: this,
            fieldName: "species",
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
                makeSpeciesConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeSpeciesConnectionSelectionInput>
            >,
    } as const;
}
export const SpeciesConnectionSelection = makeSLFN(
    makeSpeciesConnectionSelectionInput,
    "SpeciesConnectionSelection",
    "SpeciesConnection",
    0,
);

type ReturnTypeFromStarshipsEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipSelectionInput>,
            "StarshipSelection",
            "Starship",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStarshipsEdgeArraySelectionInput>
    >;
};

export function makeStarshipsEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromStarshipsEdgeArraySelection {
    return {
        node: StarshipSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeStarshipsEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeStarshipsEdgeArraySelectionInput>
            >,
    } as const;
}
export const StarshipsEdgeArraySelection = makeSLFN(
    makeStarshipsEdgeArraySelectionInput,
    "StarshipsEdgeArraySelection",
    "StarshipsEdge",
    1,
);

type ReturnTypeFromStarshipsConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipsEdgeArraySelectionInput>,
            "StarshipsEdgeArraySelection",
            "StarshipsEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    starships: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipArraySelectionInput>,
            "StarshipArraySelection",
            "Starship",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStarshipsConnectionSelectionInput>
    >;
};

export function makeStarshipsConnectionSelectionInput(
    this: any,
): ReturnTypeFromStarshipsConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: StarshipsEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        starships: StarshipArraySelection.bind({
            collector: this,
            fieldName: "starships",
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
                makeStarshipsConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeStarshipsConnectionSelectionInput>
            >,
    } as const;
}
export const StarshipsConnectionSelection = makeSLFN(
    makeStarshipsConnectionSelectionInput,
    "StarshipsConnectionSelection",
    "StarshipsConnection",
    0,
);

type ReturnTypeFromVehiclesEdgeArraySelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehicleSelectionInput>,
            "VehicleSelection",
            "Vehicle",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeVehiclesEdgeArraySelectionInput>
    >;
};

export function makeVehiclesEdgeArraySelectionInput(
    this: any,
): ReturnTypeFromVehiclesEdgeArraySelection {
    return {
        node: VehicleSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeVehiclesEdgeArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeVehiclesEdgeArraySelectionInput>
            >,
    } as const;
}
export const VehiclesEdgeArraySelection = makeSLFN(
    makeVehiclesEdgeArraySelectionInput,
    "VehiclesEdgeArraySelection",
    "VehiclesEdge",
    1,
);

type ReturnTypeFromVehiclesConnectionSelection = {
    pageInfo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePageInfoNotNullSelectionInput>,
            "PageInfoNotNullSelection",
            "PageInfo",
            0
        >
    >;
    edges: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehiclesEdgeArraySelectionInput>,
            "VehiclesEdgeArraySelection",
            "VehiclesEdge",
            1
        >
    >;
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
    vehicles: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehicleArraySelectionInput>,
            "VehicleArraySelection",
            "Vehicle",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeVehiclesConnectionSelectionInput>
    >;
};

export function makeVehiclesConnectionSelectionInput(
    this: any,
): ReturnTypeFromVehiclesConnectionSelection {
    return {
        pageInfo: PageInfoNotNullSelection.bind({
            collector: this,
            fieldName: "pageInfo",
        }),
        edges: VehiclesEdgeArraySelection.bind({
            collector: this,
            fieldName: "edges",
        }),
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        vehicles: VehicleArraySelection.bind({
            collector: this,
            fieldName: "vehicles",
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
                makeVehiclesConnectionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeVehiclesConnectionSelectionInput>
            >,
    } as const;
}
export const VehiclesConnectionSelection = makeSLFN(
    makeVehiclesConnectionSelectionInput,
    "VehiclesConnectionSelection",
    "VehiclesConnection",
    0,
);

type ReturnTypeFromNodeSelection = {
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeNodeSelectionInput>
    >;
};

export function makeNodeSelectionInput(this: any): ReturnTypeFromNodeSelection {
    return {
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),

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
                makeNodeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeNodeSelectionInput>>,
    } as const;
}
export const NodeSelection = makeSLFN(
    makeNodeSelectionInput,
    "NodeSelection",
    "Node",
    0,
);

type ReturnTypeFromRootSelection = {
    allFilms: (args: RootAllFilmsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmsConnectionSelectionInput>,
            "FilmsConnectionSelection",
            "FilmsConnection",
            0,
            {
                $lazy: (args: RootAllFilmsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    film: (args: RootFilmArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSelectionInput>,
            "FilmSelection",
            "Film",
            0,
            {
                $lazy: (args: RootFilmArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    allPeople: (args: RootAllPeopleArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePeopleConnectionSelectionInput>,
            "PeopleConnectionSelection",
            "PeopleConnection",
            0,
            {
                $lazy: (args: RootAllPeopleArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    person: (args: RootPersonArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonSelectionInput>,
            "PersonSelection",
            "Person",
            0,
            {
                $lazy: (args: RootPersonArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    allPlanets: (args: RootAllPlanetsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetsConnectionSelectionInput>,
            "PlanetsConnectionSelection",
            "PlanetsConnection",
            0,
            {
                $lazy: (args: RootAllPlanetsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    planet: (args: RootPlanetArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetSelectionInput>,
            "PlanetSelection",
            "Planet",
            0,
            {
                $lazy: (args: RootPlanetArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    allSpecies: (args: RootAllSpeciesArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesConnectionSelectionInput>,
            "SpeciesConnectionSelection",
            "SpeciesConnection",
            0,
            {
                $lazy: (args: RootAllSpeciesArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    species: (args: RootSpeciesArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesSelectionInput>,
            "SpeciesSelection",
            "Species",
            0,
            {
                $lazy: (args: RootSpeciesArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    allStarships: (args: RootAllStarshipsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipsConnectionSelectionInput>,
            "StarshipsConnectionSelection",
            "StarshipsConnection",
            0,
            {
                $lazy: (args: RootAllStarshipsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    starship: (args: RootStarshipArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipSelectionInput>,
            "StarshipSelection",
            "Starship",
            0,
            {
                $lazy: (args: RootStarshipArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    allVehicles: (args: RootAllVehiclesArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehiclesConnectionSelectionInput>,
            "VehiclesConnectionSelection",
            "VehiclesConnection",
            0,
            {
                $lazy: (args: RootAllVehiclesArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    vehicle: (args: RootVehicleArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehicleSelectionInput>,
            "VehicleSelection",
            "Vehicle",
            0,
            {
                $lazy: (args: RootVehicleArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    node: (args: RootNodeArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeNodeSelectionInput>,
            "NodeSelection",
            "Node",
            0,
            {
                $lazy: (args: RootNodeArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeRootSelectionInput(this: any): ReturnTypeFromRootSelection {
    return {
        allFilms: (args: RootAllFilmsArgs) =>
            FilmsConnectionSelection.bind({
                collector: this,
                fieldName: "allFilms",
                args,
                argsMeta: RootAllFilmsArgsMeta,
            }),
        film: (args: RootFilmArgs) =>
            FilmSelection.bind({
                collector: this,
                fieldName: "film",
                args,
                argsMeta: RootFilmArgsMeta,
            }),
        allPeople: (args: RootAllPeopleArgs) =>
            PeopleConnectionSelection.bind({
                collector: this,
                fieldName: "allPeople",
                args,
                argsMeta: RootAllPeopleArgsMeta,
            }),
        person: (args: RootPersonArgs) =>
            PersonSelection.bind({
                collector: this,
                fieldName: "person",
                args,
                argsMeta: RootPersonArgsMeta,
            }),
        allPlanets: (args: RootAllPlanetsArgs) =>
            PlanetsConnectionSelection.bind({
                collector: this,
                fieldName: "allPlanets",
                args,
                argsMeta: RootAllPlanetsArgsMeta,
            }),
        planet: (args: RootPlanetArgs) =>
            PlanetSelection.bind({
                collector: this,
                fieldName: "planet",
                args,
                argsMeta: RootPlanetArgsMeta,
            }),
        allSpecies: (args: RootAllSpeciesArgs) =>
            SpeciesConnectionSelection.bind({
                collector: this,
                fieldName: "allSpecies",
                args,
                argsMeta: RootAllSpeciesArgsMeta,
            }),
        species: (args: RootSpeciesArgs) =>
            SpeciesSelection.bind({
                collector: this,
                fieldName: "species",
                args,
                argsMeta: RootSpeciesArgsMeta,
            }),
        allStarships: (args: RootAllStarshipsArgs) =>
            StarshipsConnectionSelection.bind({
                collector: this,
                fieldName: "allStarships",
                args,
                argsMeta: RootAllStarshipsArgsMeta,
            }),
        starship: (args: RootStarshipArgs) =>
            StarshipSelection.bind({
                collector: this,
                fieldName: "starship",
                args,
                argsMeta: RootStarshipArgsMeta,
            }),
        allVehicles: (args: RootAllVehiclesArgs) =>
            VehiclesConnectionSelection.bind({
                collector: this,
                fieldName: "allVehicles",
                args,
                argsMeta: RootAllVehiclesArgsMeta,
            }),
        vehicle: (args: RootVehicleArgs) =>
            VehicleSelection.bind({
                collector: this,
                fieldName: "vehicle",
                args,
                argsMeta: RootVehicleArgsMeta,
            }),
        node: (args: RootNodeArgs) =>
            NodeSelection.bind({
                collector: this,
                fieldName: "node",
                args,
                argsMeta: RootNodeArgsMeta,
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
export const RootSelection = makeSLFN(
    makeRootSelectionInput,
    "RootSelection",
    "Root",
    0,
);

type ReturnTypeFromPageInfoSelection = {
    hasNextPage: SelectionWrapperImpl<
        "hasNextPage",
        "Boolean",
        0,
        {},
        undefined
    >;
    hasPreviousPage: SelectionWrapperImpl<
        "hasPreviousPage",
        "Boolean",
        0,
        {},
        undefined
    >;
    startCursor: SelectionWrapperImpl<
        "startCursor",
        "String",
        0,
        {},
        undefined
    >;
    endCursor: SelectionWrapperImpl<"endCursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePageInfoSelectionInput>
    >;
};

export function makePageInfoSelectionInput(
    this: any,
): ReturnTypeFromPageInfoSelection {
    return {
        hasNextPage: new SelectionWrapper(
            "hasNextPage",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        hasPreviousPage: new SelectionWrapper(
            "hasPreviousPage",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        startCursor: new SelectionWrapper(
            "startCursor",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        endCursor: new SelectionWrapper(
            "endCursor",
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
                makePageInfoSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePageInfoSelectionInput>
            >,
    } as const;
}
export const PageInfoSelection = makeSLFN(
    makePageInfoSelectionInput,
    "PageInfoSelection",
    "PageInfo",
    0,
);

type ReturnTypeFromFilmsEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSelectionInput>,
            "FilmSelection",
            "Film",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmsEdgeSelectionInput>
    >;
};

export function makeFilmsEdgeSelectionInput(
    this: any,
): ReturnTypeFromFilmsEdgeSelection {
    return {
        node: FilmSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeFilmsEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmsEdgeSelectionInput>
            >,
    } as const;
}
export const FilmsEdgeSelection = makeSLFN(
    makeFilmsEdgeSelectionInput,
    "FilmsEdgeSelection",
    "FilmsEdge",
    0,
);

type ReturnTypeFromFilmSpeciesEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesSelectionInput>,
            "SpeciesSelection",
            "Species",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmSpeciesEdgeSelectionInput>
    >;
};

export function makeFilmSpeciesEdgeSelectionInput(
    this: any,
): ReturnTypeFromFilmSpeciesEdgeSelection {
    return {
        node: SpeciesSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeFilmSpeciesEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmSpeciesEdgeSelectionInput>
            >,
    } as const;
}
export const FilmSpeciesEdgeSelection = makeSLFN(
    makeFilmSpeciesEdgeSelectionInput,
    "FilmSpeciesEdgeSelection",
    "FilmSpeciesEdge",
    0,
);

type ReturnTypeFromPlanetResidentsEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonSelectionInput>,
            "PersonSelection",
            "Person",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePlanetResidentsEdgeSelectionInput>
    >;
};

export function makePlanetResidentsEdgeSelectionInput(
    this: any,
): ReturnTypeFromPlanetResidentsEdgeSelection {
    return {
        node: PersonSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makePlanetResidentsEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePlanetResidentsEdgeSelectionInput>
            >,
    } as const;
}
export const PlanetResidentsEdgeSelection = makeSLFN(
    makePlanetResidentsEdgeSelectionInput,
    "PlanetResidentsEdgeSelection",
    "PlanetResidentsEdge",
    0,
);

type ReturnTypeFromPersonFilmsEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSelectionInput>,
            "FilmSelection",
            "Film",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePersonFilmsEdgeSelectionInput>
    >;
};

export function makePersonFilmsEdgeSelectionInput(
    this: any,
): ReturnTypeFromPersonFilmsEdgeSelection {
    return {
        node: FilmSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makePersonFilmsEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePersonFilmsEdgeSelectionInput>
            >,
    } as const;
}
export const PersonFilmsEdgeSelection = makeSLFN(
    makePersonFilmsEdgeSelectionInput,
    "PersonFilmsEdgeSelection",
    "PersonFilmsEdge",
    0,
);

type ReturnTypeFromPersonStarshipsEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipSelectionInput>,
            "StarshipSelection",
            "Starship",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePersonStarshipsEdgeSelectionInput>
    >;
};

export function makePersonStarshipsEdgeSelectionInput(
    this: any,
): ReturnTypeFromPersonStarshipsEdgeSelection {
    return {
        node: StarshipSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makePersonStarshipsEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePersonStarshipsEdgeSelectionInput>
            >,
    } as const;
}
export const PersonStarshipsEdgeSelection = makeSLFN(
    makePersonStarshipsEdgeSelectionInput,
    "PersonStarshipsEdgeSelection",
    "PersonStarshipsEdge",
    0,
);

type ReturnTypeFromStarshipPilotsEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonSelectionInput>,
            "PersonSelection",
            "Person",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStarshipPilotsEdgeSelectionInput>
    >;
};

export function makeStarshipPilotsEdgeSelectionInput(
    this: any,
): ReturnTypeFromStarshipPilotsEdgeSelection {
    return {
        node: PersonSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeStarshipPilotsEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeStarshipPilotsEdgeSelectionInput>
            >,
    } as const;
}
export const StarshipPilotsEdgeSelection = makeSLFN(
    makeStarshipPilotsEdgeSelectionInput,
    "StarshipPilotsEdgeSelection",
    "StarshipPilotsEdge",
    0,
);

type ReturnTypeFromStarshipFilmsEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSelectionInput>,
            "FilmSelection",
            "Film",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStarshipFilmsEdgeSelectionInput>
    >;
};

export function makeStarshipFilmsEdgeSelectionInput(
    this: any,
): ReturnTypeFromStarshipFilmsEdgeSelection {
    return {
        node: FilmSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeStarshipFilmsEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeStarshipFilmsEdgeSelectionInput>
            >,
    } as const;
}
export const StarshipFilmsEdgeSelection = makeSLFN(
    makeStarshipFilmsEdgeSelectionInput,
    "StarshipFilmsEdgeSelection",
    "StarshipFilmsEdge",
    0,
);

type ReturnTypeFromPersonVehiclesEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehicleSelectionInput>,
            "VehicleSelection",
            "Vehicle",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePersonVehiclesEdgeSelectionInput>
    >;
};

export function makePersonVehiclesEdgeSelectionInput(
    this: any,
): ReturnTypeFromPersonVehiclesEdgeSelection {
    return {
        node: VehicleSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makePersonVehiclesEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePersonVehiclesEdgeSelectionInput>
            >,
    } as const;
}
export const PersonVehiclesEdgeSelection = makeSLFN(
    makePersonVehiclesEdgeSelectionInput,
    "PersonVehiclesEdgeSelection",
    "PersonVehiclesEdge",
    0,
);

type ReturnTypeFromVehiclePilotsEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonSelectionInput>,
            "PersonSelection",
            "Person",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeVehiclePilotsEdgeSelectionInput>
    >;
};

export function makeVehiclePilotsEdgeSelectionInput(
    this: any,
): ReturnTypeFromVehiclePilotsEdgeSelection {
    return {
        node: PersonSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeVehiclePilotsEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeVehiclePilotsEdgeSelectionInput>
            >,
    } as const;
}
export const VehiclePilotsEdgeSelection = makeSLFN(
    makeVehiclePilotsEdgeSelectionInput,
    "VehiclePilotsEdgeSelection",
    "VehiclePilotsEdge",
    0,
);

type ReturnTypeFromVehicleFilmsEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSelectionInput>,
            "FilmSelection",
            "Film",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeVehicleFilmsEdgeSelectionInput>
    >;
};

export function makeVehicleFilmsEdgeSelectionInput(
    this: any,
): ReturnTypeFromVehicleFilmsEdgeSelection {
    return {
        node: FilmSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeVehicleFilmsEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeVehicleFilmsEdgeSelectionInput>
            >,
    } as const;
}
export const VehicleFilmsEdgeSelection = makeSLFN(
    makeVehicleFilmsEdgeSelectionInput,
    "VehicleFilmsEdgeSelection",
    "VehicleFilmsEdge",
    0,
);

type ReturnTypeFromPlanetFilmsEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSelectionInput>,
            "FilmSelection",
            "Film",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePlanetFilmsEdgeSelectionInput>
    >;
};

export function makePlanetFilmsEdgeSelectionInput(
    this: any,
): ReturnTypeFromPlanetFilmsEdgeSelection {
    return {
        node: FilmSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makePlanetFilmsEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePlanetFilmsEdgeSelectionInput>
            >,
    } as const;
}
export const PlanetFilmsEdgeSelection = makeSLFN(
    makePlanetFilmsEdgeSelectionInput,
    "PlanetFilmsEdgeSelection",
    "PlanetFilmsEdge",
    0,
);

type ReturnTypeFromSpeciesPeopleEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonSelectionInput>,
            "PersonSelection",
            "Person",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSpeciesPeopleEdgeSelectionInput>
    >;
};

export function makeSpeciesPeopleEdgeSelectionInput(
    this: any,
): ReturnTypeFromSpeciesPeopleEdgeSelection {
    return {
        node: PersonSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeSpeciesPeopleEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeSpeciesPeopleEdgeSelectionInput>
            >,
    } as const;
}
export const SpeciesPeopleEdgeSelection = makeSLFN(
    makeSpeciesPeopleEdgeSelectionInput,
    "SpeciesPeopleEdgeSelection",
    "SpeciesPeopleEdge",
    0,
);

type ReturnTypeFromSpeciesFilmsEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeFilmSelectionInput>,
            "FilmSelection",
            "Film",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSpeciesFilmsEdgeSelectionInput>
    >;
};

export function makeSpeciesFilmsEdgeSelectionInput(
    this: any,
): ReturnTypeFromSpeciesFilmsEdgeSelection {
    return {
        node: FilmSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeSpeciesFilmsEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeSpeciesFilmsEdgeSelectionInput>
            >,
    } as const;
}
export const SpeciesFilmsEdgeSelection = makeSLFN(
    makeSpeciesFilmsEdgeSelectionInput,
    "SpeciesFilmsEdgeSelection",
    "SpeciesFilmsEdge",
    0,
);

type ReturnTypeFromFilmStarshipsEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipSelectionInput>,
            "StarshipSelection",
            "Starship",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmStarshipsEdgeSelectionInput>
    >;
};

export function makeFilmStarshipsEdgeSelectionInput(
    this: any,
): ReturnTypeFromFilmStarshipsEdgeSelection {
    return {
        node: StarshipSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeFilmStarshipsEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmStarshipsEdgeSelectionInput>
            >,
    } as const;
}
export const FilmStarshipsEdgeSelection = makeSLFN(
    makeFilmStarshipsEdgeSelectionInput,
    "FilmStarshipsEdgeSelection",
    "FilmStarshipsEdge",
    0,
);

type ReturnTypeFromFilmVehiclesEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehicleSelectionInput>,
            "VehicleSelection",
            "Vehicle",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmVehiclesEdgeSelectionInput>
    >;
};

export function makeFilmVehiclesEdgeSelectionInput(
    this: any,
): ReturnTypeFromFilmVehiclesEdgeSelection {
    return {
        node: VehicleSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeFilmVehiclesEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmVehiclesEdgeSelectionInput>
            >,
    } as const;
}
export const FilmVehiclesEdgeSelection = makeSLFN(
    makeFilmVehiclesEdgeSelectionInput,
    "FilmVehiclesEdgeSelection",
    "FilmVehiclesEdge",
    0,
);

type ReturnTypeFromFilmCharactersEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonSelectionInput>,
            "PersonSelection",
            "Person",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmCharactersEdgeSelectionInput>
    >;
};

export function makeFilmCharactersEdgeSelectionInput(
    this: any,
): ReturnTypeFromFilmCharactersEdgeSelection {
    return {
        node: PersonSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeFilmCharactersEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmCharactersEdgeSelectionInput>
            >,
    } as const;
}
export const FilmCharactersEdgeSelection = makeSLFN(
    makeFilmCharactersEdgeSelectionInput,
    "FilmCharactersEdgeSelection",
    "FilmCharactersEdge",
    0,
);

type ReturnTypeFromFilmPlanetsEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetSelectionInput>,
            "PlanetSelection",
            "Planet",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeFilmPlanetsEdgeSelectionInput>
    >;
};

export function makeFilmPlanetsEdgeSelectionInput(
    this: any,
): ReturnTypeFromFilmPlanetsEdgeSelection {
    return {
        node: PlanetSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeFilmPlanetsEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeFilmPlanetsEdgeSelectionInput>
            >,
    } as const;
}
export const FilmPlanetsEdgeSelection = makeSLFN(
    makeFilmPlanetsEdgeSelectionInput,
    "FilmPlanetsEdgeSelection",
    "FilmPlanetsEdge",
    0,
);

type ReturnTypeFromPeopleEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePersonSelectionInput>,
            "PersonSelection",
            "Person",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePeopleEdgeSelectionInput>
    >;
};

export function makePeopleEdgeSelectionInput(
    this: any,
): ReturnTypeFromPeopleEdgeSelection {
    return {
        node: PersonSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makePeopleEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePeopleEdgeSelectionInput>
            >,
    } as const;
}
export const PeopleEdgeSelection = makeSLFN(
    makePeopleEdgeSelectionInput,
    "PeopleEdgeSelection",
    "PeopleEdge",
    0,
);

type ReturnTypeFromPlanetsEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePlanetSelectionInput>,
            "PlanetSelection",
            "Planet",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePlanetsEdgeSelectionInput>
    >;
};

export function makePlanetsEdgeSelectionInput(
    this: any,
): ReturnTypeFromPlanetsEdgeSelection {
    return {
        node: PlanetSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makePlanetsEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePlanetsEdgeSelectionInput>
            >,
    } as const;
}
export const PlanetsEdgeSelection = makeSLFN(
    makePlanetsEdgeSelectionInput,
    "PlanetsEdgeSelection",
    "PlanetsEdge",
    0,
);

type ReturnTypeFromSpeciesEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeSpeciesSelectionInput>,
            "SpeciesSelection",
            "Species",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSpeciesEdgeSelectionInput>
    >;
};

export function makeSpeciesEdgeSelectionInput(
    this: any,
): ReturnTypeFromSpeciesEdgeSelection {
    return {
        node: SpeciesSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeSpeciesEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeSpeciesEdgeSelectionInput>
            >,
    } as const;
}
export const SpeciesEdgeSelection = makeSLFN(
    makeSpeciesEdgeSelectionInput,
    "SpeciesEdgeSelection",
    "SpeciesEdge",
    0,
);

type ReturnTypeFromStarshipsEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeStarshipSelectionInput>,
            "StarshipSelection",
            "Starship",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStarshipsEdgeSelectionInput>
    >;
};

export function makeStarshipsEdgeSelectionInput(
    this: any,
): ReturnTypeFromStarshipsEdgeSelection {
    return {
        node: StarshipSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeStarshipsEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeStarshipsEdgeSelectionInput>
            >,
    } as const;
}
export const StarshipsEdgeSelection = makeSLFN(
    makeStarshipsEdgeSelectionInput,
    "StarshipsEdgeSelection",
    "StarshipsEdge",
    0,
);

type ReturnTypeFromVehiclesEdgeSelection = {
    node: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVehicleSelectionInput>,
            "VehicleSelection",
            "Vehicle",
            0
        >
    >;
    cursor: SelectionWrapperImpl<"cursor", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeVehiclesEdgeSelectionInput>
    >;
};

export function makeVehiclesEdgeSelectionInput(
    this: any,
): ReturnTypeFromVehiclesEdgeSelection {
    return {
        node: VehicleSelection.bind({ collector: this, fieldName: "node" }),
        cursor: new SelectionWrapper(
            "cursor",
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
                makeVehiclesEdgeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeVehiclesEdgeSelectionInput>
            >,
    } as const;
}
export const VehiclesEdgeSelection = makeSLFN(
    makeVehiclesEdgeSelectionInput,
    "VehiclesEdgeSelection",
    "VehiclesEdge",
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
        query: RootSelection.bind({
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
