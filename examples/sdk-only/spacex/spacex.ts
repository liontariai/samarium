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
        const res = await fetch("https://spacex-production.up.railway.app", {
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

export type users_select_column =
    | "column"
    | "name"
    | "id"
    | "rocket"
    | "timestamp"
    | "twitter";
export enum users_select_columnEnum {
    column = "column",
    name = "name",
    id = "id",
    rocket = "rocket",
    timestamp = "timestamp",
    twitter = "twitter",
}

export type order_by =
    | "asc"
    | "asc_nulls_first"
    | "asc_nulls_last"
    | "desc"
    | "desc_nulls_first"
    | "desc_nulls_last";
export enum order_byEnum {
    /** in the ascending order, nulls last */
    asc = "asc",
    /** in the ascending order, nulls first */
    asc_nulls_first = "asc_nulls_first",
    /** in the ascending order, nulls last */
    asc_nulls_last = "asc_nulls_last",
    /** in the descending order, nulls first */
    desc = "desc",
    /** in the descending order, nulls first */
    desc_nulls_first = "desc_nulls_first",
    /** in the descending order, nulls last */
    desc_nulls_last = "desc_nulls_last",
}

export type users_constraint =
    | "unique"
    | "or"
    | "primary"
    | "key"
    | "constraint"
    | "users_pkey";
export enum users_constraintEnum {
    unique = "unique",
    or = "or",
    primary = "primary",
    key = "key",
    constraint = "constraint",
    users_pkey = "users_pkey",
}

export type users_update_column =
    | "column"
    | "name"
    | "id"
    | "rocket"
    | "timestamp"
    | "twitter";
export enum users_update_columnEnum {
    column = "column",
    name = "name",
    id = "id",
    rocket = "rocket",
    timestamp = "timestamp",
    twitter = "twitter",
}

export type link__Purpose = "SECURITY" | "EXECUTION";
export enum link__PurposeEnum {
    /** `SECURITY` features provide metadata necessary to securely resolve fields. */
    SECURITY = "SECURITY",
    /** `EXECUTION` features provide metadata necessary for operation execution. */
    EXECUTION = "EXECUTION",
}

export type Directive_includeArgs = {
    /** Included when true. */
    if: boolean;
};
export type Directive_skipArgs = {
    /** Skipped when true. */
    if: boolean;
};
export type users_aggregate_fieldsCountArgs = {
    columns?: users_select_column[];
    distinct?: boolean;
};
export type MutationDelete_usersArgs = {
    /** filter the rows which have to be deleted */ where: users_bool_exp;
};
export type MutationInsert_usersArgs = {
    /** the rows to be inserted */
    objects: users_insert_input[] /** on conflict condition */;
    on_conflict?: users_on_conflict;
};
export type MutationUpdate_usersArgs = {
    /** sets the columns of the filtered rows to the given values */
    _set?: users_set_input /** filter the rows which have to be updated */;
    where: users_bool_exp;
};
export type QueryCapsuleArgs = {
    id: string;
};
export type QueryCapsulesArgs = {
    find?: CapsulesFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryCapsulesPastArgs = {
    find?: CapsulesFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryCapsulesUpcomingArgs = {
    find?: CapsulesFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryCoreArgs = {
    id: string;
};
export type QueryCoresArgs = {
    find?: CoresFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryCoresPastArgs = {
    find?: CoresFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryCoresUpcomingArgs = {
    find?: CoresFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryDragonArgs = {
    id: string;
};
export type QueryDragonsArgs = {
    limit?: number;
    offset?: number;
};
export type QueryHistoriesArgs = {
    find?: HistoryFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryHistoriesResultArgs = {
    find?: HistoryFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryHistoryArgs = {
    id: string;
};
export type QueryLandpadArgs = {
    id: string;
};
export type QueryLandpadsArgs = {
    limit?: number;
    offset?: number;
};
export type QueryLaunchArgs = {
    id: string;
};
export type QueryLaunchLatestArgs = {
    offset?: number;
};
export type QueryLaunchNextArgs = {
    offset?: number;
};
export type QueryLaunchesArgs = {
    find?: LaunchFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryLaunchesPastArgs = {
    find?: LaunchFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryLaunchesPastResultArgs = {
    find?: LaunchFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryLaunchesUpcomingArgs = {
    find?: LaunchFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryLaunchpadArgs = {
    id: string;
};
export type QueryLaunchpadsArgs = {
    limit?: number;
    offset?: number;
};
export type QueryMissionArgs = {
    id: string;
};
export type QueryMissionsArgs = {
    find?: MissionsFind;
    limit?: number;
    offset?: number;
};
export type QueryMissionsResultArgs = {
    find?: MissionsFind;
    limit?: number;
    offset?: number;
};
export type QueryPayloadArgs = {
    id: string;
};
export type QueryPayloadsArgs = {
    find?: PayloadsFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryRocketArgs = {
    id: string;
};
export type QueryRocketsArgs = {
    limit?: number;
    offset?: number;
};
export type QueryRocketsResultArgs = {
    limit?: number;
    offset?: number;
};
export type QueryShipArgs = {
    id: string;
};
export type QueryShipsArgs = {
    find?: ShipsFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryShipsResultArgs = {
    find?: ShipsFind;
    limit?: number;
    offset?: number;
    order?: string;
    sort?: string;
};
export type QueryUsersArgs = {
    /** distinct select on columns */
    distinct_on?: users_select_column[] /** limit the nuber of rows returned */;
    limit?: number /** skip the first n rows. Use only with order_by */;
    offset?: number /** sort the rows by one or more columns */;
    order_by?: users_order_by[] /** filter the rows returned */;
    where?: users_bool_exp;
};
export type QueryUsers_aggregateArgs = {
    /** distinct select on columns */
    distinct_on?: users_select_column[] /** limit the nuber of rows returned */;
    limit?: number /** skip the first n rows. Use only with order_by */;
    offset?: number /** sort the rows by one or more columns */;
    order_by?: users_order_by[] /** filter the rows returned */;
    where?: users_bool_exp;
};
export type QueryUsers_by_pkArgs = {
    id: any;
};
export type SubscriptionUsersArgs = {
    /** distinct select on columns */
    distinct_on?: users_select_column[] /** limit the nuber of rows returned */;
    limit?: number /** skip the first n rows. Use only with order_by */;
    offset?: number /** sort the rows by one or more columns */;
    order_by?: users_order_by[] /** filter the rows returned */;
    where?: users_bool_exp;
};
export type SubscriptionUsers_aggregateArgs = {
    /** distinct select on columns */
    distinct_on?: users_select_column[] /** limit the nuber of rows returned */;
    limit?: number /** skip the first n rows. Use only with order_by */;
    offset?: number /** sort the rows by one or more columns */;
    order_by?: users_order_by[] /** filter the rows returned */;
    where?: users_bool_exp;
};
export type SubscriptionUsers_by_pkArgs = {
    id: any;
};
export const Directive_includeArgsMeta = { if: "Boolean!" } as const;
export const Directive_skipArgsMeta = { if: "Boolean!" } as const;
export const users_aggregate_fieldsCountArgsMeta = {
    columns: "[users_select_column!]",
    distinct: "Boolean",
} as const;
export const MutationDelete_usersArgsMeta = {
    where: "users_bool_exp!",
} as const;
export const MutationInsert_usersArgsMeta = {
    objects: "[users_insert_input!]!",
    on_conflict: "users_on_conflict",
} as const;
export const MutationUpdate_usersArgsMeta = {
    _set: "users_set_input",
    where: "users_bool_exp!",
} as const;
export const QueryCapsuleArgsMeta = { id: "ID!" } as const;
export const QueryCapsulesArgsMeta = {
    find: "CapsulesFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryCapsulesPastArgsMeta = {
    find: "CapsulesFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryCapsulesUpcomingArgsMeta = {
    find: "CapsulesFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryCoreArgsMeta = { id: "ID!" } as const;
export const QueryCoresArgsMeta = {
    find: "CoresFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryCoresPastArgsMeta = {
    find: "CoresFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryCoresUpcomingArgsMeta = {
    find: "CoresFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryDragonArgsMeta = { id: "ID!" } as const;
export const QueryDragonsArgsMeta = { limit: "Int", offset: "Int" } as const;
export const QueryHistoriesArgsMeta = {
    find: "HistoryFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryHistoriesResultArgsMeta = {
    find: "HistoryFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryHistoryArgsMeta = { id: "ID!" } as const;
export const QueryLandpadArgsMeta = { id: "ID!" } as const;
export const QueryLandpadsArgsMeta = { limit: "Int", offset: "Int" } as const;
export const QueryLaunchArgsMeta = { id: "ID!" } as const;
export const QueryLaunchLatestArgsMeta = { offset: "Int" } as const;
export const QueryLaunchNextArgsMeta = { offset: "Int" } as const;
export const QueryLaunchesArgsMeta = {
    find: "LaunchFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryLaunchesPastArgsMeta = {
    find: "LaunchFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryLaunchesPastResultArgsMeta = {
    find: "LaunchFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryLaunchesUpcomingArgsMeta = {
    find: "LaunchFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryLaunchpadArgsMeta = { id: "ID!" } as const;
export const QueryLaunchpadsArgsMeta = { limit: "Int", offset: "Int" } as const;
export const QueryMissionArgsMeta = { id: "ID!" } as const;
export const QueryMissionsArgsMeta = {
    find: "MissionsFind",
    limit: "Int",
    offset: "Int",
} as const;
export const QueryMissionsResultArgsMeta = {
    find: "MissionsFind",
    limit: "Int",
    offset: "Int",
} as const;
export const QueryPayloadArgsMeta = { id: "ID!" } as const;
export const QueryPayloadsArgsMeta = {
    find: "PayloadsFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryRocketArgsMeta = { id: "ID!" } as const;
export const QueryRocketsArgsMeta = { limit: "Int", offset: "Int" } as const;
export const QueryRocketsResultArgsMeta = {
    limit: "Int",
    offset: "Int",
} as const;
export const QueryShipArgsMeta = { id: "ID!" } as const;
export const QueryShipsArgsMeta = {
    find: "ShipsFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryShipsResultArgsMeta = {
    find: "ShipsFind",
    limit: "Int",
    offset: "Int",
    order: "String",
    sort: "String",
} as const;
export const QueryUsersArgsMeta = {
    distinct_on: "[users_select_column!]",
    limit: "Int",
    offset: "Int",
    order_by: "[users_order_by!]",
    where: "users_bool_exp",
} as const;
export const QueryUsers_aggregateArgsMeta = {
    distinct_on: "[users_select_column!]",
    limit: "Int",
    offset: "Int",
    order_by: "[users_order_by!]",
    where: "users_bool_exp",
} as const;
export const QueryUsers_by_pkArgsMeta = { id: "uuid!" } as const;
export const SubscriptionUsersArgsMeta = {
    distinct_on: "[users_select_column!]",
    limit: "Int",
    offset: "Int",
    order_by: "[users_order_by!]",
    where: "users_bool_exp",
} as const;
export const SubscriptionUsers_aggregateArgsMeta = {
    distinct_on: "[users_select_column!]",
    limit: "Int",
    offset: "Int",
    order_by: "[users_order_by!]",
    where: "users_bool_exp",
} as const;
export const SubscriptionUsers_by_pkArgsMeta = { id: "uuid!" } as const;

export type CapsulesFind = {
    id?: string;
    landings?: number;
    mission?: string;
    original_launch?: Date;
    reuse_count?: number;
    status?: string;
    type?: string;
};

export type CoresFind = {
    asds_attempts?: number;
    asds_landings?: number;
    block?: number;
    id?: string;
    missions?: string;
    original_launch?: Date;
    reuse_count?: number;
    rtls_attempts?: number;
    rtls_landings?: number;
    status?: string;
    water_landing?: boolean;
};

export type HistoryFind = {
    end?: Date;
    flight_number?: number;
    id?: string;
    start?: Date;
};

export type LaunchFind = {
    apoapsis_km?: number;
    block?: number;
    cap_serial?: string;
    capsule_reuse?: string;
    core_flight?: number;
    core_reuse?: string;
    core_serial?: string;
    customer?: string;
    eccentricity?: number;
    end?: Date;
    epoch?: Date;
    fairings_recovered?: string;
    fairings_recovery_attempt?: string;
    fairings_reuse?: string;
    fairings_reused?: string;
    fairings_ship?: string;
    gridfins?: string;
    id?: string;
    inclination_deg?: number;
    land_success?: string;
    landing_intent?: string;
    landing_type?: string;
    landing_vehicle?: string;
    launch_date_local?: Date;
    launch_date_utc?: Date;
    launch_success?: string;
    launch_year?: string;
    legs?: string;
    lifespan_years?: number;
    longitude?: number;
    manufacturer?: string;
    mean_motion?: number;
    mission_id?: string;
    mission_name?: string;
    nationality?: string;
    norad_id?: number;
    orbit?: string;
    payload_id?: string;
    payload_type?: string;
    periapsis_km?: number;
    period_min?: number;
    raan?: number;
    reference_system?: string;
    regime?: string;
    reused?: string;
    rocket_id?: string;
    rocket_name?: string;
    rocket_type?: string;
    second_stage_block?: string;
    semi_major_axis_km?: number;
    ship?: string;
    side_core1_reuse?: string;
    side_core2_reuse?: string;
    site_id?: string;
    site_name_long?: string;
    site_name?: string;
    start?: Date;
    tbd?: string;
    tentative_max_precision?: string;
    tentative?: string;
};

export type MissionsFind = {
    id?: string;
    manufacturer?: string;
    name?: string;
    payload_id?: string;
};

export type PayloadsFind = {
    apoapsis_km?: number;
    customer?: string;
    eccentricity?: number;
    epoch?: Date;
    inclination_deg?: number;
    lifespan_years?: number;
    longitude?: number;
    manufacturer?: string;
    mean_motion?: number;
    nationality?: string;
    norad_id?: number;
    orbit?: string;
    payload_id?: string;
    payload_type?: string;
    periapsis_km?: number;
    period_min?: number;
    raan?: number;
    reference_system?: string;
    regime?: string;
    reused?: boolean;
    semi_major_axis_km?: number;
};

export type ShipsFind = {
    id?: string;
    name?: string;
    model?: string;
    type?: string;
    role?: string;
    active?: boolean;
    imo?: number;
    mmsi?: number;
    abs?: number;
    class?: number;
    weight_lbs?: number;
    weight_kg?: number;
    year_built?: number;
    home_port?: string;
    status?: string;
    speed_kn?: number;
    course_deg?: number;
    latitude?: number;
    longitude?: number;
    successful_landings?: number;
    attempted_landings?: number;
    mission?: string;
};

export type users_order_by = {
    id?: any;
    name?: any;
    rocket?: any;
    timestamp?: any;
    twitter?: any;
};

export type users_bool_exp = {
    _and?: users_bool_exp[];
    _not?: users_bool_exp;
    _or?: users_bool_exp[];
    id?: uuid_comparison_exp;
    name?: String_comparison_exp;
    rocket?: String_comparison_exp;
    timestamp?: timestamptz_comparison_exp;
    twitter?: String_comparison_exp;
};

export type uuid_comparison_exp = {
    _eq?: any;
    _gt?: any;
    _gte?: any;
    _in?: Array<any>;
    _is_null?: boolean;
    _lt?: any;
    _lte?: any;
    _neq?: any;
    _nin?: Array<any>;
};

export type String_comparison_exp = {
    _eq?: string;
    _gt?: string;
    _gte?: string;
    _ilike?: string;
    _in?: Array<string>;
    _is_null?: boolean;
    _like?: string;
    _lt?: string;
    _lte?: string;
    _neq?: string;
    _nilike?: string;
    _nin?: Array<string>;
    _nlike?: string;
    _nsimilar?: string;
    _similar?: string;
};

export type timestamptz_comparison_exp = {
    _eq?: any;
    _gt?: any;
    _gte?: any;
    _in?: Array<any>;
    _is_null?: boolean;
    _lt?: any;
    _lte?: any;
    _neq?: any;
    _nin?: Array<any>;
};

export type users_insert_input = {
    id?: any;
    name?: string;
    rocket?: string;
    timestamp?: any;
    twitter?: string;
};

export type users_on_conflict = {
    constraint: any;
    update_columns: Array<any>;
};

export type users_set_input = {
    id?: any;
    name?: string;
    rocket?: string;
    timestamp?: any;
    twitter?: string;
};

type ReturnTypeFromDragonSelection = {
    active: SelectionWrapperImpl<"active", "Boolean", 0, {}, undefined>;
    crew_capacity: SelectionWrapperImpl<
        "crew_capacity",
        "Int",
        0,
        {},
        undefined
    >;
    description: SelectionWrapperImpl<
        "description",
        "String",
        0,
        {},
        undefined
    >;
    diameter: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0
        >
    >;
    dry_mass_kg: SelectionWrapperImpl<"dry_mass_kg", "Int", 0, {}, undefined>;
    dry_mass_lb: SelectionWrapperImpl<"dry_mass_lb", "Int", 0, {}, undefined>;
    first_flight: SelectionWrapperImpl<
        "first_flight",
        "String",
        0,
        {},
        undefined
    >;
    heat_shield: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonHeatShieldSelectionInput>,
            "DragonHeatShieldSelection",
            "DragonHeatShield",
            0
        >
    >;
    height_w_trunk: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0
        >
    >;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    launch_payload_mass: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMassSelectionInput>,
            "MassSelection",
            "Mass",
            0
        >
    >;
    launch_payload_vol: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVolumeSelectionInput>,
            "VolumeSelection",
            "Volume",
            0
        >
    >;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    orbit_duration_yr: SelectionWrapperImpl<
        "orbit_duration_yr",
        "Int",
        0,
        {},
        undefined
    >;
    pressurized_capsule: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonPressurizedCapsuleSelectionInput>,
            "DragonPressurizedCapsuleSelection",
            "DragonPressurizedCapsule",
            0
        >
    >;
    return_payload_mass: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMassSelectionInput>,
            "MassSelection",
            "Mass",
            0
        >
    >;
    return_payload_vol: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVolumeSelectionInput>,
            "VolumeSelection",
            "Volume",
            0
        >
    >;
    sidewall_angle_deg: SelectionWrapperImpl<
        "sidewall_angle_deg",
        "Float",
        0,
        {},
        undefined
    >;
    thrusters: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonThrustArraySelectionInput>,
            "DragonThrustArraySelection",
            "DragonThrust",
            1
        >
    >;
    trunk: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonTrunkSelectionInput>,
            "DragonTrunkSelection",
            "DragonTrunk",
            0
        >
    >;
    type: SelectionWrapperImpl<"type", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapperImpl<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonSelectionInput>
    >;
};

export function makeDragonSelectionInput(
    this: any,
): ReturnTypeFromDragonSelection {
    return {
        active: new SelectionWrapper(
            "active",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        crew_capacity: new SelectionWrapper(
            "crew_capacity",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        description: new SelectionWrapper(
            "description",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        diameter: DistanceSelection.bind({
            collector: this,
            fieldName: "diameter",
        }),
        dry_mass_kg: new SelectionWrapper(
            "dry_mass_kg",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        dry_mass_lb: new SelectionWrapper(
            "dry_mass_lb",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        first_flight: new SelectionWrapper(
            "first_flight",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        heat_shield: DragonHeatShieldSelection.bind({
            collector: this,
            fieldName: "heat_shield",
        }),
        height_w_trunk: DistanceSelection.bind({
            collector: this,
            fieldName: "height_w_trunk",
        }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        launch_payload_mass: MassSelection.bind({
            collector: this,
            fieldName: "launch_payload_mass",
        }),
        launch_payload_vol: VolumeSelection.bind({
            collector: this,
            fieldName: "launch_payload_vol",
        }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        orbit_duration_yr: new SelectionWrapper(
            "orbit_duration_yr",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        pressurized_capsule: DragonPressurizedCapsuleSelection.bind({
            collector: this,
            fieldName: "pressurized_capsule",
        }),
        return_payload_mass: MassSelection.bind({
            collector: this,
            fieldName: "return_payload_mass",
        }),
        return_payload_vol: VolumeSelection.bind({
            collector: this,
            fieldName: "return_payload_vol",
        }),
        sidewall_angle_deg: new SelectionWrapper(
            "sidewall_angle_deg",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        thrusters: DragonThrustArraySelection.bind({
            collector: this,
            fieldName: "thrusters",
        }),
        trunk: DragonTrunkSelection.bind({
            collector: this,
            fieldName: "trunk",
        }),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),
        wikipedia: new SelectionWrapper(
            "wikipedia",
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
                makeDragonSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeDragonSelectionInput>>,
    } as const;
}
export const DragonSelection = makeSLFN(
    makeDragonSelectionInput,
    "DragonSelection",
    "Dragon",
    0,
);

type ReturnTypeFromDistanceSelection = {
    feet: SelectionWrapperImpl<"feet", "Float", 0, {}, undefined>;
    meters: SelectionWrapperImpl<"meters", "Float", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDistanceSelectionInput>
    >;
};

export function makeDistanceSelectionInput(
    this: any,
): ReturnTypeFromDistanceSelection {
    return {
        feet: new SelectionWrapper("feet", "Float", 0, {}, this, undefined),
        meters: new SelectionWrapper("meters", "Float", 0, {}, this, undefined),

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
                makeDistanceSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDistanceSelectionInput>
            >,
    } as const;
}
export const DistanceSelection = makeSLFN(
    makeDistanceSelectionInput,
    "DistanceSelection",
    "Distance",
    0,
);

type ReturnTypeFromDragonHeatShieldSelection = {
    dev_partner: SelectionWrapperImpl<
        "dev_partner",
        "String",
        0,
        {},
        undefined
    >;
    material: SelectionWrapperImpl<"material", "String", 0, {}, undefined>;
    size_meters: SelectionWrapperImpl<"size_meters", "Float", 0, {}, undefined>;
    temp_degrees: SelectionWrapperImpl<"temp_degrees", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonHeatShieldSelectionInput>
    >;
};

export function makeDragonHeatShieldSelectionInput(
    this: any,
): ReturnTypeFromDragonHeatShieldSelection {
    return {
        dev_partner: new SelectionWrapper(
            "dev_partner",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        material: new SelectionWrapper(
            "material",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        size_meters: new SelectionWrapper(
            "size_meters",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        temp_degrees: new SelectionWrapper(
            "temp_degrees",
            "Int",
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
                makeDragonHeatShieldSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonHeatShieldSelectionInput>
            >,
    } as const;
}
export const DragonHeatShieldSelection = makeSLFN(
    makeDragonHeatShieldSelectionInput,
    "DragonHeatShieldSelection",
    "DragonHeatShield",
    0,
);

type ReturnTypeFromMassSelection = {
    kg: SelectionWrapperImpl<"kg", "Int", 0, {}, undefined>;
    lb: SelectionWrapperImpl<"lb", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeMassSelectionInput>
    >;
};

export function makeMassSelectionInput(this: any): ReturnTypeFromMassSelection {
    return {
        kg: new SelectionWrapper("kg", "Int", 0, {}, this, undefined),
        lb: new SelectionWrapper("lb", "Int", 0, {}, this, undefined),

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
                makeMassSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeMassSelectionInput>>,
    } as const;
}
export const MassSelection = makeSLFN(
    makeMassSelectionInput,
    "MassSelection",
    "Mass",
    0,
);

type ReturnTypeFromVolumeSelection = {
    cubic_feet: SelectionWrapperImpl<"cubic_feet", "Int", 0, {}, undefined>;
    cubic_meters: SelectionWrapperImpl<"cubic_meters", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeVolumeSelectionInput>
    >;
};

export function makeVolumeSelectionInput(
    this: any,
): ReturnTypeFromVolumeSelection {
    return {
        cubic_feet: new SelectionWrapper(
            "cubic_feet",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        cubic_meters: new SelectionWrapper(
            "cubic_meters",
            "Int",
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
                makeVolumeSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeVolumeSelectionInput>>,
    } as const;
}
export const VolumeSelection = makeSLFN(
    makeVolumeSelectionInput,
    "VolumeSelection",
    "Volume",
    0,
);

type ReturnTypeFromDragonPressurizedCapsuleSelection = {
    payload_volume: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVolumeSelectionInput>,
            "VolumeSelection",
            "Volume",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeDragonPressurizedCapsuleSelectionInput(
    this: any,
): ReturnTypeFromDragonPressurizedCapsuleSelection {
    return {
        payload_volume: VolumeSelection.bind({
            collector: this,
            fieldName: "payload_volume",
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
export const DragonPressurizedCapsuleSelection = makeSLFN(
    makeDragonPressurizedCapsuleSelectionInput,
    "DragonPressurizedCapsuleSelection",
    "DragonPressurizedCapsule",
    0,
);

type ReturnTypeFromDragonThrustArraySelection = {
    amount: SelectionWrapperImpl<"amount", "Int", 0, {}, undefined>;
    fuel_1: SelectionWrapperImpl<"fuel_1", "String", 0, {}, undefined>;
    fuel_2: SelectionWrapperImpl<"fuel_2", "String", 0, {}, undefined>;
    pods: SelectionWrapperImpl<"pods", "Int", 0, {}, undefined>;
    thrust: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeForceSelectionInput>,
            "ForceSelection",
            "Force",
            0
        >
    >;
    type: SelectionWrapperImpl<"type", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonThrustArraySelectionInput>
    >;
};

export function makeDragonThrustArraySelectionInput(
    this: any,
): ReturnTypeFromDragonThrustArraySelection {
    return {
        amount: new SelectionWrapper("amount", "Int", 0, {}, this, undefined),
        fuel_1: new SelectionWrapper(
            "fuel_1",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        fuel_2: new SelectionWrapper(
            "fuel_2",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        pods: new SelectionWrapper("pods", "Int", 0, {}, this, undefined),
        thrust: ForceSelection.bind({ collector: this, fieldName: "thrust" }),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),

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
                makeDragonThrustArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonThrustArraySelectionInput>
            >,
    } as const;
}
export const DragonThrustArraySelection = makeSLFN(
    makeDragonThrustArraySelectionInput,
    "DragonThrustArraySelection",
    "DragonThrust",
    1,
);

type ReturnTypeFromForceSelection = {
    kN: SelectionWrapperImpl<"kN", "Float", 0, {}, undefined>;
    lbf: SelectionWrapperImpl<"lbf", "Float", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeForceSelectionInput>
    >;
};

export function makeForceSelectionInput(
    this: any,
): ReturnTypeFromForceSelection {
    return {
        kN: new SelectionWrapper("kN", "Float", 0, {}, this, undefined),
        lbf: new SelectionWrapper("lbf", "Float", 0, {}, this, undefined),

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
                makeForceSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeForceSelectionInput>>,
    } as const;
}
export const ForceSelection = makeSLFN(
    makeForceSelectionInput,
    "ForceSelection",
    "Force",
    0,
);

type ReturnTypeFromDragonTrunkSelection = {
    cargo: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonTrunkCargoSelectionInput>,
            "DragonTrunkCargoSelection",
            "DragonTrunkCargo",
            0
        >
    >;
    trunk_volume: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVolumeSelectionInput>,
            "VolumeSelection",
            "Volume",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeDragonTrunkSelectionInput(
    this: any,
): ReturnTypeFromDragonTrunkSelection {
    return {
        cargo: DragonTrunkCargoSelection.bind({
            collector: this,
            fieldName: "cargo",
        }),
        trunk_volume: VolumeSelection.bind({
            collector: this,
            fieldName: "trunk_volume",
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
export const DragonTrunkSelection = makeSLFN(
    makeDragonTrunkSelectionInput,
    "DragonTrunkSelection",
    "DragonTrunk",
    0,
);

type ReturnTypeFromDragonTrunkCargoSelection = {
    solar_array: SelectionWrapperImpl<"solar_array", "Int", 0, {}, undefined>;
    unpressurized_cargo: SelectionWrapperImpl<
        "unpressurized_cargo",
        "Boolean",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonTrunkCargoSelectionInput>
    >;
};

export function makeDragonTrunkCargoSelectionInput(
    this: any,
): ReturnTypeFromDragonTrunkCargoSelection {
    return {
        solar_array: new SelectionWrapper(
            "solar_array",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        unpressurized_cargo: new SelectionWrapper(
            "unpressurized_cargo",
            "Boolean",
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
                makeDragonTrunkCargoSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonTrunkCargoSelectionInput>
            >,
    } as const;
}
export const DragonTrunkCargoSelection = makeSLFN(
    makeDragonTrunkCargoSelectionInput,
    "DragonTrunkCargoSelection",
    "DragonTrunkCargo",
    0,
);

type ReturnTypeFromCapsuleMissionArraySelection = {
    flight: SelectionWrapperImpl<"flight", "Int", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCapsuleMissionArraySelectionInput>
    >;
};

export function makeCapsuleMissionArraySelectionInput(
    this: any,
): ReturnTypeFromCapsuleMissionArraySelection {
    return {
        flight: new SelectionWrapper("flight", "Int", 0, {}, this, undefined),
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
                makeCapsuleMissionArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCapsuleMissionArraySelectionInput>
            >,
    } as const;
}
export const CapsuleMissionArraySelection = makeSLFN(
    makeCapsuleMissionArraySelectionInput,
    "CapsuleMissionArraySelection",
    "CapsuleMission",
    1,
);

type ReturnTypeFromCapsuleSelection = {
    dragon: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonSelectionInput>,
            "DragonSelection",
            "Dragon",
            0
        >
    >;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    landings: SelectionWrapperImpl<"landings", "Int", 0, {}, undefined>;
    missions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleMissionArraySelectionInput>,
            "CapsuleMissionArraySelection",
            "CapsuleMission",
            1
        >
    >;
    original_launch: SelectionWrapperImpl<
        "original_launch",
        "Date",
        0,
        {},
        undefined
    >;
    reuse_count: SelectionWrapperImpl<"reuse_count", "Int", 0, {}, undefined>;
    status: SelectionWrapperImpl<"status", "String", 0, {}, undefined>;
    type: SelectionWrapperImpl<"type", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCapsuleSelectionInput>
    >;
};

export function makeCapsuleSelectionInput(
    this: any,
): ReturnTypeFromCapsuleSelection {
    return {
        dragon: DragonSelection.bind({ collector: this, fieldName: "dragon" }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        landings: new SelectionWrapper(
            "landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        missions: CapsuleMissionArraySelection.bind({
            collector: this,
            fieldName: "missions",
        }),
        original_launch: new SelectionWrapper(
            "original_launch",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        reuse_count: new SelectionWrapper(
            "reuse_count",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),

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
                makeCapsuleSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCapsuleSelectionInput>
            >,
    } as const;
}
export const CapsuleSelection = makeSLFN(
    makeCapsuleSelectionInput,
    "CapsuleSelection",
    "Capsule",
    0,
);

type ReturnTypeFromCapsuleArraySelection = {
    dragon: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonSelectionInput>,
            "DragonSelection",
            "Dragon",
            0
        >
    >;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    landings: SelectionWrapperImpl<"landings", "Int", 0, {}, undefined>;
    missions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleMissionArraySelectionInput>,
            "CapsuleMissionArraySelection",
            "CapsuleMission",
            1
        >
    >;
    original_launch: SelectionWrapperImpl<
        "original_launch",
        "Date",
        0,
        {},
        undefined
    >;
    reuse_count: SelectionWrapperImpl<"reuse_count", "Int", 0, {}, undefined>;
    status: SelectionWrapperImpl<"status", "String", 0, {}, undefined>;
    type: SelectionWrapperImpl<"type", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCapsuleArraySelectionInput>
    >;
};

export function makeCapsuleArraySelectionInput(
    this: any,
): ReturnTypeFromCapsuleArraySelection {
    return {
        dragon: DragonSelection.bind({ collector: this, fieldName: "dragon" }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        landings: new SelectionWrapper(
            "landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        missions: CapsuleMissionArraySelection.bind({
            collector: this,
            fieldName: "missions",
        }),
        original_launch: new SelectionWrapper(
            "original_launch",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        reuse_count: new SelectionWrapper(
            "reuse_count",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),

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
                makeCapsuleArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCapsuleArraySelectionInput>
            >,
    } as const;
}
export const CapsuleArraySelection = makeSLFN(
    makeCapsuleArraySelectionInput,
    "CapsuleArraySelection",
    "Capsule",
    1,
);

type ReturnTypeFromAddressSelection = {
    address: SelectionWrapperImpl<"address", "String", 0, {}, undefined>;
    city: SelectionWrapperImpl<"city", "String", 0, {}, undefined>;
    state: SelectionWrapperImpl<"state", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeAddressSelectionInput>
    >;
};

export function makeAddressSelectionInput(
    this: any,
): ReturnTypeFromAddressSelection {
    return {
        address: new SelectionWrapper(
            "address",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        city: new SelectionWrapper("city", "String", 0, {}, this, undefined),
        state: new SelectionWrapper("state", "String", 0, {}, this, undefined),

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
                makeAddressSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeAddressSelectionInput>
            >,
    } as const;
}
export const AddressSelection = makeSLFN(
    makeAddressSelectionInput,
    "AddressSelection",
    "Address",
    0,
);

type ReturnTypeFromInfoLinksSelection = {
    elon_twitter: SelectionWrapperImpl<
        "elon_twitter",
        "String",
        0,
        {},
        undefined
    >;
    flickr: SelectionWrapperImpl<"flickr", "String", 0, {}, undefined>;
    twitter: SelectionWrapperImpl<"twitter", "String", 0, {}, undefined>;
    website: SelectionWrapperImpl<"website", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeInfoLinksSelectionInput>
    >;
};

export function makeInfoLinksSelectionInput(
    this: any,
): ReturnTypeFromInfoLinksSelection {
    return {
        elon_twitter: new SelectionWrapper(
            "elon_twitter",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        flickr: new SelectionWrapper(
            "flickr",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        twitter: new SelectionWrapper(
            "twitter",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        website: new SelectionWrapper(
            "website",
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
                makeInfoLinksSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeInfoLinksSelectionInput>
            >,
    } as const;
}
export const InfoLinksSelection = makeSLFN(
    makeInfoLinksSelectionInput,
    "InfoLinksSelection",
    "InfoLinks",
    0,
);

type ReturnTypeFromInfoSelection = {
    ceo: SelectionWrapperImpl<"ceo", "String", 0, {}, undefined>;
    coo: SelectionWrapperImpl<"coo", "String", 0, {}, undefined>;
    cto: SelectionWrapperImpl<"cto", "String", 0, {}, undefined>;
    cto_propulsion: SelectionWrapperImpl<
        "cto_propulsion",
        "String",
        0,
        {},
        undefined
    >;
    employees: SelectionWrapperImpl<"employees", "Int", 0, {}, undefined>;
    founded: SelectionWrapperImpl<"founded", "Int", 0, {}, undefined>;
    founder: SelectionWrapperImpl<"founder", "String", 0, {}, undefined>;
    headquarters: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAddressSelectionInput>,
            "AddressSelection",
            "Address",
            0
        >
    >;
    launch_sites: SelectionWrapperImpl<"launch_sites", "Int", 0, {}, undefined>;
    links: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeInfoLinksSelectionInput>,
            "InfoLinksSelection",
            "InfoLinks",
            0
        >
    >;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    summary: SelectionWrapperImpl<"summary", "String", 0, {}, undefined>;
    test_sites: SelectionWrapperImpl<"test_sites", "Int", 0, {}, undefined>;
    valuation: SelectionWrapperImpl<"valuation", "Float", 0, {}, undefined>;
    vehicles: SelectionWrapperImpl<"vehicles", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeInfoSelectionInput>
    >;
};

export function makeInfoSelectionInput(this: any): ReturnTypeFromInfoSelection {
    return {
        ceo: new SelectionWrapper("ceo", "String", 0, {}, this, undefined),
        coo: new SelectionWrapper("coo", "String", 0, {}, this, undefined),
        cto: new SelectionWrapper("cto", "String", 0, {}, this, undefined),
        cto_propulsion: new SelectionWrapper(
            "cto_propulsion",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        employees: new SelectionWrapper(
            "employees",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        founded: new SelectionWrapper("founded", "Int", 0, {}, this, undefined),
        founder: new SelectionWrapper(
            "founder",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        headquarters: AddressSelection.bind({
            collector: this,
            fieldName: "headquarters",
        }),
        launch_sites: new SelectionWrapper(
            "launch_sites",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        links: InfoLinksSelection.bind({ collector: this, fieldName: "links" }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        summary: new SelectionWrapper(
            "summary",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        test_sites: new SelectionWrapper(
            "test_sites",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        valuation: new SelectionWrapper(
            "valuation",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        vehicles: new SelectionWrapper(
            "vehicles",
            "Int",
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
                makeInfoSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeInfoSelectionInput>>,
    } as const;
}
export const InfoSelection = makeSLFN(
    makeInfoSelectionInput,
    "InfoSelection",
    "Info",
    0,
);

type ReturnTypeFromCoreSelection = {
    asds_attempts: SelectionWrapperImpl<
        "asds_attempts",
        "Int",
        0,
        {},
        undefined
    >;
    asds_landings: SelectionWrapperImpl<
        "asds_landings",
        "Int",
        0,
        {},
        undefined
    >;
    block: SelectionWrapperImpl<"block", "Int", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    missions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleMissionArraySelectionInput>,
            "CapsuleMissionArraySelection",
            "CapsuleMission",
            1
        >
    >;
    original_launch: SelectionWrapperImpl<
        "original_launch",
        "Date",
        0,
        {},
        undefined
    >;
    reuse_count: SelectionWrapperImpl<"reuse_count", "Int", 0, {}, undefined>;
    rtls_attempts: SelectionWrapperImpl<
        "rtls_attempts",
        "Int",
        0,
        {},
        undefined
    >;
    rtls_landings: SelectionWrapperImpl<
        "rtls_landings",
        "Int",
        0,
        {},
        undefined
    >;
    status: SelectionWrapperImpl<"status", "String", 0, {}, undefined>;
    water_landing: SelectionWrapperImpl<
        "water_landing",
        "Boolean",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCoreSelectionInput>
    >;
};

export function makeCoreSelectionInput(this: any): ReturnTypeFromCoreSelection {
    return {
        asds_attempts: new SelectionWrapper(
            "asds_attempts",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        asds_landings: new SelectionWrapper(
            "asds_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        block: new SelectionWrapper("block", "Int", 0, {}, this, undefined),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        missions: CapsuleMissionArraySelection.bind({
            collector: this,
            fieldName: "missions",
        }),
        original_launch: new SelectionWrapper(
            "original_launch",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        reuse_count: new SelectionWrapper(
            "reuse_count",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        rtls_attempts: new SelectionWrapper(
            "rtls_attempts",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        rtls_landings: new SelectionWrapper(
            "rtls_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        water_landing: new SelectionWrapper(
            "water_landing",
            "Boolean",
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
                makeCoreSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeCoreSelectionInput>>,
    } as const;
}
export const CoreSelection = makeSLFN(
    makeCoreSelectionInput,
    "CoreSelection",
    "Core",
    0,
);

type ReturnTypeFromCoreArraySelection = {
    asds_attempts: SelectionWrapperImpl<
        "asds_attempts",
        "Int",
        0,
        {},
        undefined
    >;
    asds_landings: SelectionWrapperImpl<
        "asds_landings",
        "Int",
        0,
        {},
        undefined
    >;
    block: SelectionWrapperImpl<"block", "Int", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    missions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleMissionArraySelectionInput>,
            "CapsuleMissionArraySelection",
            "CapsuleMission",
            1
        >
    >;
    original_launch: SelectionWrapperImpl<
        "original_launch",
        "Date",
        0,
        {},
        undefined
    >;
    reuse_count: SelectionWrapperImpl<"reuse_count", "Int", 0, {}, undefined>;
    rtls_attempts: SelectionWrapperImpl<
        "rtls_attempts",
        "Int",
        0,
        {},
        undefined
    >;
    rtls_landings: SelectionWrapperImpl<
        "rtls_landings",
        "Int",
        0,
        {},
        undefined
    >;
    status: SelectionWrapperImpl<"status", "String", 0, {}, undefined>;
    water_landing: SelectionWrapperImpl<
        "water_landing",
        "Boolean",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCoreArraySelectionInput>
    >;
};

export function makeCoreArraySelectionInput(
    this: any,
): ReturnTypeFromCoreArraySelection {
    return {
        asds_attempts: new SelectionWrapper(
            "asds_attempts",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        asds_landings: new SelectionWrapper(
            "asds_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        block: new SelectionWrapper("block", "Int", 0, {}, this, undefined),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        missions: CapsuleMissionArraySelection.bind({
            collector: this,
            fieldName: "missions",
        }),
        original_launch: new SelectionWrapper(
            "original_launch",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        reuse_count: new SelectionWrapper(
            "reuse_count",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        rtls_attempts: new SelectionWrapper(
            "rtls_attempts",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        rtls_landings: new SelectionWrapper(
            "rtls_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        water_landing: new SelectionWrapper(
            "water_landing",
            "Boolean",
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
                makeCoreArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCoreArraySelectionInput>
            >,
    } as const;
}
export const CoreArraySelection = makeSLFN(
    makeCoreArraySelectionInput,
    "CoreArraySelection",
    "Core",
    1,
);

type ReturnTypeFromDragonArraySelection = {
    active: SelectionWrapperImpl<"active", "Boolean", 0, {}, undefined>;
    crew_capacity: SelectionWrapperImpl<
        "crew_capacity",
        "Int",
        0,
        {},
        undefined
    >;
    description: SelectionWrapperImpl<
        "description",
        "String",
        0,
        {},
        undefined
    >;
    diameter: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0
        >
    >;
    dry_mass_kg: SelectionWrapperImpl<"dry_mass_kg", "Int", 0, {}, undefined>;
    dry_mass_lb: SelectionWrapperImpl<"dry_mass_lb", "Int", 0, {}, undefined>;
    first_flight: SelectionWrapperImpl<
        "first_flight",
        "String",
        0,
        {},
        undefined
    >;
    heat_shield: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonHeatShieldSelectionInput>,
            "DragonHeatShieldSelection",
            "DragonHeatShield",
            0
        >
    >;
    height_w_trunk: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0
        >
    >;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    launch_payload_mass: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMassSelectionInput>,
            "MassSelection",
            "Mass",
            0
        >
    >;
    launch_payload_vol: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVolumeSelectionInput>,
            "VolumeSelection",
            "Volume",
            0
        >
    >;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    orbit_duration_yr: SelectionWrapperImpl<
        "orbit_duration_yr",
        "Int",
        0,
        {},
        undefined
    >;
    pressurized_capsule: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonPressurizedCapsuleSelectionInput>,
            "DragonPressurizedCapsuleSelection",
            "DragonPressurizedCapsule",
            0
        >
    >;
    return_payload_mass: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMassSelectionInput>,
            "MassSelection",
            "Mass",
            0
        >
    >;
    return_payload_vol: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVolumeSelectionInput>,
            "VolumeSelection",
            "Volume",
            0
        >
    >;
    sidewall_angle_deg: SelectionWrapperImpl<
        "sidewall_angle_deg",
        "Float",
        0,
        {},
        undefined
    >;
    thrusters: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonThrustArraySelectionInput>,
            "DragonThrustArraySelection",
            "DragonThrust",
            1
        >
    >;
    trunk: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonTrunkSelectionInput>,
            "DragonTrunkSelection",
            "DragonTrunk",
            0
        >
    >;
    type: SelectionWrapperImpl<"type", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapperImpl<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonArraySelectionInput>
    >;
};

export function makeDragonArraySelectionInput(
    this: any,
): ReturnTypeFromDragonArraySelection {
    return {
        active: new SelectionWrapper(
            "active",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        crew_capacity: new SelectionWrapper(
            "crew_capacity",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        description: new SelectionWrapper(
            "description",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        diameter: DistanceSelection.bind({
            collector: this,
            fieldName: "diameter",
        }),
        dry_mass_kg: new SelectionWrapper(
            "dry_mass_kg",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        dry_mass_lb: new SelectionWrapper(
            "dry_mass_lb",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        first_flight: new SelectionWrapper(
            "first_flight",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        heat_shield: DragonHeatShieldSelection.bind({
            collector: this,
            fieldName: "heat_shield",
        }),
        height_w_trunk: DistanceSelection.bind({
            collector: this,
            fieldName: "height_w_trunk",
        }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        launch_payload_mass: MassSelection.bind({
            collector: this,
            fieldName: "launch_payload_mass",
        }),
        launch_payload_vol: VolumeSelection.bind({
            collector: this,
            fieldName: "launch_payload_vol",
        }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        orbit_duration_yr: new SelectionWrapper(
            "orbit_duration_yr",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        pressurized_capsule: DragonPressurizedCapsuleSelection.bind({
            collector: this,
            fieldName: "pressurized_capsule",
        }),
        return_payload_mass: MassSelection.bind({
            collector: this,
            fieldName: "return_payload_mass",
        }),
        return_payload_vol: VolumeSelection.bind({
            collector: this,
            fieldName: "return_payload_vol",
        }),
        sidewall_angle_deg: new SelectionWrapper(
            "sidewall_angle_deg",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        thrusters: DragonThrustArraySelection.bind({
            collector: this,
            fieldName: "thrusters",
        }),
        trunk: DragonTrunkSelection.bind({
            collector: this,
            fieldName: "trunk",
        }),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),
        wikipedia: new SelectionWrapper(
            "wikipedia",
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
                makeDragonArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonArraySelectionInput>
            >,
    } as const;
}
export const DragonArraySelection = makeSLFN(
    makeDragonArraySelectionInput,
    "DragonArraySelection",
    "Dragon",
    1,
);

type ReturnTypeFromLaunchSelection = {
    details: SelectionWrapperImpl<"details", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    is_tentative: SelectionWrapperImpl<
        "is_tentative",
        "Boolean",
        0,
        {},
        undefined
    >;
    launch_date_local: SelectionWrapperImpl<
        "launch_date_local",
        "Date",
        0,
        {},
        undefined
    >;
    launch_date_unix: SelectionWrapperImpl<
        "launch_date_unix",
        "Date",
        0,
        {},
        undefined
    >;
    launch_date_utc: SelectionWrapperImpl<
        "launch_date_utc",
        "Date",
        0,
        {},
        undefined
    >;
    launch_site: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSiteSelectionInput>,
            "LaunchSiteSelection",
            "LaunchSite",
            0
        >
    >;
    launch_success: SelectionWrapperImpl<
        "launch_success",
        "Boolean",
        0,
        {},
        undefined
    >;
    launch_year: SelectionWrapperImpl<
        "launch_year",
        "String",
        0,
        {},
        undefined
    >;
    links: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchLinksSelectionInput>,
            "LaunchLinksSelection",
            "LaunchLinks",
            0
        >
    >;
    mission_id: SelectionWrapperImpl<"mission_id", "String", 1, {}, undefined>;
    mission_name: SelectionWrapperImpl<
        "mission_name",
        "String",
        0,
        {},
        undefined
    >;
    rocket: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchRocketSelectionInput>,
            "LaunchRocketSelection",
            "LaunchRocket",
            0
        >
    >;
    ships: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipArraySelectionInput>,
            "ShipArraySelection",
            "Ship",
            1
        >
    >;
    static_fire_date_unix: SelectionWrapperImpl<
        "static_fire_date_unix",
        "Date",
        0,
        {},
        undefined
    >;
    static_fire_date_utc: SelectionWrapperImpl<
        "static_fire_date_utc",
        "Date",
        0,
        {},
        undefined
    >;
    telemetry: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchTelemetrySelectionInput>,
            "LaunchTelemetrySelection",
            "LaunchTelemetry",
            0
        >
    >;
    tentative_max_precision: SelectionWrapperImpl<
        "tentative_max_precision",
        "String",
        0,
        {},
        undefined
    >;
    upcoming: SelectionWrapperImpl<"upcoming", "Boolean", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchSelectionInput>
    >;
};

export function makeLaunchSelectionInput(
    this: any,
): ReturnTypeFromLaunchSelection {
    return {
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        is_tentative: new SelectionWrapper(
            "is_tentative",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_local: new SelectionWrapper(
            "launch_date_local",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_unix: new SelectionWrapper(
            "launch_date_unix",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_utc: new SelectionWrapper(
            "launch_date_utc",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_site: LaunchSiteSelection.bind({
            collector: this,
            fieldName: "launch_site",
        }),
        launch_success: new SelectionWrapper(
            "launch_success",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        launch_year: new SelectionWrapper(
            "launch_year",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        links: LaunchLinksSelection.bind({
            collector: this,
            fieldName: "links",
        }),
        mission_id: new SelectionWrapper(
            "mission_id",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        mission_name: new SelectionWrapper(
            "mission_name",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        rocket: LaunchRocketSelection.bind({
            collector: this,
            fieldName: "rocket",
        }),
        ships: ShipArraySelection.bind({ collector: this, fieldName: "ships" }),
        static_fire_date_unix: new SelectionWrapper(
            "static_fire_date_unix",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        static_fire_date_utc: new SelectionWrapper(
            "static_fire_date_utc",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        telemetry: LaunchTelemetrySelection.bind({
            collector: this,
            fieldName: "telemetry",
        }),
        tentative_max_precision: new SelectionWrapper(
            "tentative_max_precision",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        upcoming: new SelectionWrapper(
            "upcoming",
            "Boolean",
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
                makeLaunchSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeLaunchSelectionInput>>,
    } as const;
}
export const LaunchSelection = makeSLFN(
    makeLaunchSelectionInput,
    "LaunchSelection",
    "Launch",
    0,
);

type ReturnTypeFromLaunchSiteSelection = {
    site_id: SelectionWrapperImpl<"site_id", "String", 0, {}, undefined>;
    site_name: SelectionWrapperImpl<"site_name", "String", 0, {}, undefined>;
    site_name_long: SelectionWrapperImpl<
        "site_name_long",
        "String",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchSiteSelectionInput>
    >;
};

export function makeLaunchSiteSelectionInput(
    this: any,
): ReturnTypeFromLaunchSiteSelection {
    return {
        site_id: new SelectionWrapper(
            "site_id",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        site_name: new SelectionWrapper(
            "site_name",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        site_name_long: new SelectionWrapper(
            "site_name_long",
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
                makeLaunchSiteSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchSiteSelectionInput>
            >,
    } as const;
}
export const LaunchSiteSelection = makeSLFN(
    makeLaunchSiteSelectionInput,
    "LaunchSiteSelection",
    "LaunchSite",
    0,
);

type ReturnTypeFromLaunchLinksSelection = {
    article_link: SelectionWrapperImpl<
        "article_link",
        "String",
        0,
        {},
        undefined
    >;
    flickr_images: SelectionWrapperImpl<
        "flickr_images",
        "String",
        1,
        {},
        undefined
    >;
    mission_patch: SelectionWrapperImpl<
        "mission_patch",
        "String",
        0,
        {},
        undefined
    >;
    mission_patch_small: SelectionWrapperImpl<
        "mission_patch_small",
        "String",
        0,
        {},
        undefined
    >;
    presskit: SelectionWrapperImpl<"presskit", "String", 0, {}, undefined>;
    reddit_campaign: SelectionWrapperImpl<
        "reddit_campaign",
        "String",
        0,
        {},
        undefined
    >;
    reddit_launch: SelectionWrapperImpl<
        "reddit_launch",
        "String",
        0,
        {},
        undefined
    >;
    reddit_media: SelectionWrapperImpl<
        "reddit_media",
        "String",
        0,
        {},
        undefined
    >;
    reddit_recovery: SelectionWrapperImpl<
        "reddit_recovery",
        "String",
        0,
        {},
        undefined
    >;
    video_link: SelectionWrapperImpl<"video_link", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapperImpl<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchLinksSelectionInput>
    >;
};

export function makeLaunchLinksSelectionInput(
    this: any,
): ReturnTypeFromLaunchLinksSelection {
    return {
        article_link: new SelectionWrapper(
            "article_link",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        flickr_images: new SelectionWrapper(
            "flickr_images",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        mission_patch: new SelectionWrapper(
            "mission_patch",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        mission_patch_small: new SelectionWrapper(
            "mission_patch_small",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        presskit: new SelectionWrapper(
            "presskit",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        reddit_campaign: new SelectionWrapper(
            "reddit_campaign",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        reddit_launch: new SelectionWrapper(
            "reddit_launch",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        reddit_media: new SelectionWrapper(
            "reddit_media",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        reddit_recovery: new SelectionWrapper(
            "reddit_recovery",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        video_link: new SelectionWrapper(
            "video_link",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        wikipedia: new SelectionWrapper(
            "wikipedia",
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
                makeLaunchLinksSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchLinksSelectionInput>
            >,
    } as const;
}
export const LaunchLinksSelection = makeSLFN(
    makeLaunchLinksSelectionInput,
    "LaunchLinksSelection",
    "LaunchLinks",
    0,
);

type ReturnTypeFromLaunchRocketSelection = {
    fairings: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchRocketFairingsSelectionInput>,
            "LaunchRocketFairingsSelection",
            "LaunchRocketFairings",
            0
        >
    >;
    first_stage: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchRocketFirstStageSelectionInput>,
            "LaunchRocketFirstStageSelection",
            "LaunchRocketFirstStage",
            0
        >
    >;
    rocket: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketSelectionInput>,
            "RocketSelection",
            "Rocket",
            0
        >
    >;
    rocket_name: SelectionWrapperImpl<
        "rocket_name",
        "String",
        0,
        {},
        undefined
    >;
    rocket_type: SelectionWrapperImpl<
        "rocket_type",
        "String",
        0,
        {},
        undefined
    >;
    second_stage: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchRocketSecondStageSelectionInput>,
            "LaunchRocketSecondStageSelection",
            "LaunchRocketSecondStage",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketSelectionInput>
    >;
};

export function makeLaunchRocketSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketSelection {
    return {
        fairings: LaunchRocketFairingsSelection.bind({
            collector: this,
            fieldName: "fairings",
        }),
        first_stage: LaunchRocketFirstStageSelection.bind({
            collector: this,
            fieldName: "first_stage",
        }),
        rocket: RocketSelection.bind({ collector: this, fieldName: "rocket" }),
        rocket_name: new SelectionWrapper(
            "rocket_name",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        rocket_type: new SelectionWrapper(
            "rocket_type",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        second_stage: LaunchRocketSecondStageSelection.bind({
            collector: this,
            fieldName: "second_stage",
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
                makeLaunchRocketSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchRocketSelectionInput>
            >,
    } as const;
}
export const LaunchRocketSelection = makeSLFN(
    makeLaunchRocketSelectionInput,
    "LaunchRocketSelection",
    "LaunchRocket",
    0,
);

type ReturnTypeFromLaunchRocketFairingsSelection = {
    recovered: SelectionWrapperImpl<"recovered", "Boolean", 0, {}, undefined>;
    recovery_attempt: SelectionWrapperImpl<
        "recovery_attempt",
        "Boolean",
        0,
        {},
        undefined
    >;
    reused: SelectionWrapperImpl<"reused", "Boolean", 0, {}, undefined>;
    ship: SelectionWrapperImpl<"ship", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketFairingsSelectionInput>
    >;
};

export function makeLaunchRocketFairingsSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketFairingsSelection {
    return {
        recovered: new SelectionWrapper(
            "recovered",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        recovery_attempt: new SelectionWrapper(
            "recovery_attempt",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        reused: new SelectionWrapper(
            "reused",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        ship: new SelectionWrapper("ship", "String", 0, {}, this, undefined),

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
                makeLaunchRocketFairingsSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchRocketFairingsSelectionInput>
            >,
    } as const;
}
export const LaunchRocketFairingsSelection = makeSLFN(
    makeLaunchRocketFairingsSelectionInput,
    "LaunchRocketFairingsSelection",
    "LaunchRocketFairings",
    0,
);

type ReturnTypeFromLaunchRocketFirstStageSelection = {
    cores: ReturnType<
        SLFN<
            {},
            ReturnType<
                typeof makeLaunchRocketFirstStageCoreArraySelectionInput
            >,
            "LaunchRocketFirstStageCoreArraySelection",
            "LaunchRocketFirstStageCore",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeLaunchRocketFirstStageSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketFirstStageSelection {
    return {
        cores: LaunchRocketFirstStageCoreArraySelection.bind({
            collector: this,
            fieldName: "cores",
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
export const LaunchRocketFirstStageSelection = makeSLFN(
    makeLaunchRocketFirstStageSelectionInput,
    "LaunchRocketFirstStageSelection",
    "LaunchRocketFirstStage",
    0,
);

type ReturnTypeFromLaunchRocketFirstStageCoreArraySelection = {
    block: SelectionWrapperImpl<"block", "Int", 0, {}, undefined>;
    core: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreSelectionInput>,
            "CoreSelection",
            "Core",
            0
        >
    >;
    flight: SelectionWrapperImpl<"flight", "Int", 0, {}, undefined>;
    gridfins: SelectionWrapperImpl<"gridfins", "Boolean", 0, {}, undefined>;
    land_success: SelectionWrapperImpl<
        "land_success",
        "Boolean",
        0,
        {},
        undefined
    >;
    landing_intent: SelectionWrapperImpl<
        "landing_intent",
        "Boolean",
        0,
        {},
        undefined
    >;
    landing_type: SelectionWrapperImpl<
        "landing_type",
        "String",
        0,
        {},
        undefined
    >;
    landing_vehicle: SelectionWrapperImpl<
        "landing_vehicle",
        "String",
        0,
        {},
        undefined
    >;
    legs: SelectionWrapperImpl<"legs", "Boolean", 0, {}, undefined>;
    reused: SelectionWrapperImpl<"reused", "Boolean", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketFirstStageCoreArraySelectionInput>
    >;
};

export function makeLaunchRocketFirstStageCoreArraySelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketFirstStageCoreArraySelection {
    return {
        block: new SelectionWrapper("block", "Int", 0, {}, this, undefined),
        core: CoreSelection.bind({ collector: this, fieldName: "core" }),
        flight: new SelectionWrapper("flight", "Int", 0, {}, this, undefined),
        gridfins: new SelectionWrapper(
            "gridfins",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        land_success: new SelectionWrapper(
            "land_success",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        landing_intent: new SelectionWrapper(
            "landing_intent",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        landing_type: new SelectionWrapper(
            "landing_type",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        landing_vehicle: new SelectionWrapper(
            "landing_vehicle",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        legs: new SelectionWrapper("legs", "Boolean", 0, {}, this, undefined),
        reused: new SelectionWrapper(
            "reused",
            "Boolean",
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
                makeLaunchRocketFirstStageCoreArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<
                    typeof makeLaunchRocketFirstStageCoreArraySelectionInput
                >
            >,
    } as const;
}
export const LaunchRocketFirstStageCoreArraySelection = makeSLFN(
    makeLaunchRocketFirstStageCoreArraySelectionInput,
    "LaunchRocketFirstStageCoreArraySelection",
    "LaunchRocketFirstStageCore",
    1,
);

type ReturnTypeFromRocketSelection = {
    active: SelectionWrapperImpl<"active", "Boolean", 0, {}, undefined>;
    boosters: SelectionWrapperImpl<"boosters", "Int", 0, {}, undefined>;
    company: SelectionWrapperImpl<"company", "String", 0, {}, undefined>;
    cost_per_launch: SelectionWrapperImpl<
        "cost_per_launch",
        "Int",
        0,
        {},
        undefined
    >;
    country: SelectionWrapperImpl<"country", "String", 0, {}, undefined>;
    description: SelectionWrapperImpl<
        "description",
        "String",
        0,
        {},
        undefined
    >;
    diameter: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0
        >
    >;
    engines: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketEnginesSelectionInput>,
            "RocketEnginesSelection",
            "RocketEngines",
            0
        >
    >;
    first_flight: SelectionWrapperImpl<
        "first_flight",
        "Date",
        0,
        {},
        undefined
    >;
    first_stage: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketFirstStageSelectionInput>,
            "RocketFirstStageSelection",
            "RocketFirstStage",
            0
        >
    >;
    height: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0
        >
    >;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    landing_legs: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketLandingLegsSelectionInput>,
            "RocketLandingLegsSelection",
            "RocketLandingLegs",
            0
        >
    >;
    mass: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMassSelectionInput>,
            "MassSelection",
            "Mass",
            0
        >
    >;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    payload_weights: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketPayloadWeightArraySelectionInput>,
            "RocketPayloadWeightArraySelection",
            "RocketPayloadWeight",
            1
        >
    >;
    second_stage: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketSecondStageSelectionInput>,
            "RocketSecondStageSelection",
            "RocketSecondStage",
            0
        >
    >;
    stages: SelectionWrapperImpl<"stages", "Int", 0, {}, undefined>;
    success_rate_pct: SelectionWrapperImpl<
        "success_rate_pct",
        "Int",
        0,
        {},
        undefined
    >;
    type: SelectionWrapperImpl<"type", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapperImpl<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketSelectionInput>
    >;
};

export function makeRocketSelectionInput(
    this: any,
): ReturnTypeFromRocketSelection {
    return {
        active: new SelectionWrapper(
            "active",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        boosters: new SelectionWrapper(
            "boosters",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        company: new SelectionWrapper(
            "company",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        cost_per_launch: new SelectionWrapper(
            "cost_per_launch",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        country: new SelectionWrapper(
            "country",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        description: new SelectionWrapper(
            "description",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        diameter: DistanceSelection.bind({
            collector: this,
            fieldName: "diameter",
        }),
        engines: RocketEnginesSelection.bind({
            collector: this,
            fieldName: "engines",
        }),
        first_flight: new SelectionWrapper(
            "first_flight",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        first_stage: RocketFirstStageSelection.bind({
            collector: this,
            fieldName: "first_stage",
        }),
        height: DistanceSelection.bind({
            collector: this,
            fieldName: "height",
        }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        landing_legs: RocketLandingLegsSelection.bind({
            collector: this,
            fieldName: "landing_legs",
        }),
        mass: MassSelection.bind({ collector: this, fieldName: "mass" }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        payload_weights: RocketPayloadWeightArraySelection.bind({
            collector: this,
            fieldName: "payload_weights",
        }),
        second_stage: RocketSecondStageSelection.bind({
            collector: this,
            fieldName: "second_stage",
        }),
        stages: new SelectionWrapper("stages", "Int", 0, {}, this, undefined),
        success_rate_pct: new SelectionWrapper(
            "success_rate_pct",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),
        wikipedia: new SelectionWrapper(
            "wikipedia",
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
                makeRocketSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeRocketSelectionInput>>,
    } as const;
}
export const RocketSelection = makeSLFN(
    makeRocketSelectionInput,
    "RocketSelection",
    "Rocket",
    0,
);

type ReturnTypeFromRocketEnginesSelection = {
    engine_loss_max: SelectionWrapperImpl<
        "engine_loss_max",
        "String",
        0,
        {},
        undefined
    >;
    layout: SelectionWrapperImpl<"layout", "String", 0, {}, undefined>;
    number: SelectionWrapperImpl<"number", "Int", 0, {}, undefined>;
    propellant_1: SelectionWrapperImpl<
        "propellant_1",
        "String",
        0,
        {},
        undefined
    >;
    propellant_2: SelectionWrapperImpl<
        "propellant_2",
        "String",
        0,
        {},
        undefined
    >;
    thrust_sea_level: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeForceSelectionInput>,
            "ForceSelection",
            "Force",
            0
        >
    >;
    thrust_to_weight: SelectionWrapperImpl<
        "thrust_to_weight",
        "Float",
        0,
        {},
        undefined
    >;
    thrust_vacuum: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeForceSelectionInput>,
            "ForceSelection",
            "Force",
            0
        >
    >;
    type: SelectionWrapperImpl<"type", "String", 0, {}, undefined>;
    version: SelectionWrapperImpl<"version", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketEnginesSelectionInput>
    >;
};

export function makeRocketEnginesSelectionInput(
    this: any,
): ReturnTypeFromRocketEnginesSelection {
    return {
        engine_loss_max: new SelectionWrapper(
            "engine_loss_max",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        layout: new SelectionWrapper(
            "layout",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        number: new SelectionWrapper("number", "Int", 0, {}, this, undefined),
        propellant_1: new SelectionWrapper(
            "propellant_1",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        propellant_2: new SelectionWrapper(
            "propellant_2",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        thrust_sea_level: ForceSelection.bind({
            collector: this,
            fieldName: "thrust_sea_level",
        }),
        thrust_to_weight: new SelectionWrapper(
            "thrust_to_weight",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        thrust_vacuum: ForceSelection.bind({
            collector: this,
            fieldName: "thrust_vacuum",
        }),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),
        version: new SelectionWrapper(
            "version",
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
                makeRocketEnginesSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketEnginesSelectionInput>
            >,
    } as const;
}
export const RocketEnginesSelection = makeSLFN(
    makeRocketEnginesSelectionInput,
    "RocketEnginesSelection",
    "RocketEngines",
    0,
);

type ReturnTypeFromRocketFirstStageSelection = {
    burn_time_sec: SelectionWrapperImpl<
        "burn_time_sec",
        "Int",
        0,
        {},
        undefined
    >;
    engines: SelectionWrapperImpl<"engines", "Int", 0, {}, undefined>;
    fuel_amount_tons: SelectionWrapperImpl<
        "fuel_amount_tons",
        "Float",
        0,
        {},
        undefined
    >;
    reusable: SelectionWrapperImpl<"reusable", "Boolean", 0, {}, undefined>;
    thrust_sea_level: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeForceSelectionInput>,
            "ForceSelection",
            "Force",
            0
        >
    >;
    thrust_vacuum: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeForceSelectionInput>,
            "ForceSelection",
            "Force",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketFirstStageSelectionInput>
    >;
};

export function makeRocketFirstStageSelectionInput(
    this: any,
): ReturnTypeFromRocketFirstStageSelection {
    return {
        burn_time_sec: new SelectionWrapper(
            "burn_time_sec",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        engines: new SelectionWrapper("engines", "Int", 0, {}, this, undefined),
        fuel_amount_tons: new SelectionWrapper(
            "fuel_amount_tons",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        reusable: new SelectionWrapper(
            "reusable",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        thrust_sea_level: ForceSelection.bind({
            collector: this,
            fieldName: "thrust_sea_level",
        }),
        thrust_vacuum: ForceSelection.bind({
            collector: this,
            fieldName: "thrust_vacuum",
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
                makeRocketFirstStageSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketFirstStageSelectionInput>
            >,
    } as const;
}
export const RocketFirstStageSelection = makeSLFN(
    makeRocketFirstStageSelectionInput,
    "RocketFirstStageSelection",
    "RocketFirstStage",
    0,
);

type ReturnTypeFromRocketLandingLegsSelection = {
    material: SelectionWrapperImpl<"material", "String", 0, {}, undefined>;
    number: SelectionWrapperImpl<"number", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketLandingLegsSelectionInput>
    >;
};

export function makeRocketLandingLegsSelectionInput(
    this: any,
): ReturnTypeFromRocketLandingLegsSelection {
    return {
        material: new SelectionWrapper(
            "material",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        number: new SelectionWrapper("number", "Int", 0, {}, this, undefined),

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
                makeRocketLandingLegsSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketLandingLegsSelectionInput>
            >,
    } as const;
}
export const RocketLandingLegsSelection = makeSLFN(
    makeRocketLandingLegsSelectionInput,
    "RocketLandingLegsSelection",
    "RocketLandingLegs",
    0,
);

type ReturnTypeFromRocketPayloadWeightArraySelection = {
    id: SelectionWrapperImpl<"id", "String", 0, {}, undefined>;
    kg: SelectionWrapperImpl<"kg", "Int", 0, {}, undefined>;
    lb: SelectionWrapperImpl<"lb", "Int", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketPayloadWeightArraySelectionInput>
    >;
};

export function makeRocketPayloadWeightArraySelectionInput(
    this: any,
): ReturnTypeFromRocketPayloadWeightArraySelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        kg: new SelectionWrapper("kg", "Int", 0, {}, this, undefined),
        lb: new SelectionWrapper("lb", "Int", 0, {}, this, undefined),
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
                makeRocketPayloadWeightArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketPayloadWeightArraySelectionInput>
            >,
    } as const;
}
export const RocketPayloadWeightArraySelection = makeSLFN(
    makeRocketPayloadWeightArraySelectionInput,
    "RocketPayloadWeightArraySelection",
    "RocketPayloadWeight",
    1,
);

type ReturnTypeFromRocketSecondStageSelection = {
    burn_time_sec: SelectionWrapperImpl<
        "burn_time_sec",
        "Int",
        0,
        {},
        undefined
    >;
    engines: SelectionWrapperImpl<"engines", "Int", 0, {}, undefined>;
    fuel_amount_tons: SelectionWrapperImpl<
        "fuel_amount_tons",
        "Float",
        0,
        {},
        undefined
    >;
    payloads: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketSecondStagePayloadsSelectionInput>,
            "RocketSecondStagePayloadsSelection",
            "RocketSecondStagePayloads",
            0
        >
    >;
    thrust: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeForceSelectionInput>,
            "ForceSelection",
            "Force",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketSecondStageSelectionInput>
    >;
};

export function makeRocketSecondStageSelectionInput(
    this: any,
): ReturnTypeFromRocketSecondStageSelection {
    return {
        burn_time_sec: new SelectionWrapper(
            "burn_time_sec",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        engines: new SelectionWrapper("engines", "Int", 0, {}, this, undefined),
        fuel_amount_tons: new SelectionWrapper(
            "fuel_amount_tons",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        payloads: RocketSecondStagePayloadsSelection.bind({
            collector: this,
            fieldName: "payloads",
        }),
        thrust: ForceSelection.bind({ collector: this, fieldName: "thrust" }),

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
                makeRocketSecondStageSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketSecondStageSelectionInput>
            >,
    } as const;
}
export const RocketSecondStageSelection = makeSLFN(
    makeRocketSecondStageSelectionInput,
    "RocketSecondStageSelection",
    "RocketSecondStage",
    0,
);

type ReturnTypeFromRocketSecondStagePayloadsSelection = {
    composite_fairing: ReturnType<
        SLFN<
            {},
            ReturnType<
                typeof makeRocketSecondStagePayloadCompositeFairingSelectionInput
            >,
            "RocketSecondStagePayloadCompositeFairingSelection",
            "RocketSecondStagePayloadCompositeFairing",
            0
        >
    >;
    option_1: SelectionWrapperImpl<"option_1", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketSecondStagePayloadsSelectionInput>
    >;
};

export function makeRocketSecondStagePayloadsSelectionInput(
    this: any,
): ReturnTypeFromRocketSecondStagePayloadsSelection {
    return {
        composite_fairing:
            RocketSecondStagePayloadCompositeFairingSelection.bind({
                collector: this,
                fieldName: "composite_fairing",
            }),
        option_1: new SelectionWrapper(
            "option_1",
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
                makeRocketSecondStagePayloadsSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketSecondStagePayloadsSelectionInput>
            >,
    } as const;
}
export const RocketSecondStagePayloadsSelection = makeSLFN(
    makeRocketSecondStagePayloadsSelectionInput,
    "RocketSecondStagePayloadsSelection",
    "RocketSecondStagePayloads",
    0,
);

type ReturnTypeFromRocketSecondStagePayloadCompositeFairingSelection = {
    diameter: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0
        >
    >;
    height: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeRocketSecondStagePayloadCompositeFairingSelectionInput(
    this: any,
): ReturnTypeFromRocketSecondStagePayloadCompositeFairingSelection {
    return {
        diameter: DistanceSelection.bind({
            collector: this,
            fieldName: "diameter",
        }),
        height: DistanceSelection.bind({
            collector: this,
            fieldName: "height",
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
export const RocketSecondStagePayloadCompositeFairingSelection = makeSLFN(
    makeRocketSecondStagePayloadCompositeFairingSelectionInput,
    "RocketSecondStagePayloadCompositeFairingSelection",
    "RocketSecondStagePayloadCompositeFairing",
    0,
);

type ReturnTypeFromLaunchRocketSecondStageSelection = {
    block: SelectionWrapperImpl<"block", "Int", 0, {}, undefined>;
    payloads: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadArraySelectionInput>,
            "PayloadArraySelection",
            "Payload",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketSecondStageSelectionInput>
    >;
};

export function makeLaunchRocketSecondStageSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketSecondStageSelection {
    return {
        block: new SelectionWrapper("block", "Int", 0, {}, this, undefined),
        payloads: PayloadArraySelection.bind({
            collector: this,
            fieldName: "payloads",
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
                makeLaunchRocketSecondStageSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchRocketSecondStageSelectionInput>
            >,
    } as const;
}
export const LaunchRocketSecondStageSelection = makeSLFN(
    makeLaunchRocketSecondStageSelectionInput,
    "LaunchRocketSecondStageSelection",
    "LaunchRocketSecondStage",
    0,
);

type ReturnTypeFromPayloadArraySelection = {
    customers: SelectionWrapperImpl<"customers", "String", 1, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    manufacturer: SelectionWrapperImpl<
        "manufacturer",
        "String",
        0,
        {},
        undefined
    >;
    nationality: SelectionWrapperImpl<
        "nationality",
        "String",
        0,
        {},
        undefined
    >;
    norad_id: SelectionWrapperImpl<"norad_id", "Int", 1, {}, undefined>;
    orbit: SelectionWrapperImpl<"orbit", "String", 0, {}, undefined>;
    orbit_params: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadOrbitParamsSelectionInput>,
            "PayloadOrbitParamsSelection",
            "PayloadOrbitParams",
            0
        >
    >;
    payload_mass_kg: SelectionWrapperImpl<
        "payload_mass_kg",
        "Float",
        0,
        {},
        undefined
    >;
    payload_mass_lbs: SelectionWrapperImpl<
        "payload_mass_lbs",
        "Float",
        0,
        {},
        undefined
    >;
    payload_type: SelectionWrapperImpl<
        "payload_type",
        "String",
        0,
        {},
        undefined
    >;
    reused: SelectionWrapperImpl<"reused", "Boolean", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePayloadArraySelectionInput>
    >;
};

export function makePayloadArraySelectionInput(
    this: any,
): ReturnTypeFromPayloadArraySelection {
    return {
        customers: new SelectionWrapper(
            "customers",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        manufacturer: new SelectionWrapper(
            "manufacturer",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        nationality: new SelectionWrapper(
            "nationality",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        norad_id: new SelectionWrapper(
            "norad_id",
            "Int",
            1,
            {},
            this,
            undefined,
        ),
        orbit: new SelectionWrapper("orbit", "String", 0, {}, this, undefined),
        orbit_params: PayloadOrbitParamsSelection.bind({
            collector: this,
            fieldName: "orbit_params",
        }),
        payload_mass_kg: new SelectionWrapper(
            "payload_mass_kg",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        payload_mass_lbs: new SelectionWrapper(
            "payload_mass_lbs",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        payload_type: new SelectionWrapper(
            "payload_type",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        reused: new SelectionWrapper(
            "reused",
            "Boolean",
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
                makePayloadArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePayloadArraySelectionInput>
            >,
    } as const;
}
export const PayloadArraySelection = makeSLFN(
    makePayloadArraySelectionInput,
    "PayloadArraySelection",
    "Payload",
    1,
);

type ReturnTypeFromPayloadOrbitParamsSelection = {
    apoapsis_km: SelectionWrapperImpl<"apoapsis_km", "Float", 0, {}, undefined>;
    arg_of_pericenter: SelectionWrapperImpl<
        "arg_of_pericenter",
        "Float",
        0,
        {},
        undefined
    >;
    eccentricity: SelectionWrapperImpl<
        "eccentricity",
        "Float",
        0,
        {},
        undefined
    >;
    epoch: SelectionWrapperImpl<"epoch", "Date", 0, {}, undefined>;
    inclination_deg: SelectionWrapperImpl<
        "inclination_deg",
        "Float",
        0,
        {},
        undefined
    >;
    lifespan_years: SelectionWrapperImpl<
        "lifespan_years",
        "Float",
        0,
        {},
        undefined
    >;
    longitude: SelectionWrapperImpl<"longitude", "Float", 0, {}, undefined>;
    mean_anomaly: SelectionWrapperImpl<
        "mean_anomaly",
        "Float",
        0,
        {},
        undefined
    >;
    mean_motion: SelectionWrapperImpl<"mean_motion", "Float", 0, {}, undefined>;
    periapsis_km: SelectionWrapperImpl<
        "periapsis_km",
        "Float",
        0,
        {},
        undefined
    >;
    period_min: SelectionWrapperImpl<"period_min", "Float", 0, {}, undefined>;
    raan: SelectionWrapperImpl<"raan", "Float", 0, {}, undefined>;
    reference_system: SelectionWrapperImpl<
        "reference_system",
        "String",
        0,
        {},
        undefined
    >;
    regime: SelectionWrapperImpl<"regime", "String", 0, {}, undefined>;
    semi_major_axis_km: SelectionWrapperImpl<
        "semi_major_axis_km",
        "Float",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePayloadOrbitParamsSelectionInput>
    >;
};

export function makePayloadOrbitParamsSelectionInput(
    this: any,
): ReturnTypeFromPayloadOrbitParamsSelection {
    return {
        apoapsis_km: new SelectionWrapper(
            "apoapsis_km",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        arg_of_pericenter: new SelectionWrapper(
            "arg_of_pericenter",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        eccentricity: new SelectionWrapper(
            "eccentricity",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        epoch: new SelectionWrapper("epoch", "Date", 0, {}, this, undefined),
        inclination_deg: new SelectionWrapper(
            "inclination_deg",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        lifespan_years: new SelectionWrapper(
            "lifespan_years",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        longitude: new SelectionWrapper(
            "longitude",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        mean_anomaly: new SelectionWrapper(
            "mean_anomaly",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        mean_motion: new SelectionWrapper(
            "mean_motion",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        periapsis_km: new SelectionWrapper(
            "periapsis_km",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        period_min: new SelectionWrapper(
            "period_min",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        raan: new SelectionWrapper("raan", "Float", 0, {}, this, undefined),
        reference_system: new SelectionWrapper(
            "reference_system",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        regime: new SelectionWrapper(
            "regime",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        semi_major_axis_km: new SelectionWrapper(
            "semi_major_axis_km",
            "Float",
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
                makePayloadOrbitParamsSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePayloadOrbitParamsSelectionInput>
            >,
    } as const;
}
export const PayloadOrbitParamsSelection = makeSLFN(
    makePayloadOrbitParamsSelectionInput,
    "PayloadOrbitParamsSelection",
    "PayloadOrbitParams",
    0,
);

type ReturnTypeFromShipArraySelection = {
    abs: SelectionWrapperImpl<"abs", "Int", 0, {}, undefined>;
    active: SelectionWrapperImpl<"active", "Boolean", 0, {}, undefined>;
    attempted_landings: SelectionWrapperImpl<
        "attempted_landings",
        "Int",
        0,
        {},
        undefined
    >;
    class: SelectionWrapperImpl<"class", "Int", 0, {}, undefined>;
    course_deg: SelectionWrapperImpl<"course_deg", "Int", 0, {}, undefined>;
    home_port: SelectionWrapperImpl<"home_port", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    image: SelectionWrapperImpl<"image", "String", 0, {}, undefined>;
    imo: SelectionWrapperImpl<"imo", "Int", 0, {}, undefined>;
    missions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipMissionArraySelectionInput>,
            "ShipMissionArraySelection",
            "ShipMission",
            1
        >
    >;
    mmsi: SelectionWrapperImpl<"mmsi", "Int", 0, {}, undefined>;
    model: SelectionWrapperImpl<"model", "String", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    position: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipLocationSelectionInput>,
            "ShipLocationSelection",
            "ShipLocation",
            0
        >
    >;
    roles: SelectionWrapperImpl<"roles", "String", 1, {}, undefined>;
    speed_kn: SelectionWrapperImpl<"speed_kn", "Float", 0, {}, undefined>;
    status: SelectionWrapperImpl<"status", "String", 0, {}, undefined>;
    successful_landings: SelectionWrapperImpl<
        "successful_landings",
        "Int",
        0,
        {},
        undefined
    >;
    type: SelectionWrapperImpl<"type", "String", 0, {}, undefined>;
    url: SelectionWrapperImpl<"url", "String", 0, {}, undefined>;
    weight_kg: SelectionWrapperImpl<"weight_kg", "Int", 0, {}, undefined>;
    weight_lbs: SelectionWrapperImpl<"weight_lbs", "Int", 0, {}, undefined>;
    year_built: SelectionWrapperImpl<"year_built", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipArraySelectionInput>
    >;
};

export function makeShipArraySelectionInput(
    this: any,
): ReturnTypeFromShipArraySelection {
    return {
        abs: new SelectionWrapper("abs", "Int", 0, {}, this, undefined),
        active: new SelectionWrapper(
            "active",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        attempted_landings: new SelectionWrapper(
            "attempted_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        class: new SelectionWrapper("class", "Int", 0, {}, this, undefined),
        course_deg: new SelectionWrapper(
            "course_deg",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        home_port: new SelectionWrapper(
            "home_port",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        image: new SelectionWrapper("image", "String", 0, {}, this, undefined),
        imo: new SelectionWrapper("imo", "Int", 0, {}, this, undefined),
        missions: ShipMissionArraySelection.bind({
            collector: this,
            fieldName: "missions",
        }),
        mmsi: new SelectionWrapper("mmsi", "Int", 0, {}, this, undefined),
        model: new SelectionWrapper("model", "String", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        position: ShipLocationSelection.bind({
            collector: this,
            fieldName: "position",
        }),
        roles: new SelectionWrapper("roles", "String", 1, {}, this, undefined),
        speed_kn: new SelectionWrapper(
            "speed_kn",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        successful_landings: new SelectionWrapper(
            "successful_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),
        url: new SelectionWrapper("url", "String", 0, {}, this, undefined),
        weight_kg: new SelectionWrapper(
            "weight_kg",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        weight_lbs: new SelectionWrapper(
            "weight_lbs",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        year_built: new SelectionWrapper(
            "year_built",
            "Int",
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
                makeShipArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeShipArraySelectionInput>
            >,
    } as const;
}
export const ShipArraySelection = makeSLFN(
    makeShipArraySelectionInput,
    "ShipArraySelection",
    "Ship",
    1,
);

type ReturnTypeFromShipMissionArraySelection = {
    flight: SelectionWrapperImpl<"flight", "String", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipMissionArraySelectionInput>
    >;
};

export function makeShipMissionArraySelectionInput(
    this: any,
): ReturnTypeFromShipMissionArraySelection {
    return {
        flight: new SelectionWrapper(
            "flight",
            "String",
            0,
            {},
            this,
            undefined,
        ),
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
                makeShipMissionArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeShipMissionArraySelectionInput>
            >,
    } as const;
}
export const ShipMissionArraySelection = makeSLFN(
    makeShipMissionArraySelectionInput,
    "ShipMissionArraySelection",
    "ShipMission",
    1,
);

type ReturnTypeFromShipLocationSelection = {
    latitude: SelectionWrapperImpl<"latitude", "Float", 0, {}, undefined>;
    longitude: SelectionWrapperImpl<"longitude", "Float", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipLocationSelectionInput>
    >;
};

export function makeShipLocationSelectionInput(
    this: any,
): ReturnTypeFromShipLocationSelection {
    return {
        latitude: new SelectionWrapper(
            "latitude",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        longitude: new SelectionWrapper(
            "longitude",
            "Float",
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
                makeShipLocationSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeShipLocationSelectionInput>
            >,
    } as const;
}
export const ShipLocationSelection = makeSLFN(
    makeShipLocationSelectionInput,
    "ShipLocationSelection",
    "ShipLocation",
    0,
);

type ReturnTypeFromLaunchTelemetrySelection = {
    flight_club: SelectionWrapperImpl<
        "flight_club",
        "String",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchTelemetrySelectionInput>
    >;
};

export function makeLaunchTelemetrySelectionInput(
    this: any,
): ReturnTypeFromLaunchTelemetrySelection {
    return {
        flight_club: new SelectionWrapper(
            "flight_club",
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
                makeLaunchTelemetrySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchTelemetrySelectionInput>
            >,
    } as const;
}
export const LaunchTelemetrySelection = makeSLFN(
    makeLaunchTelemetrySelectionInput,
    "LaunchTelemetrySelection",
    "LaunchTelemetry",
    0,
);

type ReturnTypeFromLinkSelection = {
    article: SelectionWrapperImpl<"article", "String", 0, {}, undefined>;
    reddit: SelectionWrapperImpl<"reddit", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapperImpl<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLinkSelectionInput>
    >;
};

export function makeLinkSelectionInput(this: any): ReturnTypeFromLinkSelection {
    return {
        article: new SelectionWrapper(
            "article",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        reddit: new SelectionWrapper(
            "reddit",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        wikipedia: new SelectionWrapper(
            "wikipedia",
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
                makeLinkSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeLinkSelectionInput>>,
    } as const;
}
export const LinkSelection = makeSLFN(
    makeLinkSelectionInput,
    "LinkSelection",
    "Link",
    0,
);

type ReturnTypeFromHistoryArraySelection = {
    details: SelectionWrapperImpl<"details", "String", 0, {}, undefined>;
    event_date_unix: SelectionWrapperImpl<
        "event_date_unix",
        "Date",
        0,
        {},
        undefined
    >;
    event_date_utc: SelectionWrapperImpl<
        "event_date_utc",
        "Date",
        0,
        {},
        undefined
    >;
    flight: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSelectionInput>,
            "LaunchSelection",
            "Launch",
            0
        >
    >;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    links: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLinkSelectionInput>,
            "LinkSelection",
            "Link",
            0
        >
    >;
    title: SelectionWrapperImpl<"title", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeHistoryArraySelectionInput>
    >;
};

export function makeHistoryArraySelectionInput(
    this: any,
): ReturnTypeFromHistoryArraySelection {
    return {
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        event_date_unix: new SelectionWrapper(
            "event_date_unix",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        event_date_utc: new SelectionWrapper(
            "event_date_utc",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        flight: LaunchSelection.bind({ collector: this, fieldName: "flight" }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        links: LinkSelection.bind({ collector: this, fieldName: "links" }),
        title: new SelectionWrapper("title", "String", 0, {}, this, undefined),

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
                makeHistoryArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeHistoryArraySelectionInput>
            >,
    } as const;
}
export const HistoryArraySelection = makeSLFN(
    makeHistoryArraySelectionInput,
    "HistoryArraySelection",
    "History",
    1,
);

type ReturnTypeFromResultSelection = {
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeResultSelectionInput>
    >;
};

export function makeResultSelectionInput(
    this: any,
): ReturnTypeFromResultSelection {
    return {
        totalCount: new SelectionWrapper(
            "totalCount",
            "Int",
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
                makeResultSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeResultSelectionInput>>,
    } as const;
}
export const ResultSelection = makeSLFN(
    makeResultSelectionInput,
    "ResultSelection",
    "Result",
    0,
);

type ReturnTypeFromHistoriesResultSelection = {
    data: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeHistoryArraySelectionInput>,
            "HistoryArraySelection",
            "History",
            1
        >
    >;
    result: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResultSelectionInput>,
            "ResultSelection",
            "Result",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeHistoriesResultSelectionInput(
    this: any,
): ReturnTypeFromHistoriesResultSelection {
    return {
        data: HistoryArraySelection.bind({
            collector: this,
            fieldName: "data",
        }),
        result: ResultSelection.bind({ collector: this, fieldName: "result" }),

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
export const HistoriesResultSelection = makeSLFN(
    makeHistoriesResultSelectionInput,
    "HistoriesResultSelection",
    "HistoriesResult",
    0,
);

type ReturnTypeFromHistorySelection = {
    details: SelectionWrapperImpl<"details", "String", 0, {}, undefined>;
    event_date_unix: SelectionWrapperImpl<
        "event_date_unix",
        "Date",
        0,
        {},
        undefined
    >;
    event_date_utc: SelectionWrapperImpl<
        "event_date_utc",
        "Date",
        0,
        {},
        undefined
    >;
    flight: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSelectionInput>,
            "LaunchSelection",
            "Launch",
            0
        >
    >;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    links: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLinkSelectionInput>,
            "LinkSelection",
            "Link",
            0
        >
    >;
    title: SelectionWrapperImpl<"title", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeHistorySelectionInput>
    >;
};

export function makeHistorySelectionInput(
    this: any,
): ReturnTypeFromHistorySelection {
    return {
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        event_date_unix: new SelectionWrapper(
            "event_date_unix",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        event_date_utc: new SelectionWrapper(
            "event_date_utc",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        flight: LaunchSelection.bind({ collector: this, fieldName: "flight" }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        links: LinkSelection.bind({ collector: this, fieldName: "links" }),
        title: new SelectionWrapper("title", "String", 0, {}, this, undefined),

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
                makeHistorySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeHistorySelectionInput>
            >,
    } as const;
}
export const HistorySelection = makeSLFN(
    makeHistorySelectionInput,
    "HistorySelection",
    "History",
    0,
);

type ReturnTypeFromLocationSelection = {
    latitude: SelectionWrapperImpl<"latitude", "Float", 0, {}, undefined>;
    longitude: SelectionWrapperImpl<"longitude", "Float", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    region: SelectionWrapperImpl<"region", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLocationSelectionInput>
    >;
};

export function makeLocationSelectionInput(
    this: any,
): ReturnTypeFromLocationSelection {
    return {
        latitude: new SelectionWrapper(
            "latitude",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        longitude: new SelectionWrapper(
            "longitude",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        region: new SelectionWrapper(
            "region",
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
                makeLocationSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLocationSelectionInput>
            >,
    } as const;
}
export const LocationSelection = makeSLFN(
    makeLocationSelectionInput,
    "LocationSelection",
    "Location",
    0,
);

type ReturnTypeFromLandpadSelection = {
    attempted_landings: SelectionWrapperImpl<
        "attempted_landings",
        "String",
        0,
        {},
        undefined
    >;
    details: SelectionWrapperImpl<"details", "String", 0, {}, undefined>;
    full_name: SelectionWrapperImpl<"full_name", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    landing_type: SelectionWrapperImpl<
        "landing_type",
        "String",
        0,
        {},
        undefined
    >;
    location: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLocationSelectionInput>,
            "LocationSelection",
            "Location",
            0
        >
    >;
    status: SelectionWrapperImpl<"status", "String", 0, {}, undefined>;
    successful_landings: SelectionWrapperImpl<
        "successful_landings",
        "String",
        0,
        {},
        undefined
    >;
    wikipedia: SelectionWrapperImpl<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLandpadSelectionInput>
    >;
};

export function makeLandpadSelectionInput(
    this: any,
): ReturnTypeFromLandpadSelection {
    return {
        attempted_landings: new SelectionWrapper(
            "attempted_landings",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        full_name: new SelectionWrapper(
            "full_name",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        landing_type: new SelectionWrapper(
            "landing_type",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        location: LocationSelection.bind({
            collector: this,
            fieldName: "location",
        }),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        successful_landings: new SelectionWrapper(
            "successful_landings",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        wikipedia: new SelectionWrapper(
            "wikipedia",
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
                makeLandpadSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLandpadSelectionInput>
            >,
    } as const;
}
export const LandpadSelection = makeSLFN(
    makeLandpadSelectionInput,
    "LandpadSelection",
    "Landpad",
    0,
);

type ReturnTypeFromLandpadArraySelection = {
    attempted_landings: SelectionWrapperImpl<
        "attempted_landings",
        "String",
        0,
        {},
        undefined
    >;
    details: SelectionWrapperImpl<"details", "String", 0, {}, undefined>;
    full_name: SelectionWrapperImpl<"full_name", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    landing_type: SelectionWrapperImpl<
        "landing_type",
        "String",
        0,
        {},
        undefined
    >;
    location: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLocationSelectionInput>,
            "LocationSelection",
            "Location",
            0
        >
    >;
    status: SelectionWrapperImpl<"status", "String", 0, {}, undefined>;
    successful_landings: SelectionWrapperImpl<
        "successful_landings",
        "String",
        0,
        {},
        undefined
    >;
    wikipedia: SelectionWrapperImpl<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLandpadArraySelectionInput>
    >;
};

export function makeLandpadArraySelectionInput(
    this: any,
): ReturnTypeFromLandpadArraySelection {
    return {
        attempted_landings: new SelectionWrapper(
            "attempted_landings",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        full_name: new SelectionWrapper(
            "full_name",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        landing_type: new SelectionWrapper(
            "landing_type",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        location: LocationSelection.bind({
            collector: this,
            fieldName: "location",
        }),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        successful_landings: new SelectionWrapper(
            "successful_landings",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        wikipedia: new SelectionWrapper(
            "wikipedia",
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
                makeLandpadArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLandpadArraySelectionInput>
            >,
    } as const;
}
export const LandpadArraySelection = makeSLFN(
    makeLandpadArraySelectionInput,
    "LandpadArraySelection",
    "Landpad",
    1,
);

type ReturnTypeFromLaunchArraySelection = {
    details: SelectionWrapperImpl<"details", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    is_tentative: SelectionWrapperImpl<
        "is_tentative",
        "Boolean",
        0,
        {},
        undefined
    >;
    launch_date_local: SelectionWrapperImpl<
        "launch_date_local",
        "Date",
        0,
        {},
        undefined
    >;
    launch_date_unix: SelectionWrapperImpl<
        "launch_date_unix",
        "Date",
        0,
        {},
        undefined
    >;
    launch_date_utc: SelectionWrapperImpl<
        "launch_date_utc",
        "Date",
        0,
        {},
        undefined
    >;
    launch_site: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSiteSelectionInput>,
            "LaunchSiteSelection",
            "LaunchSite",
            0
        >
    >;
    launch_success: SelectionWrapperImpl<
        "launch_success",
        "Boolean",
        0,
        {},
        undefined
    >;
    launch_year: SelectionWrapperImpl<
        "launch_year",
        "String",
        0,
        {},
        undefined
    >;
    links: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchLinksSelectionInput>,
            "LaunchLinksSelection",
            "LaunchLinks",
            0
        >
    >;
    mission_id: SelectionWrapperImpl<"mission_id", "String", 1, {}, undefined>;
    mission_name: SelectionWrapperImpl<
        "mission_name",
        "String",
        0,
        {},
        undefined
    >;
    rocket: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchRocketSelectionInput>,
            "LaunchRocketSelection",
            "LaunchRocket",
            0
        >
    >;
    ships: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipArraySelectionInput>,
            "ShipArraySelection",
            "Ship",
            1
        >
    >;
    static_fire_date_unix: SelectionWrapperImpl<
        "static_fire_date_unix",
        "Date",
        0,
        {},
        undefined
    >;
    static_fire_date_utc: SelectionWrapperImpl<
        "static_fire_date_utc",
        "Date",
        0,
        {},
        undefined
    >;
    telemetry: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchTelemetrySelectionInput>,
            "LaunchTelemetrySelection",
            "LaunchTelemetry",
            0
        >
    >;
    tentative_max_precision: SelectionWrapperImpl<
        "tentative_max_precision",
        "String",
        0,
        {},
        undefined
    >;
    upcoming: SelectionWrapperImpl<"upcoming", "Boolean", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchArraySelectionInput>
    >;
};

export function makeLaunchArraySelectionInput(
    this: any,
): ReturnTypeFromLaunchArraySelection {
    return {
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        is_tentative: new SelectionWrapper(
            "is_tentative",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_local: new SelectionWrapper(
            "launch_date_local",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_unix: new SelectionWrapper(
            "launch_date_unix",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_utc: new SelectionWrapper(
            "launch_date_utc",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_site: LaunchSiteSelection.bind({
            collector: this,
            fieldName: "launch_site",
        }),
        launch_success: new SelectionWrapper(
            "launch_success",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        launch_year: new SelectionWrapper(
            "launch_year",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        links: LaunchLinksSelection.bind({
            collector: this,
            fieldName: "links",
        }),
        mission_id: new SelectionWrapper(
            "mission_id",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        mission_name: new SelectionWrapper(
            "mission_name",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        rocket: LaunchRocketSelection.bind({
            collector: this,
            fieldName: "rocket",
        }),
        ships: ShipArraySelection.bind({ collector: this, fieldName: "ships" }),
        static_fire_date_unix: new SelectionWrapper(
            "static_fire_date_unix",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        static_fire_date_utc: new SelectionWrapper(
            "static_fire_date_utc",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        telemetry: LaunchTelemetrySelection.bind({
            collector: this,
            fieldName: "telemetry",
        }),
        tentative_max_precision: new SelectionWrapper(
            "tentative_max_precision",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        upcoming: new SelectionWrapper(
            "upcoming",
            "Boolean",
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
                makeLaunchArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchArraySelectionInput>
            >,
    } as const;
}
export const LaunchArraySelection = makeSLFN(
    makeLaunchArraySelectionInput,
    "LaunchArraySelection",
    "Launch",
    1,
);

type ReturnTypeFromLaunchesPastResultSelection = {
    data: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchArraySelectionInput>,
            "LaunchArraySelection",
            "Launch",
            1
        >
    >;
    result: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResultSelectionInput>,
            "ResultSelection",
            "Result",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeLaunchesPastResultSelectionInput(
    this: any,
): ReturnTypeFromLaunchesPastResultSelection {
    return {
        data: LaunchArraySelection.bind({ collector: this, fieldName: "data" }),
        result: ResultSelection.bind({ collector: this, fieldName: "result" }),

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
export const LaunchesPastResultSelection = makeSLFN(
    makeLaunchesPastResultSelectionInput,
    "LaunchesPastResultSelection",
    "LaunchesPastResult",
    0,
);

type ReturnTypeFromRocketArraySelection = {
    active: SelectionWrapperImpl<"active", "Boolean", 0, {}, undefined>;
    boosters: SelectionWrapperImpl<"boosters", "Int", 0, {}, undefined>;
    company: SelectionWrapperImpl<"company", "String", 0, {}, undefined>;
    cost_per_launch: SelectionWrapperImpl<
        "cost_per_launch",
        "Int",
        0,
        {},
        undefined
    >;
    country: SelectionWrapperImpl<"country", "String", 0, {}, undefined>;
    description: SelectionWrapperImpl<
        "description",
        "String",
        0,
        {},
        undefined
    >;
    diameter: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0
        >
    >;
    engines: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketEnginesSelectionInput>,
            "RocketEnginesSelection",
            "RocketEngines",
            0
        >
    >;
    first_flight: SelectionWrapperImpl<
        "first_flight",
        "Date",
        0,
        {},
        undefined
    >;
    first_stage: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketFirstStageSelectionInput>,
            "RocketFirstStageSelection",
            "RocketFirstStage",
            0
        >
    >;
    height: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDistanceSelectionInput>,
            "DistanceSelection",
            "Distance",
            0
        >
    >;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    landing_legs: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketLandingLegsSelectionInput>,
            "RocketLandingLegsSelection",
            "RocketLandingLegs",
            0
        >
    >;
    mass: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMassSelectionInput>,
            "MassSelection",
            "Mass",
            0
        >
    >;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    payload_weights: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketPayloadWeightArraySelectionInput>,
            "RocketPayloadWeightArraySelection",
            "RocketPayloadWeight",
            1
        >
    >;
    second_stage: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketSecondStageSelectionInput>,
            "RocketSecondStageSelection",
            "RocketSecondStage",
            0
        >
    >;
    stages: SelectionWrapperImpl<"stages", "Int", 0, {}, undefined>;
    success_rate_pct: SelectionWrapperImpl<
        "success_rate_pct",
        "Int",
        0,
        {},
        undefined
    >;
    type: SelectionWrapperImpl<"type", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapperImpl<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketArraySelectionInput>
    >;
};

export function makeRocketArraySelectionInput(
    this: any,
): ReturnTypeFromRocketArraySelection {
    return {
        active: new SelectionWrapper(
            "active",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        boosters: new SelectionWrapper(
            "boosters",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        company: new SelectionWrapper(
            "company",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        cost_per_launch: new SelectionWrapper(
            "cost_per_launch",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        country: new SelectionWrapper(
            "country",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        description: new SelectionWrapper(
            "description",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        diameter: DistanceSelection.bind({
            collector: this,
            fieldName: "diameter",
        }),
        engines: RocketEnginesSelection.bind({
            collector: this,
            fieldName: "engines",
        }),
        first_flight: new SelectionWrapper(
            "first_flight",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        first_stage: RocketFirstStageSelection.bind({
            collector: this,
            fieldName: "first_stage",
        }),
        height: DistanceSelection.bind({
            collector: this,
            fieldName: "height",
        }),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        landing_legs: RocketLandingLegsSelection.bind({
            collector: this,
            fieldName: "landing_legs",
        }),
        mass: MassSelection.bind({ collector: this, fieldName: "mass" }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        payload_weights: RocketPayloadWeightArraySelection.bind({
            collector: this,
            fieldName: "payload_weights",
        }),
        second_stage: RocketSecondStageSelection.bind({
            collector: this,
            fieldName: "second_stage",
        }),
        stages: new SelectionWrapper("stages", "Int", 0, {}, this, undefined),
        success_rate_pct: new SelectionWrapper(
            "success_rate_pct",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),
        wikipedia: new SelectionWrapper(
            "wikipedia",
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
                makeRocketArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketArraySelectionInput>
            >,
    } as const;
}
export const RocketArraySelection = makeSLFN(
    makeRocketArraySelectionInput,
    "RocketArraySelection",
    "Rocket",
    1,
);

type ReturnTypeFromLaunchpadSelection = {
    attempted_launches: SelectionWrapperImpl<
        "attempted_launches",
        "Int",
        0,
        {},
        undefined
    >;
    details: SelectionWrapperImpl<"details", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    location: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLocationSelectionInput>,
            "LocationSelection",
            "Location",
            0
        >
    >;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    status: SelectionWrapperImpl<"status", "String", 0, {}, undefined>;
    successful_launches: SelectionWrapperImpl<
        "successful_launches",
        "Int",
        0,
        {},
        undefined
    >;
    vehicles_launched: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketArraySelectionInput>,
            "RocketArraySelection",
            "Rocket",
            1
        >
    >;
    wikipedia: SelectionWrapperImpl<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchpadSelectionInput>
    >;
};

export function makeLaunchpadSelectionInput(
    this: any,
): ReturnTypeFromLaunchpadSelection {
    return {
        attempted_launches: new SelectionWrapper(
            "attempted_launches",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        location: LocationSelection.bind({
            collector: this,
            fieldName: "location",
        }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        successful_launches: new SelectionWrapper(
            "successful_launches",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        vehicles_launched: RocketArraySelection.bind({
            collector: this,
            fieldName: "vehicles_launched",
        }),
        wikipedia: new SelectionWrapper(
            "wikipedia",
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
                makeLaunchpadSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchpadSelectionInput>
            >,
    } as const;
}
export const LaunchpadSelection = makeSLFN(
    makeLaunchpadSelectionInput,
    "LaunchpadSelection",
    "Launchpad",
    0,
);

type ReturnTypeFromLaunchpadArraySelection = {
    attempted_launches: SelectionWrapperImpl<
        "attempted_launches",
        "Int",
        0,
        {},
        undefined
    >;
    details: SelectionWrapperImpl<"details", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    location: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLocationSelectionInput>,
            "LocationSelection",
            "Location",
            0
        >
    >;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    status: SelectionWrapperImpl<"status", "String", 0, {}, undefined>;
    successful_launches: SelectionWrapperImpl<
        "successful_launches",
        "Int",
        0,
        {},
        undefined
    >;
    vehicles_launched: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketArraySelectionInput>,
            "RocketArraySelection",
            "Rocket",
            1
        >
    >;
    wikipedia: SelectionWrapperImpl<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchpadArraySelectionInput>
    >;
};

export function makeLaunchpadArraySelectionInput(
    this: any,
): ReturnTypeFromLaunchpadArraySelection {
    return {
        attempted_launches: new SelectionWrapper(
            "attempted_launches",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        location: LocationSelection.bind({
            collector: this,
            fieldName: "location",
        }),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        successful_launches: new SelectionWrapper(
            "successful_launches",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        vehicles_launched: RocketArraySelection.bind({
            collector: this,
            fieldName: "vehicles_launched",
        }),
        wikipedia: new SelectionWrapper(
            "wikipedia",
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
                makeLaunchpadArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchpadArraySelectionInput>
            >,
    } as const;
}
export const LaunchpadArraySelection = makeSLFN(
    makeLaunchpadArraySelectionInput,
    "LaunchpadArraySelection",
    "Launchpad",
    1,
);

type ReturnTypeFromMissionSelection = {
    description: SelectionWrapperImpl<
        "description",
        "String",
        0,
        {},
        undefined
    >;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    manufacturers: SelectionWrapperImpl<
        "manufacturers",
        "String",
        1,
        {},
        undefined
    >;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    payloads: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadArraySelectionInput>,
            "PayloadArraySelection",
            "Payload",
            1
        >
    >;
    twitter: SelectionWrapperImpl<"twitter", "String", 0, {}, undefined>;
    website: SelectionWrapperImpl<"website", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapperImpl<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeMissionSelectionInput>
    >;
};

export function makeMissionSelectionInput(
    this: any,
): ReturnTypeFromMissionSelection {
    return {
        description: new SelectionWrapper(
            "description",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        manufacturers: new SelectionWrapper(
            "manufacturers",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        payloads: PayloadArraySelection.bind({
            collector: this,
            fieldName: "payloads",
        }),
        twitter: new SelectionWrapper(
            "twitter",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        website: new SelectionWrapper(
            "website",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        wikipedia: new SelectionWrapper(
            "wikipedia",
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
                makeMissionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeMissionSelectionInput>
            >,
    } as const;
}
export const MissionSelection = makeSLFN(
    makeMissionSelectionInput,
    "MissionSelection",
    "Mission",
    0,
);

type ReturnTypeFromMissionArraySelection = {
    description: SelectionWrapperImpl<
        "description",
        "String",
        0,
        {},
        undefined
    >;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    manufacturers: SelectionWrapperImpl<
        "manufacturers",
        "String",
        1,
        {},
        undefined
    >;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    payloads: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadArraySelectionInput>,
            "PayloadArraySelection",
            "Payload",
            1
        >
    >;
    twitter: SelectionWrapperImpl<"twitter", "String", 0, {}, undefined>;
    website: SelectionWrapperImpl<"website", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapperImpl<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeMissionArraySelectionInput>
    >;
};

export function makeMissionArraySelectionInput(
    this: any,
): ReturnTypeFromMissionArraySelection {
    return {
        description: new SelectionWrapper(
            "description",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        manufacturers: new SelectionWrapper(
            "manufacturers",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        payloads: PayloadArraySelection.bind({
            collector: this,
            fieldName: "payloads",
        }),
        twitter: new SelectionWrapper(
            "twitter",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        website: new SelectionWrapper(
            "website",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        wikipedia: new SelectionWrapper(
            "wikipedia",
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
                makeMissionArraySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeMissionArraySelectionInput>
            >,
    } as const;
}
export const MissionArraySelection = makeSLFN(
    makeMissionArraySelectionInput,
    "MissionArraySelection",
    "Mission",
    1,
);

type ReturnTypeFromMissionResultSelection = {
    data: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMissionArraySelectionInput>,
            "MissionArraySelection",
            "Mission",
            1
        >
    >;
    result: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResultSelectionInput>,
            "ResultSelection",
            "Result",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeMissionResultSelectionInput(
    this: any,
): ReturnTypeFromMissionResultSelection {
    return {
        data: MissionArraySelection.bind({
            collector: this,
            fieldName: "data",
        }),
        result: ResultSelection.bind({ collector: this, fieldName: "result" }),

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
export const MissionResultSelection = makeSLFN(
    makeMissionResultSelectionInput,
    "MissionResultSelection",
    "MissionResult",
    0,
);

type ReturnTypeFromPayloadSelection = {
    customers: SelectionWrapperImpl<"customers", "String", 1, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    manufacturer: SelectionWrapperImpl<
        "manufacturer",
        "String",
        0,
        {},
        undefined
    >;
    nationality: SelectionWrapperImpl<
        "nationality",
        "String",
        0,
        {},
        undefined
    >;
    norad_id: SelectionWrapperImpl<"norad_id", "Int", 1, {}, undefined>;
    orbit: SelectionWrapperImpl<"orbit", "String", 0, {}, undefined>;
    orbit_params: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadOrbitParamsSelectionInput>,
            "PayloadOrbitParamsSelection",
            "PayloadOrbitParams",
            0
        >
    >;
    payload_mass_kg: SelectionWrapperImpl<
        "payload_mass_kg",
        "Float",
        0,
        {},
        undefined
    >;
    payload_mass_lbs: SelectionWrapperImpl<
        "payload_mass_lbs",
        "Float",
        0,
        {},
        undefined
    >;
    payload_type: SelectionWrapperImpl<
        "payload_type",
        "String",
        0,
        {},
        undefined
    >;
    reused: SelectionWrapperImpl<"reused", "Boolean", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePayloadSelectionInput>
    >;
};

export function makePayloadSelectionInput(
    this: any,
): ReturnTypeFromPayloadSelection {
    return {
        customers: new SelectionWrapper(
            "customers",
            "String",
            1,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        manufacturer: new SelectionWrapper(
            "manufacturer",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        nationality: new SelectionWrapper(
            "nationality",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        norad_id: new SelectionWrapper(
            "norad_id",
            "Int",
            1,
            {},
            this,
            undefined,
        ),
        orbit: new SelectionWrapper("orbit", "String", 0, {}, this, undefined),
        orbit_params: PayloadOrbitParamsSelection.bind({
            collector: this,
            fieldName: "orbit_params",
        }),
        payload_mass_kg: new SelectionWrapper(
            "payload_mass_kg",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        payload_mass_lbs: new SelectionWrapper(
            "payload_mass_lbs",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        payload_type: new SelectionWrapper(
            "payload_type",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        reused: new SelectionWrapper(
            "reused",
            "Boolean",
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
                makePayloadSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePayloadSelectionInput>
            >,
    } as const;
}
export const PayloadSelection = makeSLFN(
    makePayloadSelectionInput,
    "PayloadSelection",
    "Payload",
    0,
);

type ReturnTypeFromRoadsterSelection = {
    apoapsis_au: SelectionWrapperImpl<"apoapsis_au", "Float", 0, {}, undefined>;
    details: SelectionWrapperImpl<"details", "String", 0, {}, undefined>;
    earth_distance_km: SelectionWrapperImpl<
        "earth_distance_km",
        "Float",
        0,
        {},
        undefined
    >;
    earth_distance_mi: SelectionWrapperImpl<
        "earth_distance_mi",
        "Float",
        0,
        {},
        undefined
    >;
    eccentricity: SelectionWrapperImpl<
        "eccentricity",
        "Float",
        0,
        {},
        undefined
    >;
    epoch_jd: SelectionWrapperImpl<"epoch_jd", "Float", 0, {}, undefined>;
    inclination: SelectionWrapperImpl<"inclination", "Float", 0, {}, undefined>;
    launch_date_unix: SelectionWrapperImpl<
        "launch_date_unix",
        "Date",
        0,
        {},
        undefined
    >;
    launch_date_utc: SelectionWrapperImpl<
        "launch_date_utc",
        "Date",
        0,
        {},
        undefined
    >;
    launch_mass_kg: SelectionWrapperImpl<
        "launch_mass_kg",
        "Int",
        0,
        {},
        undefined
    >;
    launch_mass_lbs: SelectionWrapperImpl<
        "launch_mass_lbs",
        "Int",
        0,
        {},
        undefined
    >;
    longitude: SelectionWrapperImpl<"longitude", "Float", 0, {}, undefined>;
    mars_distance_km: SelectionWrapperImpl<
        "mars_distance_km",
        "Float",
        0,
        {},
        undefined
    >;
    mars_distance_mi: SelectionWrapperImpl<
        "mars_distance_mi",
        "Float",
        0,
        {},
        undefined
    >;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    norad_id: SelectionWrapperImpl<"norad_id", "Int", 0, {}, undefined>;
    orbit_type: SelectionWrapperImpl<"orbit_type", "Float", 0, {}, undefined>;
    periapsis_arg: SelectionWrapperImpl<
        "periapsis_arg",
        "Float",
        0,
        {},
        undefined
    >;
    periapsis_au: SelectionWrapperImpl<
        "periapsis_au",
        "Float",
        0,
        {},
        undefined
    >;
    period_days: SelectionWrapperImpl<"period_days", "Float", 0, {}, undefined>;
    semi_major_axis_au: SelectionWrapperImpl<
        "semi_major_axis_au",
        "Float",
        0,
        {},
        undefined
    >;
    speed_kph: SelectionWrapperImpl<"speed_kph", "Float", 0, {}, undefined>;
    speed_mph: SelectionWrapperImpl<"speed_mph", "Float", 0, {}, undefined>;
    wikipedia: SelectionWrapperImpl<"wikipedia", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRoadsterSelectionInput>
    >;
};

export function makeRoadsterSelectionInput(
    this: any,
): ReturnTypeFromRoadsterSelection {
    return {
        apoapsis_au: new SelectionWrapper(
            "apoapsis_au",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        details: new SelectionWrapper(
            "details",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        earth_distance_km: new SelectionWrapper(
            "earth_distance_km",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        earth_distance_mi: new SelectionWrapper(
            "earth_distance_mi",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        eccentricity: new SelectionWrapper(
            "eccentricity",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        epoch_jd: new SelectionWrapper(
            "epoch_jd",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        inclination: new SelectionWrapper(
            "inclination",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_unix: new SelectionWrapper(
            "launch_date_unix",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_date_utc: new SelectionWrapper(
            "launch_date_utc",
            "Date",
            0,
            {},
            this,
            undefined,
        ),
        launch_mass_kg: new SelectionWrapper(
            "launch_mass_kg",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        launch_mass_lbs: new SelectionWrapper(
            "launch_mass_lbs",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        longitude: new SelectionWrapper(
            "longitude",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        mars_distance_km: new SelectionWrapper(
            "mars_distance_km",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        mars_distance_mi: new SelectionWrapper(
            "mars_distance_mi",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        norad_id: new SelectionWrapper(
            "norad_id",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        orbit_type: new SelectionWrapper(
            "orbit_type",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        periapsis_arg: new SelectionWrapper(
            "periapsis_arg",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        periapsis_au: new SelectionWrapper(
            "periapsis_au",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        period_days: new SelectionWrapper(
            "period_days",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        semi_major_axis_au: new SelectionWrapper(
            "semi_major_axis_au",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        speed_kph: new SelectionWrapper(
            "speed_kph",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        speed_mph: new SelectionWrapper(
            "speed_mph",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        wikipedia: new SelectionWrapper(
            "wikipedia",
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
                makeRoadsterSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRoadsterSelectionInput>
            >,
    } as const;
}
export const RoadsterSelection = makeSLFN(
    makeRoadsterSelectionInput,
    "RoadsterSelection",
    "Roadster",
    0,
);

type ReturnTypeFromRocketsResultSelection = {
    data: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketArraySelectionInput>,
            "RocketArraySelection",
            "Rocket",
            1
        >
    >;
    result: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResultSelectionInput>,
            "ResultSelection",
            "Result",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeRocketsResultSelectionInput(
    this: any,
): ReturnTypeFromRocketsResultSelection {
    return {
        data: RocketArraySelection.bind({ collector: this, fieldName: "data" }),
        result: ResultSelection.bind({ collector: this, fieldName: "result" }),

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
export const RocketsResultSelection = makeSLFN(
    makeRocketsResultSelectionInput,
    "RocketsResultSelection",
    "RocketsResult",
    0,
);

type ReturnTypeFromShipSelection = {
    abs: SelectionWrapperImpl<"abs", "Int", 0, {}, undefined>;
    active: SelectionWrapperImpl<"active", "Boolean", 0, {}, undefined>;
    attempted_landings: SelectionWrapperImpl<
        "attempted_landings",
        "Int",
        0,
        {},
        undefined
    >;
    class: SelectionWrapperImpl<"class", "Int", 0, {}, undefined>;
    course_deg: SelectionWrapperImpl<"course_deg", "Int", 0, {}, undefined>;
    home_port: SelectionWrapperImpl<"home_port", "String", 0, {}, undefined>;
    id: SelectionWrapperImpl<"id", "ID", 0, {}, undefined>;
    image: SelectionWrapperImpl<"image", "String", 0, {}, undefined>;
    imo: SelectionWrapperImpl<"imo", "Int", 0, {}, undefined>;
    missions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipMissionArraySelectionInput>,
            "ShipMissionArraySelection",
            "ShipMission",
            1
        >
    >;
    mmsi: SelectionWrapperImpl<"mmsi", "Int", 0, {}, undefined>;
    model: SelectionWrapperImpl<"model", "String", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    position: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipLocationSelectionInput>,
            "ShipLocationSelection",
            "ShipLocation",
            0
        >
    >;
    roles: SelectionWrapperImpl<"roles", "String", 1, {}, undefined>;
    speed_kn: SelectionWrapperImpl<"speed_kn", "Float", 0, {}, undefined>;
    status: SelectionWrapperImpl<"status", "String", 0, {}, undefined>;
    successful_landings: SelectionWrapperImpl<
        "successful_landings",
        "Int",
        0,
        {},
        undefined
    >;
    type: SelectionWrapperImpl<"type", "String", 0, {}, undefined>;
    url: SelectionWrapperImpl<"url", "String", 0, {}, undefined>;
    weight_kg: SelectionWrapperImpl<"weight_kg", "Int", 0, {}, undefined>;
    weight_lbs: SelectionWrapperImpl<"weight_lbs", "Int", 0, {}, undefined>;
    year_built: SelectionWrapperImpl<"year_built", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipSelectionInput>
    >;
};

export function makeShipSelectionInput(this: any): ReturnTypeFromShipSelection {
    return {
        abs: new SelectionWrapper("abs", "Int", 0, {}, this, undefined),
        active: new SelectionWrapper(
            "active",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        attempted_landings: new SelectionWrapper(
            "attempted_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        class: new SelectionWrapper("class", "Int", 0, {}, this, undefined),
        course_deg: new SelectionWrapper(
            "course_deg",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        home_port: new SelectionWrapper(
            "home_port",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        id: new SelectionWrapper("id", "ID", 0, {}, this, undefined),
        image: new SelectionWrapper("image", "String", 0, {}, this, undefined),
        imo: new SelectionWrapper("imo", "Int", 0, {}, this, undefined),
        missions: ShipMissionArraySelection.bind({
            collector: this,
            fieldName: "missions",
        }),
        mmsi: new SelectionWrapper("mmsi", "Int", 0, {}, this, undefined),
        model: new SelectionWrapper("model", "String", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        position: ShipLocationSelection.bind({
            collector: this,
            fieldName: "position",
        }),
        roles: new SelectionWrapper("roles", "String", 1, {}, this, undefined),
        speed_kn: new SelectionWrapper(
            "speed_kn",
            "Float",
            0,
            {},
            this,
            undefined,
        ),
        status: new SelectionWrapper(
            "status",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        successful_landings: new SelectionWrapper(
            "successful_landings",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),
        url: new SelectionWrapper("url", "String", 0, {}, this, undefined),
        weight_kg: new SelectionWrapper(
            "weight_kg",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        weight_lbs: new SelectionWrapper(
            "weight_lbs",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        year_built: new SelectionWrapper(
            "year_built",
            "Int",
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
                makeShipSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeShipSelectionInput>>,
    } as const;
}
export const ShipSelection = makeSLFN(
    makeShipSelectionInput,
    "ShipSelection",
    "Ship",
    0,
);

type ReturnTypeFromShipsResultSelection = {
    data: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipArraySelectionInput>,
            "ShipArraySelection",
            "Ship",
            1
        >
    >;
    result: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeResultSelectionInput>,
            "ResultSelection",
            "Result",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeShipsResultSelectionInput(
    this: any,
): ReturnTypeFromShipsResultSelection {
    return {
        data: ShipArraySelection.bind({ collector: this, fieldName: "data" }),
        result: ResultSelection.bind({ collector: this, fieldName: "result" }),

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
export const ShipsResultSelection = makeSLFN(
    makeShipsResultSelectionInput,
    "ShipsResultSelection",
    "ShipsResult",
    0,
);

type ReturnTypeFromusersNotNullArrayNotNullSelection = {
    id: SelectionWrapperImpl<"id", "uuid", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    rocket: SelectionWrapperImpl<"rocket", "String", 0, {}, undefined>;
    timestamp: SelectionWrapperImpl<
        "timestamp",
        "timestamptz",
        0,
        {},
        undefined
    >;
    twitter: SelectionWrapperImpl<"twitter", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>
    >;
};

export function makeusersNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromusersNotNullArrayNotNullSelection {
    return {
        id: new SelectionWrapper("id", "uuid", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        rocket: new SelectionWrapper(
            "rocket",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        timestamp: new SelectionWrapper(
            "timestamp",
            "timestamptz",
            0,
            {},
            this,
            undefined,
        ),
        twitter: new SelectionWrapper(
            "twitter",
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
                makeusersNotNullArrayNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>
            >,
    } as const;
}
export const usersNotNullArrayNotNullSelection = makeSLFN(
    makeusersNotNullArrayNotNullSelectionInput,
    "usersNotNullArrayNotNullSelection",
    "users",
    1,
);

type ReturnTypeFromusers_aggregate_fieldsSelection = {
    count: (
        args: users_aggregate_fieldsCountArgs,
    ) => SelectionWrapperImpl<
        "count",
        "Int",
        0,
        {},
        users_aggregate_fieldsCountArgs
    >;
    max: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_max_fieldsSelectionInput>,
            "users_max_fieldsSelection",
            "users_max_fields",
            0
        >
    >;
    min: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_min_fieldsSelectionInput>,
            "users_min_fieldsSelection",
            "users_min_fields",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusers_aggregate_fieldsSelectionInput>
    >;
};

export function makeusers_aggregate_fieldsSelectionInput(
    this: any,
): ReturnTypeFromusers_aggregate_fieldsSelection {
    return {
        count: (args: users_aggregate_fieldsCountArgs) =>
            new SelectionWrapper(
                "count",
                "Int",
                0,
                {},
                this,
                undefined,
                args,
                users_aggregate_fieldsCountArgsMeta,
            ),
        max: users_max_fieldsSelection.bind({
            collector: this,
            fieldName: "max",
        }),
        min: users_min_fieldsSelection.bind({
            collector: this,
            fieldName: "min",
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
                makeusers_aggregate_fieldsSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusers_aggregate_fieldsSelectionInput>
            >,
    } as const;
}
export const users_aggregate_fieldsSelection = makeSLFN(
    makeusers_aggregate_fieldsSelectionInput,
    "users_aggregate_fieldsSelection",
    "users_aggregate_fields",
    0,
);

type ReturnTypeFromusers_max_fieldsSelection = {
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    rocket: SelectionWrapperImpl<"rocket", "String", 0, {}, undefined>;
    timestamp: SelectionWrapperImpl<
        "timestamp",
        "timestamptz",
        0,
        {},
        undefined
    >;
    twitter: SelectionWrapperImpl<"twitter", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusers_max_fieldsSelectionInput>
    >;
};

export function makeusers_max_fieldsSelectionInput(
    this: any,
): ReturnTypeFromusers_max_fieldsSelection {
    return {
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        rocket: new SelectionWrapper(
            "rocket",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        timestamp: new SelectionWrapper(
            "timestamp",
            "timestamptz",
            0,
            {},
            this,
            undefined,
        ),
        twitter: new SelectionWrapper(
            "twitter",
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
                makeusers_max_fieldsSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusers_max_fieldsSelectionInput>
            >,
    } as const;
}
export const users_max_fieldsSelection = makeSLFN(
    makeusers_max_fieldsSelectionInput,
    "users_max_fieldsSelection",
    "users_max_fields",
    0,
);

type ReturnTypeFromusers_min_fieldsSelection = {
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    rocket: SelectionWrapperImpl<"rocket", "String", 0, {}, undefined>;
    timestamp: SelectionWrapperImpl<
        "timestamp",
        "timestamptz",
        0,
        {},
        undefined
    >;
    twitter: SelectionWrapperImpl<"twitter", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusers_min_fieldsSelectionInput>
    >;
};

export function makeusers_min_fieldsSelectionInput(
    this: any,
): ReturnTypeFromusers_min_fieldsSelection {
    return {
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        rocket: new SelectionWrapper(
            "rocket",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        timestamp: new SelectionWrapper(
            "timestamp",
            "timestamptz",
            0,
            {},
            this,
            undefined,
        ),
        twitter: new SelectionWrapper(
            "twitter",
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
                makeusers_min_fieldsSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusers_min_fieldsSelectionInput>
            >,
    } as const;
}
export const users_min_fieldsSelection = makeSLFN(
    makeusers_min_fieldsSelectionInput,
    "users_min_fieldsSelection",
    "users_min_fields",
    0,
);

type ReturnTypeFromusers_aggregateNotNullSelection = {
    aggregate: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_aggregate_fieldsSelectionInput>,
            "users_aggregate_fieldsSelection",
            "users_aggregate_fields",
            0
        >
    >;
    nodes: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>,
            "usersNotNullArrayNotNullSelection",
            "users",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeusers_aggregateNotNullSelectionInput(
    this: any,
): ReturnTypeFromusers_aggregateNotNullSelection {
    return {
        aggregate: users_aggregate_fieldsSelection.bind({
            collector: this,
            fieldName: "aggregate",
        }),
        nodes: usersNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "nodes",
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
export const users_aggregateNotNullSelection = makeSLFN(
    makeusers_aggregateNotNullSelectionInput,
    "users_aggregateNotNullSelection",
    "users_aggregate",
    0,
);

type ReturnTypeFromusersSelection = {
    id: SelectionWrapperImpl<"id", "uuid", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    rocket: SelectionWrapperImpl<"rocket", "String", 0, {}, undefined>;
    timestamp: SelectionWrapperImpl<
        "timestamp",
        "timestamptz",
        0,
        {},
        undefined
    >;
    twitter: SelectionWrapperImpl<"twitter", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusersSelectionInput>
    >;
};

export function makeusersSelectionInput(
    this: any,
): ReturnTypeFromusersSelection {
    return {
        id: new SelectionWrapper("id", "uuid", 0, {}, this, undefined),
        name: new SelectionWrapper("name", "String", 0, {}, this, undefined),
        rocket: new SelectionWrapper(
            "rocket",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        timestamp: new SelectionWrapper(
            "timestamp",
            "timestamptz",
            0,
            {},
            this,
            undefined,
        ),
        twitter: new SelectionWrapper(
            "twitter",
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
                makeusersSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeusersSelectionInput>>,
    } as const;
}
export const usersSelection = makeSLFN(
    makeusersSelectionInput,
    "usersSelection",
    "users",
    0,
);

type ReturnTypeFrom_ServiceNotNullSelection = {
    sdl: SelectionWrapperImpl<"sdl", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof make_ServiceNotNullSelectionInput>
    >;
};

export function make_ServiceNotNullSelectionInput(
    this: any,
): ReturnTypeFrom_ServiceNotNullSelection {
    return {
        sdl: new SelectionWrapper("sdl", "String", 0, {}, this, undefined),

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
                make_ServiceNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof make_ServiceNotNullSelectionInput>
            >,
    } as const;
}
export const _ServiceNotNullSelection = makeSLFN(
    make_ServiceNotNullSelectionInput,
    "_ServiceNotNullSelection",
    "_Service",
    0,
);

type ReturnTypeFromusers_mutation_responseSelection = {
    affected_rows: SelectionWrapperImpl<
        "affected_rows",
        "Int",
        0,
        {},
        undefined
    >;
    returning: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>,
            "usersNotNullArrayNotNullSelection",
            "users",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusers_mutation_responseSelectionInput>
    >;
};

export function makeusers_mutation_responseSelectionInput(
    this: any,
): ReturnTypeFromusers_mutation_responseSelection {
    return {
        affected_rows: new SelectionWrapper(
            "affected_rows",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        returning: usersNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "returning",
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
                makeusers_mutation_responseSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusers_mutation_responseSelectionInput>
            >,
    } as const;
}
export const users_mutation_responseSelection = makeSLFN(
    makeusers_mutation_responseSelectionInput,
    "users_mutation_responseSelection",
    "users_mutation_response",
    0,
);

type ReturnTypeFromCapsuleMissionSelection = {
    flight: SelectionWrapperImpl<"flight", "Int", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCapsuleMissionSelectionInput>
    >;
};

export function makeCapsuleMissionSelectionInput(
    this: any,
): ReturnTypeFromCapsuleMissionSelection {
    return {
        flight: new SelectionWrapper("flight", "Int", 0, {}, this, undefined),
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
                makeCapsuleMissionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCapsuleMissionSelectionInput>
            >,
    } as const;
}
export const CapsuleMissionSelection = makeSLFN(
    makeCapsuleMissionSelectionInput,
    "CapsuleMissionSelection",
    "CapsuleMission",
    0,
);

type ReturnTypeFromCoreMissionSelection = {
    flight: SelectionWrapperImpl<"flight", "Int", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCoreMissionSelectionInput>
    >;
};

export function makeCoreMissionSelectionInput(
    this: any,
): ReturnTypeFromCoreMissionSelection {
    return {
        flight: new SelectionWrapper("flight", "Int", 0, {}, this, undefined),
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
                makeCoreMissionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCoreMissionSelectionInput>
            >,
    } as const;
}
export const CoreMissionSelection = makeSLFN(
    makeCoreMissionSelectionInput,
    "CoreMissionSelection",
    "CoreMission",
    0,
);

type ReturnTypeFromDragonThrustSelection = {
    amount: SelectionWrapperImpl<"amount", "Int", 0, {}, undefined>;
    fuel_1: SelectionWrapperImpl<"fuel_1", "String", 0, {}, undefined>;
    fuel_2: SelectionWrapperImpl<"fuel_2", "String", 0, {}, undefined>;
    pods: SelectionWrapperImpl<"pods", "Int", 0, {}, undefined>;
    thrust: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeForceSelectionInput>,
            "ForceSelection",
            "Force",
            0
        >
    >;
    type: SelectionWrapperImpl<"type", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonThrustSelectionInput>
    >;
};

export function makeDragonThrustSelectionInput(
    this: any,
): ReturnTypeFromDragonThrustSelection {
    return {
        amount: new SelectionWrapper("amount", "Int", 0, {}, this, undefined),
        fuel_1: new SelectionWrapper(
            "fuel_1",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        fuel_2: new SelectionWrapper(
            "fuel_2",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        pods: new SelectionWrapper("pods", "Int", 0, {}, this, undefined),
        thrust: ForceSelection.bind({ collector: this, fieldName: "thrust" }),
        type: new SelectionWrapper("type", "String", 0, {}, this, undefined),

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
                makeDragonThrustSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonThrustSelectionInput>
            >,
    } as const;
}
export const DragonThrustSelection = makeSLFN(
    makeDragonThrustSelectionInput,
    "DragonThrustSelection",
    "DragonThrust",
    0,
);

type ReturnTypeFromLaunchRocketFirstStageCoreSelection = {
    block: SelectionWrapperImpl<"block", "Int", 0, {}, undefined>;
    core: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreSelectionInput>,
            "CoreSelection",
            "Core",
            0
        >
    >;
    flight: SelectionWrapperImpl<"flight", "Int", 0, {}, undefined>;
    gridfins: SelectionWrapperImpl<"gridfins", "Boolean", 0, {}, undefined>;
    land_success: SelectionWrapperImpl<
        "land_success",
        "Boolean",
        0,
        {},
        undefined
    >;
    landing_intent: SelectionWrapperImpl<
        "landing_intent",
        "Boolean",
        0,
        {},
        undefined
    >;
    landing_type: SelectionWrapperImpl<
        "landing_type",
        "String",
        0,
        {},
        undefined
    >;
    landing_vehicle: SelectionWrapperImpl<
        "landing_vehicle",
        "String",
        0,
        {},
        undefined
    >;
    legs: SelectionWrapperImpl<"legs", "Boolean", 0, {}, undefined>;
    reused: SelectionWrapperImpl<"reused", "Boolean", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketFirstStageCoreSelectionInput>
    >;
};

export function makeLaunchRocketFirstStageCoreSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketFirstStageCoreSelection {
    return {
        block: new SelectionWrapper("block", "Int", 0, {}, this, undefined),
        core: CoreSelection.bind({ collector: this, fieldName: "core" }),
        flight: new SelectionWrapper("flight", "Int", 0, {}, this, undefined),
        gridfins: new SelectionWrapper(
            "gridfins",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        land_success: new SelectionWrapper(
            "land_success",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        landing_intent: new SelectionWrapper(
            "landing_intent",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        landing_type: new SelectionWrapper(
            "landing_type",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        landing_vehicle: new SelectionWrapper(
            "landing_vehicle",
            "String",
            0,
            {},
            this,
            undefined,
        ),
        legs: new SelectionWrapper("legs", "Boolean", 0, {}, this, undefined),
        reused: new SelectionWrapper(
            "reused",
            "Boolean",
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
                makeLaunchRocketFirstStageCoreSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchRocketFirstStageCoreSelectionInput>
            >,
    } as const;
}
export const LaunchRocketFirstStageCoreSelection = makeSLFN(
    makeLaunchRocketFirstStageCoreSelectionInput,
    "LaunchRocketFirstStageCoreSelection",
    "LaunchRocketFirstStageCore",
    0,
);

type ReturnTypeFromMutationSelection = {
    delete_users: (args: MutationDelete_usersArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_mutation_responseSelectionInput>,
            "users_mutation_responseSelection",
            "users_mutation_response",
            0,
            {
                $lazy: (args: MutationDelete_usersArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    insert_users: (args: MutationInsert_usersArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_mutation_responseSelectionInput>,
            "users_mutation_responseSelection",
            "users_mutation_response",
            0,
            {
                $lazy: (args: MutationInsert_usersArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    update_users: (args: MutationUpdate_usersArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_mutation_responseSelectionInput>,
            "users_mutation_responseSelection",
            "users_mutation_response",
            0,
            {
                $lazy: (args: MutationUpdate_usersArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeMutationSelectionInput(
    this: any,
): ReturnTypeFromMutationSelection {
    return {
        delete_users: (args: MutationDelete_usersArgs) =>
            users_mutation_responseSelection.bind({
                collector: this,
                fieldName: "delete_users",
                args,
                argsMeta: MutationDelete_usersArgsMeta,
            }),
        insert_users: (args: MutationInsert_usersArgs) =>
            users_mutation_responseSelection.bind({
                collector: this,
                fieldName: "insert_users",
                args,
                argsMeta: MutationInsert_usersArgsMeta,
            }),
        update_users: (args: MutationUpdate_usersArgs) =>
            users_mutation_responseSelection.bind({
                collector: this,
                fieldName: "update_users",
                args,
                argsMeta: MutationUpdate_usersArgsMeta,
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
export const MutationSelection = makeSLFN(
    makeMutationSelectionInput,
    "MutationSelection",
    "Mutation",
    0,
);

type ReturnTypeFromQuerySelection = {
    capsule: (args: QueryCapsuleArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleSelectionInput>,
            "CapsuleSelection",
            "Capsule",
            0,
            {
                $lazy: (args: QueryCapsuleArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    capsules: (args: QueryCapsulesArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleArraySelectionInput>,
            "CapsuleArraySelection",
            "Capsule",
            1,
            {
                $lazy: (args: QueryCapsulesArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    capsulesPast: (args: QueryCapsulesPastArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleArraySelectionInput>,
            "CapsuleArraySelection",
            "Capsule",
            1,
            {
                $lazy: (args: QueryCapsulesPastArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    capsulesUpcoming: (args: QueryCapsulesUpcomingArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleArraySelectionInput>,
            "CapsuleArraySelection",
            "Capsule",
            1,
            {
                $lazy: (args: QueryCapsulesUpcomingArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    company: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeInfoSelectionInput>,
            "InfoSelection",
            "Info",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    core: (args: QueryCoreArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreSelectionInput>,
            "CoreSelection",
            "Core",
            0,
            {
                $lazy: (args: QueryCoreArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    cores: (args: QueryCoresArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreArraySelectionInput>,
            "CoreArraySelection",
            "Core",
            1,
            {
                $lazy: (args: QueryCoresArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    coresPast: (args: QueryCoresPastArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreArraySelectionInput>,
            "CoreArraySelection",
            "Core",
            1,
            {
                $lazy: (args: QueryCoresPastArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    coresUpcoming: (args: QueryCoresUpcomingArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreArraySelectionInput>,
            "CoreArraySelection",
            "Core",
            1,
            {
                $lazy: (args: QueryCoresUpcomingArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    dragon: (args: QueryDragonArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonSelectionInput>,
            "DragonSelection",
            "Dragon",
            0,
            {
                $lazy: (args: QueryDragonArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    dragons: (args: QueryDragonsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonArraySelectionInput>,
            "DragonArraySelection",
            "Dragon",
            1,
            {
                $lazy: (args: QueryDragonsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    histories: (args: QueryHistoriesArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeHistoryArraySelectionInput>,
            "HistoryArraySelection",
            "History",
            1,
            {
                $lazy: (args: QueryHistoriesArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    historiesResult: (args: QueryHistoriesResultArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeHistoriesResultSelectionInput>,
            "HistoriesResultSelection",
            "HistoriesResult",
            0,
            {
                $lazy: (args: QueryHistoriesResultArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    history: (args: QueryHistoryArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeHistorySelectionInput>,
            "HistorySelection",
            "History",
            0,
            {
                $lazy: (args: QueryHistoryArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    landpad: (args: QueryLandpadArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLandpadSelectionInput>,
            "LandpadSelection",
            "Landpad",
            0,
            {
                $lazy: (args: QueryLandpadArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    landpads: (args: QueryLandpadsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLandpadArraySelectionInput>,
            "LandpadArraySelection",
            "Landpad",
            1,
            {
                $lazy: (args: QueryLandpadsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launch: (args: QueryLaunchArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSelectionInput>,
            "LaunchSelection",
            "Launch",
            0,
            {
                $lazy: (args: QueryLaunchArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launchLatest: (args: QueryLaunchLatestArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSelectionInput>,
            "LaunchSelection",
            "Launch",
            0,
            {
                $lazy: (args: QueryLaunchLatestArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launchNext: (args: QueryLaunchNextArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSelectionInput>,
            "LaunchSelection",
            "Launch",
            0,
            {
                $lazy: (args: QueryLaunchNextArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launches: (args: QueryLaunchesArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchArraySelectionInput>,
            "LaunchArraySelection",
            "Launch",
            1,
            {
                $lazy: (args: QueryLaunchesArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launchesPast: (args: QueryLaunchesPastArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchArraySelectionInput>,
            "LaunchArraySelection",
            "Launch",
            1,
            {
                $lazy: (args: QueryLaunchesPastArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launchesPastResult: (args: QueryLaunchesPastResultArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchesPastResultSelectionInput>,
            "LaunchesPastResultSelection",
            "LaunchesPastResult",
            0,
            {
                $lazy: (args: QueryLaunchesPastResultArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launchesUpcoming: (args: QueryLaunchesUpcomingArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchArraySelectionInput>,
            "LaunchArraySelection",
            "Launch",
            1,
            {
                $lazy: (args: QueryLaunchesUpcomingArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launchpad: (args: QueryLaunchpadArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchpadSelectionInput>,
            "LaunchpadSelection",
            "Launchpad",
            0,
            {
                $lazy: (args: QueryLaunchpadArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    launchpads: (args: QueryLaunchpadsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchpadArraySelectionInput>,
            "LaunchpadArraySelection",
            "Launchpad",
            1,
            {
                $lazy: (args: QueryLaunchpadsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    mission: (args: QueryMissionArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMissionSelectionInput>,
            "MissionSelection",
            "Mission",
            0,
            {
                $lazy: (args: QueryMissionArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    missions: (args: QueryMissionsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMissionArraySelectionInput>,
            "MissionArraySelection",
            "Mission",
            1,
            {
                $lazy: (args: QueryMissionsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    missionsResult: (args: QueryMissionsResultArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMissionResultSelectionInput>,
            "MissionResultSelection",
            "MissionResult",
            0,
            {
                $lazy: (args: QueryMissionsResultArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    payload: (args: QueryPayloadArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadSelectionInput>,
            "PayloadSelection",
            "Payload",
            0,
            {
                $lazy: (args: QueryPayloadArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    payloads: (args: QueryPayloadsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadArraySelectionInput>,
            "PayloadArraySelection",
            "Payload",
            1,
            {
                $lazy: (args: QueryPayloadsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    roadster: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRoadsterSelectionInput>,
            "RoadsterSelection",
            "Roadster",
            0,
            {
                $lazy: () => Promise<"T">;
            },
            "$lazy"
        >
    >;
    rocket: (args: QueryRocketArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketSelectionInput>,
            "RocketSelection",
            "Rocket",
            0,
            {
                $lazy: (args: QueryRocketArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    rockets: (args: QueryRocketsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketArraySelectionInput>,
            "RocketArraySelection",
            "Rocket",
            1,
            {
                $lazy: (args: QueryRocketsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    rocketsResult: (args: QueryRocketsResultArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketsResultSelectionInput>,
            "RocketsResultSelection",
            "RocketsResult",
            0,
            {
                $lazy: (args: QueryRocketsResultArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    ship: (args: QueryShipArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipSelectionInput>,
            "ShipSelection",
            "Ship",
            0,
            {
                $lazy: (args: QueryShipArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    ships: (args: QueryShipsArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipArraySelectionInput>,
            "ShipArraySelection",
            "Ship",
            1,
            {
                $lazy: (args: QueryShipsArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    shipsResult: (args: QueryShipsResultArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipsResultSelectionInput>,
            "ShipsResultSelection",
            "ShipsResult",
            0,
            {
                $lazy: (args: QueryShipsResultArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    users: (args: QueryUsersArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>,
            "usersNotNullArrayNotNullSelection",
            "users",
            1,
            {
                $lazy: (args: QueryUsersArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    users_aggregate: (args: QueryUsers_aggregateArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_aggregateNotNullSelectionInput>,
            "users_aggregateNotNullSelection",
            "users_aggregate",
            0,
            {
                $lazy: (args: QueryUsers_aggregateArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    users_by_pk: (args: QueryUsers_by_pkArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersSelectionInput>,
            "usersSelection",
            "users",
            0,
            {
                $lazy: (args: QueryUsers_by_pkArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    _service: ReturnType<
        SLFN<
            {},
            ReturnType<typeof make_ServiceNotNullSelectionInput>,
            "_ServiceNotNullSelection",
            "_Service",
            0,
            {
                $lazy: () => Promise<"T">;
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
        capsule: (args: QueryCapsuleArgs) =>
            CapsuleSelection.bind({
                collector: this,
                fieldName: "capsule",
                args,
                argsMeta: QueryCapsuleArgsMeta,
            }),
        capsules: (args: QueryCapsulesArgs) =>
            CapsuleArraySelection.bind({
                collector: this,
                fieldName: "capsules",
                args,
                argsMeta: QueryCapsulesArgsMeta,
            }),
        capsulesPast: (args: QueryCapsulesPastArgs) =>
            CapsuleArraySelection.bind({
                collector: this,
                fieldName: "capsulesPast",
                args,
                argsMeta: QueryCapsulesPastArgsMeta,
            }),
        capsulesUpcoming: (args: QueryCapsulesUpcomingArgs) =>
            CapsuleArraySelection.bind({
                collector: this,
                fieldName: "capsulesUpcoming",
                args,
                argsMeta: QueryCapsulesUpcomingArgsMeta,
            }),
        company: InfoSelection.bind({ collector: this, fieldName: "company" }),
        core: (args: QueryCoreArgs) =>
            CoreSelection.bind({
                collector: this,
                fieldName: "core",
                args,
                argsMeta: QueryCoreArgsMeta,
            }),
        cores: (args: QueryCoresArgs) =>
            CoreArraySelection.bind({
                collector: this,
                fieldName: "cores",
                args,
                argsMeta: QueryCoresArgsMeta,
            }),
        coresPast: (args: QueryCoresPastArgs) =>
            CoreArraySelection.bind({
                collector: this,
                fieldName: "coresPast",
                args,
                argsMeta: QueryCoresPastArgsMeta,
            }),
        coresUpcoming: (args: QueryCoresUpcomingArgs) =>
            CoreArraySelection.bind({
                collector: this,
                fieldName: "coresUpcoming",
                args,
                argsMeta: QueryCoresUpcomingArgsMeta,
            }),
        dragon: (args: QueryDragonArgs) =>
            DragonSelection.bind({
                collector: this,
                fieldName: "dragon",
                args,
                argsMeta: QueryDragonArgsMeta,
            }),
        dragons: (args: QueryDragonsArgs) =>
            DragonArraySelection.bind({
                collector: this,
                fieldName: "dragons",
                args,
                argsMeta: QueryDragonsArgsMeta,
            }),
        histories: (args: QueryHistoriesArgs) =>
            HistoryArraySelection.bind({
                collector: this,
                fieldName: "histories",
                args,
                argsMeta: QueryHistoriesArgsMeta,
            }),
        historiesResult: (args: QueryHistoriesResultArgs) =>
            HistoriesResultSelection.bind({
                collector: this,
                fieldName: "historiesResult",
                args,
                argsMeta: QueryHistoriesResultArgsMeta,
            }),
        history: (args: QueryHistoryArgs) =>
            HistorySelection.bind({
                collector: this,
                fieldName: "history",
                args,
                argsMeta: QueryHistoryArgsMeta,
            }),
        landpad: (args: QueryLandpadArgs) =>
            LandpadSelection.bind({
                collector: this,
                fieldName: "landpad",
                args,
                argsMeta: QueryLandpadArgsMeta,
            }),
        landpads: (args: QueryLandpadsArgs) =>
            LandpadArraySelection.bind({
                collector: this,
                fieldName: "landpads",
                args,
                argsMeta: QueryLandpadsArgsMeta,
            }),
        launch: (args: QueryLaunchArgs) =>
            LaunchSelection.bind({
                collector: this,
                fieldName: "launch",
                args,
                argsMeta: QueryLaunchArgsMeta,
            }),
        launchLatest: (args: QueryLaunchLatestArgs) =>
            LaunchSelection.bind({
                collector: this,
                fieldName: "launchLatest",
                args,
                argsMeta: QueryLaunchLatestArgsMeta,
            }),
        launchNext: (args: QueryLaunchNextArgs) =>
            LaunchSelection.bind({
                collector: this,
                fieldName: "launchNext",
                args,
                argsMeta: QueryLaunchNextArgsMeta,
            }),
        launches: (args: QueryLaunchesArgs) =>
            LaunchArraySelection.bind({
                collector: this,
                fieldName: "launches",
                args,
                argsMeta: QueryLaunchesArgsMeta,
            }),
        launchesPast: (args: QueryLaunchesPastArgs) =>
            LaunchArraySelection.bind({
                collector: this,
                fieldName: "launchesPast",
                args,
                argsMeta: QueryLaunchesPastArgsMeta,
            }),
        launchesPastResult: (args: QueryLaunchesPastResultArgs) =>
            LaunchesPastResultSelection.bind({
                collector: this,
                fieldName: "launchesPastResult",
                args,
                argsMeta: QueryLaunchesPastResultArgsMeta,
            }),
        launchesUpcoming: (args: QueryLaunchesUpcomingArgs) =>
            LaunchArraySelection.bind({
                collector: this,
                fieldName: "launchesUpcoming",
                args,
                argsMeta: QueryLaunchesUpcomingArgsMeta,
            }),
        launchpad: (args: QueryLaunchpadArgs) =>
            LaunchpadSelection.bind({
                collector: this,
                fieldName: "launchpad",
                args,
                argsMeta: QueryLaunchpadArgsMeta,
            }),
        launchpads: (args: QueryLaunchpadsArgs) =>
            LaunchpadArraySelection.bind({
                collector: this,
                fieldName: "launchpads",
                args,
                argsMeta: QueryLaunchpadsArgsMeta,
            }),
        mission: (args: QueryMissionArgs) =>
            MissionSelection.bind({
                collector: this,
                fieldName: "mission",
                args,
                argsMeta: QueryMissionArgsMeta,
            }),
        missions: (args: QueryMissionsArgs) =>
            MissionArraySelection.bind({
                collector: this,
                fieldName: "missions",
                args,
                argsMeta: QueryMissionsArgsMeta,
            }),
        missionsResult: (args: QueryMissionsResultArgs) =>
            MissionResultSelection.bind({
                collector: this,
                fieldName: "missionsResult",
                args,
                argsMeta: QueryMissionsResultArgsMeta,
            }),
        payload: (args: QueryPayloadArgs) =>
            PayloadSelection.bind({
                collector: this,
                fieldName: "payload",
                args,
                argsMeta: QueryPayloadArgsMeta,
            }),
        payloads: (args: QueryPayloadsArgs) =>
            PayloadArraySelection.bind({
                collector: this,
                fieldName: "payloads",
                args,
                argsMeta: QueryPayloadsArgsMeta,
            }),
        roadster: RoadsterSelection.bind({
            collector: this,
            fieldName: "roadster",
        }),
        rocket: (args: QueryRocketArgs) =>
            RocketSelection.bind({
                collector: this,
                fieldName: "rocket",
                args,
                argsMeta: QueryRocketArgsMeta,
            }),
        rockets: (args: QueryRocketsArgs) =>
            RocketArraySelection.bind({
                collector: this,
                fieldName: "rockets",
                args,
                argsMeta: QueryRocketsArgsMeta,
            }),
        rocketsResult: (args: QueryRocketsResultArgs) =>
            RocketsResultSelection.bind({
                collector: this,
                fieldName: "rocketsResult",
                args,
                argsMeta: QueryRocketsResultArgsMeta,
            }),
        ship: (args: QueryShipArgs) =>
            ShipSelection.bind({
                collector: this,
                fieldName: "ship",
                args,
                argsMeta: QueryShipArgsMeta,
            }),
        ships: (args: QueryShipsArgs) =>
            ShipArraySelection.bind({
                collector: this,
                fieldName: "ships",
                args,
                argsMeta: QueryShipsArgsMeta,
            }),
        shipsResult: (args: QueryShipsResultArgs) =>
            ShipsResultSelection.bind({
                collector: this,
                fieldName: "shipsResult",
                args,
                argsMeta: QueryShipsResultArgsMeta,
            }),
        users: (args: QueryUsersArgs) =>
            usersNotNullArrayNotNullSelection.bind({
                collector: this,
                fieldName: "users",
                args,
                argsMeta: QueryUsersArgsMeta,
            }),
        users_aggregate: (args: QueryUsers_aggregateArgs) =>
            users_aggregateNotNullSelection.bind({
                collector: this,
                fieldName: "users_aggregate",
                args,
                argsMeta: QueryUsers_aggregateArgsMeta,
            }),
        users_by_pk: (args: QueryUsers_by_pkArgs) =>
            usersSelection.bind({
                collector: this,
                fieldName: "users_by_pk",
                args,
                argsMeta: QueryUsers_by_pkArgsMeta,
            }),
        _service: _ServiceNotNullSelection.bind({
            collector: this,
            fieldName: "_service",
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

type ReturnTypeFromRocketPayloadWeightSelection = {
    id: SelectionWrapperImpl<"id", "String", 0, {}, undefined>;
    kg: SelectionWrapperImpl<"kg", "Int", 0, {}, undefined>;
    lb: SelectionWrapperImpl<"lb", "Int", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketPayloadWeightSelectionInput>
    >;
};

export function makeRocketPayloadWeightSelectionInput(
    this: any,
): ReturnTypeFromRocketPayloadWeightSelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        kg: new SelectionWrapper("kg", "Int", 0, {}, this, undefined),
        lb: new SelectionWrapper("lb", "Int", 0, {}, this, undefined),
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
                makeRocketPayloadWeightSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketPayloadWeightSelectionInput>
            >,
    } as const;
}
export const RocketPayloadWeightSelection = makeSLFN(
    makeRocketPayloadWeightSelectionInput,
    "RocketPayloadWeightSelection",
    "RocketPayloadWeight",
    0,
);

type ReturnTypeFromShipMissionSelection = {
    flight: SelectionWrapperImpl<"flight", "String", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipMissionSelectionInput>
    >;
};

export function makeShipMissionSelectionInput(
    this: any,
): ReturnTypeFromShipMissionSelection {
    return {
        flight: new SelectionWrapper(
            "flight",
            "String",
            0,
            {},
            this,
            undefined,
        ),
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
                makeShipMissionSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeShipMissionSelectionInput>
            >,
    } as const;
}
export const ShipMissionSelection = makeSLFN(
    makeShipMissionSelectionInput,
    "ShipMissionSelection",
    "ShipMission",
    0,
);

type ReturnTypeFromSubscriptionSelection = {
    users: (args: SubscriptionUsersArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>,
            "usersNotNullArrayNotNullSelection",
            "users",
            1,
            {
                $lazy: (args: SubscriptionUsersArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    users_aggregate: (args: SubscriptionUsers_aggregateArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_aggregateNotNullSelectionInput>,
            "users_aggregateNotNullSelection",
            "users_aggregate",
            0,
            {
                $lazy: (args: SubscriptionUsers_aggregateArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    users_by_pk: (args: SubscriptionUsers_by_pkArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersSelectionInput>,
            "usersSelection",
            "users",
            0,
            {
                $lazy: (args: SubscriptionUsers_by_pkArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeSubscriptionSelectionInput(
    this: any,
): ReturnTypeFromSubscriptionSelection {
    return {
        users: (args: SubscriptionUsersArgs) =>
            usersNotNullArrayNotNullSelection.bind({
                collector: this,
                fieldName: "users",
                args,
                argsMeta: SubscriptionUsersArgsMeta,
            }),
        users_aggregate: (args: SubscriptionUsers_aggregateArgs) =>
            users_aggregateNotNullSelection.bind({
                collector: this,
                fieldName: "users_aggregate",
                args,
                argsMeta: SubscriptionUsers_aggregateArgsMeta,
            }),
        users_by_pk: (args: SubscriptionUsers_by_pkArgs) =>
            usersSelection.bind({
                collector: this,
                fieldName: "users_by_pk",
                args,
                argsMeta: SubscriptionUsers_by_pkArgsMeta,
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
export const SubscriptionSelection = makeSLFN(
    makeSubscriptionSelectionInput,
    "SubscriptionSelection",
    "Subscription",
    0,
);

type ReturnTypeFromusers_aggregateSelection = {
    aggregate: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_aggregate_fieldsSelectionInput>,
            "users_aggregate_fieldsSelection",
            "users_aggregate_fields",
            0
        >
    >;
    nodes: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>,
            "usersNotNullArrayNotNullSelection",
            "users",
            1
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeusers_aggregateSelectionInput(
    this: any,
): ReturnTypeFromusers_aggregateSelection {
    return {
        aggregate: users_aggregate_fieldsSelection.bind({
            collector: this,
            fieldName: "aggregate",
        }),
        nodes: usersNotNullArrayNotNullSelection.bind({
            collector: this,
            fieldName: "nodes",
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
export const users_aggregateSelection = makeSLFN(
    makeusers_aggregateSelectionInput,
    "users_aggregateSelection",
    "users_aggregate",
    0,
);

type ReturnTypeFrom_ServiceSelection = {
    sdl: SelectionWrapperImpl<"sdl", "String", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof make_ServiceSelectionInput>
    >;
};

export function make_ServiceSelectionInput(
    this: any,
): ReturnTypeFrom_ServiceSelection {
    return {
        sdl: new SelectionWrapper("sdl", "String", 0, {}, this, undefined),

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
                make_ServiceSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof make_ServiceSelectionInput>
            >,
    } as const;
}
export const _ServiceSelection = makeSLFN(
    make_ServiceSelectionInput,
    "_ServiceSelection",
    "_Service",
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
        mutation: MutationSelection.bind({
            collector: this,
            isRootType: "Mutation",
        }),
        subscription: SubscriptionSelection.bind({
            collector: this,
            isRootType: "Subscription",
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
