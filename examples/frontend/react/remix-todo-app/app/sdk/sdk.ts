const Proxy = global.Proxy;
Proxy.prototype = {};

export const _ = Symbol("_") as any;
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
            DateTimeISO: (value: string) => new Date(value),
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
        const res = await fetch("http://localhost:4000/graphql", {
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

    private utilGet = (obj: Record<string, any>, path: (string | number)[]) =>
        path.reduce((o, p) => o?.[p], obj);
    public getOperationResultPath<T>(
        path: (string | number)[] = [],
        type?: string,
    ): T {
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

export const SLW_CLONE = Symbol("SLW_CLONE");

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
    [SLW_CLONE](
        overrides: {
            SLW_OP_PATH?: string;
        } = {},
    ) {
        const slw = new SelectionWrapper(
            this[SLW_FIELD_NAME],
            this[SLW_FIELD_TYPENAME],
            this[SLW_FIELD_ARR_DEPTH],
            this[SLW_VALUE],
            this[SLW_COLLECTOR],
            this[SLW_PARENT_COLLECTOR],
            this[SLW_ARGS],
            this[SLW_ARGS_META],
            this[SLW_RECREATE_VALUE_CALLBACK],
        );
        slw[SLW_IS_ROOT_TYPE] = this[SLW_IS_ROOT_TYPE];
        slw[SLW_IS_ON_TYPE_FRAGMENT] = this[SLW_IS_ON_TYPE_FRAGMENT];
        slw[SLW_IS_FRAGMENT] = this[SLW_IS_FRAGMENT];
        slw[SLW_PARENT_SLW] = this[SLW_PARENT_SLW];
        slw[SLW_OP_PATH] = overrides.SLW_OP_PATH ?? this[SLW_OP_PATH];
        return slw;
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

                            newThat[SLW_OP_PATH] = that[SLW_OP_PATH];

                            newRootOpCollectorRef.ref.registerSelection(
                                newThat[SLW_FIELD_NAME]!,
                                newThat,
                            );

                            return new Promise((resolve, reject) => {
                                newRootOpCollectorRef.ref
                                    .execute()
                                    .catch(reject)
                                    .then(() => {
                                        resolve(newThat);
                                    });
                            });
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
                        prop === SLW_RECREATE_VALUE_CALLBACK ||
                        prop === SLW_CLONE
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
                                (t[SLW_OP_PATH]?.split(".") ?? []).map((p) =>
                                    !isNaN(+p) ? +p : p,
                                ),
                                t[SLW_FIELD_TYPENAME],
                            );
                            return data;
                        };

                        if (!Object.hasOwn(slw_value ?? {}, String(prop))) {
                            // check if the selected field is an array
                            if (typeArrDepth) {
                                if (!isNaN(+String(prop))) {
                                    const elm = target[SLW_CLONE]({
                                        SLW_OP_PATH:
                                            target[SLW_OP_PATH] +
                                            "." +
                                            String(prop),
                                    });
                                    return elm;
                                }

                                const data = getResultDataForTarget(target) as
                                    | valueT[]
                                    | undefined;

                                if (data === undefined) return undefined;

                                const proxiedData = Array.from(
                                    { length: data.length },
                                    (_, i) =>
                                        target[SLW_CLONE]({
                                            SLW_OP_PATH:
                                                target[SLW_OP_PATH] +
                                                "." +
                                                String(i),
                                        }),
                                );

                                const proto =
                                    Object.getPrototypeOf(proxiedData);
                                if (Object.hasOwn(proto, prop)) {
                                    const v = (proxiedData as any)[prop];
                                    if (typeof v === "function")
                                        return v.bind(proxiedData);
                                    return v;
                                }

                                return () => proxiedData;
                            }

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

                        let slw = slw_value?.[String(prop)];
                        const slwOpPathIsIndexAccess = !isNaN(
                            +target[SLW_OP_PATH]?.split(".").pop()!,
                        );
                        if (slwOpPathIsIndexAccess) {
                            // index access detected, cloning
                            slw = slw[SLW_CLONE]({
                                SLW_OP_PATH:
                                    target[SLW_OP_PATH] + "." + String(prop),
                            });
                        }

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
    DateTimeISO: Date;
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

export type SortOrder = "asc" | "desc";
export enum SortOrderEnum {
    asc = "asc",
    desc = "desc",
}

export type TodoScalarFieldEnum = "id" | "text" | "completed" | "createdAt";
export enum TodoScalarFieldEnumEnum {
    id = "id",
    text = "text",
    completed = "completed",
    createdAt = "createdAt",
}

export type Directive_includeArgs = {
    /** Included when true. */
    if: boolean;
};
export type Directive_skipArgs = {
    /** Skipped when true. */
    if: boolean;
};
export type QueryAggregateTodoArgs = {
    where?: TodoWhereInput;
    orderBy?: TodoOrderByWithRelationInput[];
    cursor?: TodoWhereUniqueInput;
    take?: number;
    skip?: number;
};
export type QueryFindFirstTodoArgs = {
    where?: TodoWhereInput;
    orderBy?: TodoOrderByWithRelationInput[];
    cursor?: TodoWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: TodoScalarFieldEnum[];
};
export type QueryFindFirstTodoOrThrowArgs = {
    where?: TodoWhereInput;
    orderBy?: TodoOrderByWithRelationInput[];
    cursor?: TodoWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: TodoScalarFieldEnum[];
};
export type QueryTodosArgs = {
    where?: TodoWhereInput;
    orderBy?: TodoOrderByWithRelationInput[];
    cursor?: TodoWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: TodoScalarFieldEnum[];
};
export type QueryTodoArgs = {
    where: TodoWhereUniqueInput;
};
export type QueryGetTodoArgs = {
    where: TodoWhereUniqueInput;
};
export type QueryGroupByTodoArgs = {
    where?: TodoWhereInput;
    orderBy?: TodoOrderByWithAggregationInput[];
    by: TodoScalarFieldEnum[];
    having?: TodoScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
};
export type MutationCreateManyTodoArgs = {
    data: TodoCreateManyInput[];
};
export type MutationCreateManyAndReturnTodoArgs = {
    data: TodoCreateManyInput[];
};
export type MutationCreateOneTodoArgs = {
    data: TodoCreateInput;
};
export type MutationDeleteManyTodoArgs = {
    where?: TodoWhereInput;
};
export type MutationDeleteOneTodoArgs = {
    where: TodoWhereUniqueInput;
};
export type MutationUpdateManyTodoArgs = {
    data: TodoUpdateManyMutationInput;
    where?: TodoWhereInput;
};
export type MutationUpdateOneTodoArgs = {
    data: TodoUpdateInput;
    where: TodoWhereUniqueInput;
};
export type MutationUpsertOneTodoArgs = {
    where: TodoWhereUniqueInput;
    create: TodoCreateInput;
    update: TodoUpdateInput;
};
export const Directive_includeArgsMeta = { if: "Boolean!" } as const;
export const Directive_skipArgsMeta = { if: "Boolean!" } as const;
export const QueryAggregateTodoArgsMeta = {
    where: "TodoWhereInput",
    orderBy: "[TodoOrderByWithRelationInput!]",
    cursor: "TodoWhereUniqueInput",
    take: "Int",
    skip: "Int",
} as const;
export const QueryFindFirstTodoArgsMeta = {
    where: "TodoWhereInput",
    orderBy: "[TodoOrderByWithRelationInput!]",
    cursor: "TodoWhereUniqueInput",
    take: "Int",
    skip: "Int",
    distinct: "[TodoScalarFieldEnum!]",
} as const;
export const QueryFindFirstTodoOrThrowArgsMeta = {
    where: "TodoWhereInput",
    orderBy: "[TodoOrderByWithRelationInput!]",
    cursor: "TodoWhereUniqueInput",
    take: "Int",
    skip: "Int",
    distinct: "[TodoScalarFieldEnum!]",
} as const;
export const QueryTodosArgsMeta = {
    where: "TodoWhereInput",
    orderBy: "[TodoOrderByWithRelationInput!]",
    cursor: "TodoWhereUniqueInput",
    take: "Int",
    skip: "Int",
    distinct: "[TodoScalarFieldEnum!]",
} as const;
export const QueryTodoArgsMeta = { where: "TodoWhereUniqueInput!" } as const;
export const QueryGetTodoArgsMeta = { where: "TodoWhereUniqueInput!" } as const;
export const QueryGroupByTodoArgsMeta = {
    where: "TodoWhereInput",
    orderBy: "[TodoOrderByWithAggregationInput!]",
    by: "[TodoScalarFieldEnum!]!",
    having: "TodoScalarWhereWithAggregatesInput",
    take: "Int",
    skip: "Int",
} as const;
export const MutationCreateManyTodoArgsMeta = {
    data: "[TodoCreateManyInput!]!",
} as const;
export const MutationCreateManyAndReturnTodoArgsMeta = {
    data: "[TodoCreateManyInput!]!",
} as const;
export const MutationCreateOneTodoArgsMeta = {
    data: "TodoCreateInput!",
} as const;
export const MutationDeleteManyTodoArgsMeta = {
    where: "TodoWhereInput",
} as const;
export const MutationDeleteOneTodoArgsMeta = {
    where: "TodoWhereUniqueInput!",
} as const;
export const MutationUpdateManyTodoArgsMeta = {
    data: "TodoUpdateManyMutationInput!",
    where: "TodoWhereInput",
} as const;
export const MutationUpdateOneTodoArgsMeta = {
    data: "TodoUpdateInput!",
    where: "TodoWhereUniqueInput!",
} as const;
export const MutationUpsertOneTodoArgsMeta = {
    where: "TodoWhereUniqueInput!",
    create: "TodoCreateInput!",
    update: "TodoUpdateInput!",
} as const;

export type TodoWhereInput = {
    AND?: TodoWhereInput[];
    OR?: TodoWhereInput[];
    NOT?: TodoWhereInput[];
    id?: StringFilter;
    text?: StringFilter;
    completed?: BoolFilter;
    createdAt?: DateTimeFilter;
};

export type StringFilter = {
    equals?: string;
    in?: Array<string>;
    notIn?: Array<string>;
    lt?: string;
    lte?: string;
    gt?: string;
    gte?: string;
    contains?: string;
    startsWith?: string;
    endsWith?: string;
    not?: NestedStringFilter;
};

export type NestedStringFilter = {
    equals?: string;
    in?: Array<string>;
    notIn?: Array<string>;
    lt?: string;
    lte?: string;
    gt?: string;
    gte?: string;
    contains?: string;
    startsWith?: string;
    endsWith?: string;
    not?: NestedStringFilter;
};

export type BoolFilter = {
    equals?: boolean;
    not?: NestedBoolFilter;
};

export type NestedBoolFilter = {
    equals?: boolean;
    not?: NestedBoolFilter;
};

export type DateTimeFilter = {
    equals?: Date;
    in?: Array<Date>;
    notIn?: Array<Date>;
    lt?: Date;
    lte?: Date;
    gt?: Date;
    gte?: Date;
    not?: NestedDateTimeFilter;
};

export type NestedDateTimeFilter = {
    equals?: Date;
    in?: Array<Date>;
    notIn?: Array<Date>;
    lt?: Date;
    lte?: Date;
    gt?: Date;
    gte?: Date;
    not?: NestedDateTimeFilter;
};

export type TodoOrderByWithRelationInput = {
    id?: any;
    text?: any;
    completed?: any;
    createdAt?: any;
};

export type TodoWhereUniqueInput = {
    id?: string;
    AND?: TodoWhereInput[];
    OR?: TodoWhereInput[];
    NOT?: TodoWhereInput[];
    text?: StringFilter;
    completed?: BoolFilter;
    createdAt?: DateTimeFilter;
};

export type TodoOrderByWithAggregationInput = {
    id?: any;
    text?: any;
    completed?: any;
    createdAt?: any;
    _count?: TodoCountOrderByAggregateInput;
    _max?: TodoMaxOrderByAggregateInput;
    _min?: TodoMinOrderByAggregateInput;
};

export type TodoCountOrderByAggregateInput = {
    id?: any;
    text?: any;
    completed?: any;
    createdAt?: any;
};

export type TodoMaxOrderByAggregateInput = {
    id?: any;
    text?: any;
    completed?: any;
    createdAt?: any;
};

export type TodoMinOrderByAggregateInput = {
    id?: any;
    text?: any;
    completed?: any;
    createdAt?: any;
};

export type TodoScalarWhereWithAggregatesInput = {
    AND?: TodoScalarWhereWithAggregatesInput[];
    OR?: TodoScalarWhereWithAggregatesInput[];
    NOT?: TodoScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter;
    text?: StringWithAggregatesFilter;
    completed?: BoolWithAggregatesFilter;
    createdAt?: DateTimeWithAggregatesFilter;
};

export type StringWithAggregatesFilter = {
    equals?: string;
    in?: Array<string>;
    notIn?: Array<string>;
    lt?: string;
    lte?: string;
    gt?: string;
    gte?: string;
    contains?: string;
    startsWith?: string;
    endsWith?: string;
    not?: NestedStringWithAggregatesFilter;
    _count?: NestedIntFilter;
    _min?: NestedStringFilter;
    _max?: NestedStringFilter;
};

export type NestedStringWithAggregatesFilter = {
    equals?: string;
    in?: Array<string>;
    notIn?: Array<string>;
    lt?: string;
    lte?: string;
    gt?: string;
    gte?: string;
    contains?: string;
    startsWith?: string;
    endsWith?: string;
    not?: NestedStringWithAggregatesFilter;
    _count?: NestedIntFilter;
    _min?: NestedStringFilter;
    _max?: NestedStringFilter;
};

export type NestedIntFilter = {
    equals?: number;
    in?: Array<number>;
    notIn?: Array<number>;
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
    not?: NestedIntFilter;
};

export type BoolWithAggregatesFilter = {
    equals?: boolean;
    not?: NestedBoolWithAggregatesFilter;
    _count?: NestedIntFilter;
    _min?: NestedBoolFilter;
    _max?: NestedBoolFilter;
};

export type NestedBoolWithAggregatesFilter = {
    equals?: boolean;
    not?: NestedBoolWithAggregatesFilter;
    _count?: NestedIntFilter;
    _min?: NestedBoolFilter;
    _max?: NestedBoolFilter;
};

export type DateTimeWithAggregatesFilter = {
    equals?: Date;
    in?: Array<Date>;
    notIn?: Array<Date>;
    lt?: Date;
    lte?: Date;
    gt?: Date;
    gte?: Date;
    not?: NestedDateTimeWithAggregatesFilter;
    _count?: NestedIntFilter;
    _min?: NestedDateTimeFilter;
    _max?: NestedDateTimeFilter;
};

export type NestedDateTimeWithAggregatesFilter = {
    equals?: Date;
    in?: Array<Date>;
    notIn?: Array<Date>;
    lt?: Date;
    lte?: Date;
    gt?: Date;
    gte?: Date;
    not?: NestedDateTimeWithAggregatesFilter;
    _count?: NestedIntFilter;
    _min?: NestedDateTimeFilter;
    _max?: NestedDateTimeFilter;
};

export type TodoCreateManyInput = {
    id?: string;
    text: string;
    completed?: boolean;
    createdAt?: Date;
};

export type TodoCreateInput = {
    id?: string;
    text: string;
    completed?: boolean;
    createdAt?: Date;
};

export type TodoUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput;
    text?: StringFieldUpdateOperationsInput;
    completed?: BoolFieldUpdateOperationsInput;
    createdAt?: DateTimeFieldUpdateOperationsInput;
};

export type StringFieldUpdateOperationsInput = {
    set?: string;
};

export type BoolFieldUpdateOperationsInput = {
    set?: boolean;
};

export type DateTimeFieldUpdateOperationsInput = {
    set?: Date;
};

export type TodoUpdateInput = {
    id?: StringFieldUpdateOperationsInput;
    text?: StringFieldUpdateOperationsInput;
    completed?: BoolFieldUpdateOperationsInput;
    createdAt?: DateTimeFieldUpdateOperationsInput;
};

type ReturnTypeFromTodoCountAggregateSelection = {
    id: SelectionWrapperImpl<"id", "Int", 0, {}, undefined>;
    text: SelectionWrapperImpl<"text", "Int", 0, {}, undefined>;
    completed: SelectionWrapperImpl<"completed", "Int", 0, {}, undefined>;
    createdAt: SelectionWrapperImpl<"createdAt", "Int", 0, {}, undefined>;
    _all: SelectionWrapperImpl<"_all", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeTodoCountAggregateSelectionInput>
    >;
};

export function makeTodoCountAggregateSelectionInput(
    this: any,
): ReturnTypeFromTodoCountAggregateSelection {
    return {
        id: new SelectionWrapper("id", "Int", 0, {}, this, undefined),
        text: new SelectionWrapper("text", "Int", 0, {}, this, undefined),
        completed: new SelectionWrapper(
            "completed",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        createdAt: new SelectionWrapper(
            "createdAt",
            "Int",
            0,
            {},
            this,
            undefined,
        ),
        _all: new SelectionWrapper("_all", "Int", 0, {}, this, undefined),

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
                makeTodoCountAggregateSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeTodoCountAggregateSelectionInput>
            >,
    } as const;
}
export const TodoCountAggregateSelection = makeSLFN(
    makeTodoCountAggregateSelectionInput,
    "TodoCountAggregateSelection",
    "TodoCountAggregate",
    0,
);

type ReturnTypeFromTodoMinAggregateSelection = {
    id: SelectionWrapperImpl<"id", "String", 0, {}, undefined>;
    text: SelectionWrapperImpl<"text", "String", 0, {}, undefined>;
    completed: SelectionWrapperImpl<"completed", "Boolean", 0, {}, undefined>;
    createdAt: SelectionWrapperImpl<
        "createdAt",
        "DateTimeISO",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeTodoMinAggregateSelectionInput>
    >;
};

export function makeTodoMinAggregateSelectionInput(
    this: any,
): ReturnTypeFromTodoMinAggregateSelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        text: new SelectionWrapper("text", "String", 0, {}, this, undefined),
        completed: new SelectionWrapper(
            "completed",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        createdAt: new SelectionWrapper(
            "createdAt",
            "DateTimeISO",
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
                makeTodoMinAggregateSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeTodoMinAggregateSelectionInput>
            >,
    } as const;
}
export const TodoMinAggregateSelection = makeSLFN(
    makeTodoMinAggregateSelectionInput,
    "TodoMinAggregateSelection",
    "TodoMinAggregate",
    0,
);

type ReturnTypeFromTodoMaxAggregateSelection = {
    id: SelectionWrapperImpl<"id", "String", 0, {}, undefined>;
    text: SelectionWrapperImpl<"text", "String", 0, {}, undefined>;
    completed: SelectionWrapperImpl<"completed", "Boolean", 0, {}, undefined>;
    createdAt: SelectionWrapperImpl<
        "createdAt",
        "DateTimeISO",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeTodoMaxAggregateSelectionInput>
    >;
};

export function makeTodoMaxAggregateSelectionInput(
    this: any,
): ReturnTypeFromTodoMaxAggregateSelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        text: new SelectionWrapper("text", "String", 0, {}, this, undefined),
        completed: new SelectionWrapper(
            "completed",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        createdAt: new SelectionWrapper(
            "createdAt",
            "DateTimeISO",
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
                makeTodoMaxAggregateSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeTodoMaxAggregateSelectionInput>
            >,
    } as const;
}
export const TodoMaxAggregateSelection = makeSLFN(
    makeTodoMaxAggregateSelectionInput,
    "TodoMaxAggregateSelection",
    "TodoMaxAggregate",
    0,
);

type ReturnTypeFromAggregateTodoNotNullSelection = {
    _count: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoCountAggregateSelectionInput>,
            "TodoCountAggregateSelection",
            "TodoCountAggregate",
            0
        >
    >;
    _min: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoMinAggregateSelectionInput>,
            "TodoMinAggregateSelection",
            "TodoMinAggregate",
            0
        >
    >;
    _max: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoMaxAggregateSelectionInput>,
            "TodoMaxAggregateSelection",
            "TodoMaxAggregate",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeAggregateTodoNotNullSelectionInput(
    this: any,
): ReturnTypeFromAggregateTodoNotNullSelection {
    return {
        _count: TodoCountAggregateSelection.bind({
            collector: this,
            fieldName: "_count",
        }),
        _min: TodoMinAggregateSelection.bind({
            collector: this,
            fieldName: "_min",
        }),
        _max: TodoMaxAggregateSelection.bind({
            collector: this,
            fieldName: "_max",
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
export const AggregateTodoNotNullSelection = makeSLFN(
    makeAggregateTodoNotNullSelectionInput,
    "AggregateTodoNotNullSelection",
    "AggregateTodo",
    0,
);

type ReturnTypeFromTodoSelection = {
    id: SelectionWrapperImpl<"id", "String", 0, {}, undefined>;
    text: SelectionWrapperImpl<"text", "String", 0, {}, undefined>;
    completed: SelectionWrapperImpl<"completed", "Boolean", 0, {}, undefined>;
    createdAt: SelectionWrapperImpl<
        "createdAt",
        "DateTimeISO",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeTodoSelectionInput>
    >;
};

export function makeTodoSelectionInput(this: any): ReturnTypeFromTodoSelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        text: new SelectionWrapper("text", "String", 0, {}, this, undefined),
        completed: new SelectionWrapper(
            "completed",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        createdAt: new SelectionWrapper(
            "createdAt",
            "DateTimeISO",
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
                makeTodoSelectionInput.bind(this)(),
            ) as SLWsFromSelection<ReturnType<typeof makeTodoSelectionInput>>,
    } as const;
}
export const TodoSelection = makeSLFN(
    makeTodoSelectionInput,
    "TodoSelection",
    "Todo",
    0,
);

type ReturnTypeFromTodoNotNullArrayNotNullSelection = {
    id: SelectionWrapperImpl<"id", "String", 0, {}, undefined>;
    text: SelectionWrapperImpl<"text", "String", 0, {}, undefined>;
    completed: SelectionWrapperImpl<"completed", "Boolean", 0, {}, undefined>;
    createdAt: SelectionWrapperImpl<
        "createdAt",
        "DateTimeISO",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeTodoNotNullArrayNotNullSelectionInput>
    >;
};

export function makeTodoNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromTodoNotNullArrayNotNullSelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        text: new SelectionWrapper("text", "String", 0, {}, this, undefined),
        completed: new SelectionWrapper(
            "completed",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        createdAt: new SelectionWrapper(
            "createdAt",
            "DateTimeISO",
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
                makeTodoNotNullArrayNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeTodoNotNullArrayNotNullSelectionInput>
            >,
    } as const;
}
export const TodoNotNullArrayNotNullSelection = makeSLFN(
    makeTodoNotNullArrayNotNullSelectionInput,
    "TodoNotNullArrayNotNullSelection",
    "Todo",
    1,
);

type ReturnTypeFromTodoGroupByNotNullArrayNotNullSelection = {
    id: SelectionWrapperImpl<"id", "String", 0, {}, undefined>;
    text: SelectionWrapperImpl<"text", "String", 0, {}, undefined>;
    completed: SelectionWrapperImpl<"completed", "Boolean", 0, {}, undefined>;
    createdAt: SelectionWrapperImpl<
        "createdAt",
        "DateTimeISO",
        0,
        {},
        undefined
    >;
    _count: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoCountAggregateSelectionInput>,
            "TodoCountAggregateSelection",
            "TodoCountAggregate",
            0
        >
    >;
    _min: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoMinAggregateSelectionInput>,
            "TodoMinAggregateSelection",
            "TodoMinAggregate",
            0
        >
    >;
    _max: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoMaxAggregateSelectionInput>,
            "TodoMaxAggregateSelection",
            "TodoMaxAggregate",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeTodoGroupByNotNullArrayNotNullSelectionInput>
    >;
};

export function makeTodoGroupByNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromTodoGroupByNotNullArrayNotNullSelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        text: new SelectionWrapper("text", "String", 0, {}, this, undefined),
        completed: new SelectionWrapper(
            "completed",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        createdAt: new SelectionWrapper(
            "createdAt",
            "DateTimeISO",
            0,
            {},
            this,
            undefined,
        ),
        _count: TodoCountAggregateSelection.bind({
            collector: this,
            fieldName: "_count",
        }),
        _min: TodoMinAggregateSelection.bind({
            collector: this,
            fieldName: "_min",
        }),
        _max: TodoMaxAggregateSelection.bind({
            collector: this,
            fieldName: "_max",
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
                makeTodoGroupByNotNullArrayNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<
                    typeof makeTodoGroupByNotNullArrayNotNullSelectionInput
                >
            >,
    } as const;
}
export const TodoGroupByNotNullArrayNotNullSelection = makeSLFN(
    makeTodoGroupByNotNullArrayNotNullSelectionInput,
    "TodoGroupByNotNullArrayNotNullSelection",
    "TodoGroupBy",
    1,
);

type ReturnTypeFromAffectedRowsOutputNotNullSelection = {
    count: SelectionWrapperImpl<"count", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeAffectedRowsOutputNotNullSelectionInput>
    >;
};

export function makeAffectedRowsOutputNotNullSelectionInput(
    this: any,
): ReturnTypeFromAffectedRowsOutputNotNullSelection {
    return {
        count: new SelectionWrapper("count", "Int", 0, {}, this, undefined),

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
                makeAffectedRowsOutputNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeAffectedRowsOutputNotNullSelectionInput>
            >,
    } as const;
}
export const AffectedRowsOutputNotNullSelection = makeSLFN(
    makeAffectedRowsOutputNotNullSelectionInput,
    "AffectedRowsOutputNotNullSelection",
    "AffectedRowsOutput",
    0,
);

type ReturnTypeFromCreateManyAndReturnTodoNotNullArrayNotNullSelection = {
    id: SelectionWrapperImpl<"id", "String", 0, {}, undefined>;
    text: SelectionWrapperImpl<"text", "String", 0, {}, undefined>;
    completed: SelectionWrapperImpl<"completed", "Boolean", 0, {}, undefined>;
    createdAt: SelectionWrapperImpl<
        "createdAt",
        "DateTimeISO",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<
            typeof makeCreateManyAndReturnTodoNotNullArrayNotNullSelectionInput
        >
    >;
};

export function makeCreateManyAndReturnTodoNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromCreateManyAndReturnTodoNotNullArrayNotNullSelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        text: new SelectionWrapper("text", "String", 0, {}, this, undefined),
        completed: new SelectionWrapper(
            "completed",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        createdAt: new SelectionWrapper(
            "createdAt",
            "DateTimeISO",
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
                makeCreateManyAndReturnTodoNotNullArrayNotNullSelectionInput.bind(
                    this,
                )(),
            ) as SLWsFromSelection<
                ReturnType<
                    typeof makeCreateManyAndReturnTodoNotNullArrayNotNullSelectionInput
                >
            >,
    } as const;
}
export const CreateManyAndReturnTodoNotNullArrayNotNullSelection = makeSLFN(
    makeCreateManyAndReturnTodoNotNullArrayNotNullSelectionInput,
    "CreateManyAndReturnTodoNotNullArrayNotNullSelection",
    "CreateManyAndReturnTodo",
    1,
);

type ReturnTypeFromTodoNotNullSelection = {
    id: SelectionWrapperImpl<"id", "String", 0, {}, undefined>;
    text: SelectionWrapperImpl<"text", "String", 0, {}, undefined>;
    completed: SelectionWrapperImpl<"completed", "Boolean", 0, {}, undefined>;
    createdAt: SelectionWrapperImpl<
        "createdAt",
        "DateTimeISO",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeTodoNotNullSelectionInput>
    >;
};

export function makeTodoNotNullSelectionInput(
    this: any,
): ReturnTypeFromTodoNotNullSelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        text: new SelectionWrapper("text", "String", 0, {}, this, undefined),
        completed: new SelectionWrapper(
            "completed",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        createdAt: new SelectionWrapper(
            "createdAt",
            "DateTimeISO",
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
                makeTodoNotNullSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeTodoNotNullSelectionInput>
            >,
    } as const;
}
export const TodoNotNullSelection = makeSLFN(
    makeTodoNotNullSelectionInput,
    "TodoNotNullSelection",
    "Todo",
    0,
);

type ReturnTypeFromQuerySelection = {
    aggregateTodo: (args: QueryAggregateTodoArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAggregateTodoNotNullSelectionInput>,
            "AggregateTodoNotNullSelection",
            "AggregateTodo",
            0,
            {
                $lazy: (args: QueryAggregateTodoArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    findFirstTodo: (args: QueryFindFirstTodoArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoSelectionInput>,
            "TodoSelection",
            "Todo",
            0,
            {
                $lazy: (args: QueryFindFirstTodoArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    findFirstTodoOrThrow: (args: QueryFindFirstTodoOrThrowArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoSelectionInput>,
            "TodoSelection",
            "Todo",
            0,
            {
                $lazy: (args: QueryFindFirstTodoOrThrowArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    todos: (args: QueryTodosArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoNotNullArrayNotNullSelectionInput>,
            "TodoNotNullArrayNotNullSelection",
            "Todo",
            1,
            {
                $lazy: (args: QueryTodosArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    todo: (args: QueryTodoArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoSelectionInput>,
            "TodoSelection",
            "Todo",
            0,
            {
                $lazy: (args: QueryTodoArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    getTodo: (args: QueryGetTodoArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoSelectionInput>,
            "TodoSelection",
            "Todo",
            0,
            {
                $lazy: (args: QueryGetTodoArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    groupByTodo: (args: QueryGroupByTodoArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoGroupByNotNullArrayNotNullSelectionInput>,
            "TodoGroupByNotNullArrayNotNullSelection",
            "TodoGroupBy",
            1,
            {
                $lazy: (args: QueryGroupByTodoArgs) => Promise<"T">;
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
        aggregateTodo: (args: QueryAggregateTodoArgs) =>
            AggregateTodoNotNullSelection.bind({
                collector: this,
                fieldName: "aggregateTodo",
                args,
                argsMeta: QueryAggregateTodoArgsMeta,
            }),
        findFirstTodo: (args: QueryFindFirstTodoArgs) =>
            TodoSelection.bind({
                collector: this,
                fieldName: "findFirstTodo",
                args,
                argsMeta: QueryFindFirstTodoArgsMeta,
            }),
        findFirstTodoOrThrow: (args: QueryFindFirstTodoOrThrowArgs) =>
            TodoSelection.bind({
                collector: this,
                fieldName: "findFirstTodoOrThrow",
                args,
                argsMeta: QueryFindFirstTodoOrThrowArgsMeta,
            }),
        todos: (args: QueryTodosArgs) =>
            TodoNotNullArrayNotNullSelection.bind({
                collector: this,
                fieldName: "todos",
                args,
                argsMeta: QueryTodosArgsMeta,
            }),
        todo: (args: QueryTodoArgs) =>
            TodoSelection.bind({
                collector: this,
                fieldName: "todo",
                args,
                argsMeta: QueryTodoArgsMeta,
            }),
        getTodo: (args: QueryGetTodoArgs) =>
            TodoSelection.bind({
                collector: this,
                fieldName: "getTodo",
                args,
                argsMeta: QueryGetTodoArgsMeta,
            }),
        groupByTodo: (args: QueryGroupByTodoArgs) =>
            TodoGroupByNotNullArrayNotNullSelection.bind({
                collector: this,
                fieldName: "groupByTodo",
                args,
                argsMeta: QueryGroupByTodoArgsMeta,
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

type ReturnTypeFromAggregateTodoSelection = {
    _count: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoCountAggregateSelectionInput>,
            "TodoCountAggregateSelection",
            "TodoCountAggregate",
            0
        >
    >;
    _min: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoMinAggregateSelectionInput>,
            "TodoMinAggregateSelection",
            "TodoMinAggregate",
            0
        >
    >;
    _max: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoMaxAggregateSelectionInput>,
            "TodoMaxAggregateSelection",
            "TodoMaxAggregate",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;
};

export function makeAggregateTodoSelectionInput(
    this: any,
): ReturnTypeFromAggregateTodoSelection {
    return {
        _count: TodoCountAggregateSelection.bind({
            collector: this,
            fieldName: "_count",
        }),
        _min: TodoMinAggregateSelection.bind({
            collector: this,
            fieldName: "_min",
        }),
        _max: TodoMaxAggregateSelection.bind({
            collector: this,
            fieldName: "_max",
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
export const AggregateTodoSelection = makeSLFN(
    makeAggregateTodoSelectionInput,
    "AggregateTodoSelection",
    "AggregateTodo",
    0,
);

type ReturnTypeFromTodoGroupBySelection = {
    id: SelectionWrapperImpl<"id", "String", 0, {}, undefined>;
    text: SelectionWrapperImpl<"text", "String", 0, {}, undefined>;
    completed: SelectionWrapperImpl<"completed", "Boolean", 0, {}, undefined>;
    createdAt: SelectionWrapperImpl<
        "createdAt",
        "DateTimeISO",
        0,
        {},
        undefined
    >;
    _count: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoCountAggregateSelectionInput>,
            "TodoCountAggregateSelection",
            "TodoCountAggregate",
            0
        >
    >;
    _min: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoMinAggregateSelectionInput>,
            "TodoMinAggregateSelection",
            "TodoMinAggregate",
            0
        >
    >;
    _max: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoMaxAggregateSelectionInput>,
            "TodoMaxAggregateSelection",
            "TodoMaxAggregate",
            0
        >
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeTodoGroupBySelectionInput>
    >;
};

export function makeTodoGroupBySelectionInput(
    this: any,
): ReturnTypeFromTodoGroupBySelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        text: new SelectionWrapper("text", "String", 0, {}, this, undefined),
        completed: new SelectionWrapper(
            "completed",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        createdAt: new SelectionWrapper(
            "createdAt",
            "DateTimeISO",
            0,
            {},
            this,
            undefined,
        ),
        _count: TodoCountAggregateSelection.bind({
            collector: this,
            fieldName: "_count",
        }),
        _min: TodoMinAggregateSelection.bind({
            collector: this,
            fieldName: "_min",
        }),
        _max: TodoMaxAggregateSelection.bind({
            collector: this,
            fieldName: "_max",
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
                makeTodoGroupBySelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeTodoGroupBySelectionInput>
            >,
    } as const;
}
export const TodoGroupBySelection = makeSLFN(
    makeTodoGroupBySelectionInput,
    "TodoGroupBySelection",
    "TodoGroupBy",
    0,
);

type ReturnTypeFromMutationSelection = {
    createManyTodo: (args: MutationCreateManyTodoArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAffectedRowsOutputNotNullSelectionInput>,
            "AffectedRowsOutputNotNullSelection",
            "AffectedRowsOutput",
            0,
            {
                $lazy: (args: MutationCreateManyTodoArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    createManyAndReturnTodo: (
        args: MutationCreateManyAndReturnTodoArgs,
    ) => ReturnType<
        SLFN<
            {},
            ReturnType<
                typeof makeCreateManyAndReturnTodoNotNullArrayNotNullSelectionInput
            >,
            "CreateManyAndReturnTodoNotNullArrayNotNullSelection",
            "CreateManyAndReturnTodo",
            1,
            {
                $lazy: (
                    args: MutationCreateManyAndReturnTodoArgs,
                ) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    createOneTodo: (args: MutationCreateOneTodoArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoNotNullSelectionInput>,
            "TodoNotNullSelection",
            "Todo",
            0,
            {
                $lazy: (args: MutationCreateOneTodoArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    deleteManyTodo: (args: MutationDeleteManyTodoArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAffectedRowsOutputNotNullSelectionInput>,
            "AffectedRowsOutputNotNullSelection",
            "AffectedRowsOutput",
            0,
            {
                $lazy: (args: MutationDeleteManyTodoArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    deleteOneTodo: (args: MutationDeleteOneTodoArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoSelectionInput>,
            "TodoSelection",
            "Todo",
            0,
            {
                $lazy: (args: MutationDeleteOneTodoArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    updateManyTodo: (args: MutationUpdateManyTodoArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeAffectedRowsOutputNotNullSelectionInput>,
            "AffectedRowsOutputNotNullSelection",
            "AffectedRowsOutput",
            0,
            {
                $lazy: (args: MutationUpdateManyTodoArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    updateOneTodo: (args: MutationUpdateOneTodoArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoSelectionInput>,
            "TodoSelection",
            "Todo",
            0,
            {
                $lazy: (args: MutationUpdateOneTodoArgs) => Promise<"T">;
            },
            "$lazy"
        >
    >;
    upsertOneTodo: (args: MutationUpsertOneTodoArgs) => ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeTodoNotNullSelectionInput>,
            "TodoNotNullSelection",
            "Todo",
            0,
            {
                $lazy: (args: MutationUpsertOneTodoArgs) => Promise<"T">;
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
        createManyTodo: (args: MutationCreateManyTodoArgs) =>
            AffectedRowsOutputNotNullSelection.bind({
                collector: this,
                fieldName: "createManyTodo",
                args,
                argsMeta: MutationCreateManyTodoArgsMeta,
            }),
        createManyAndReturnTodo: (args: MutationCreateManyAndReturnTodoArgs) =>
            CreateManyAndReturnTodoNotNullArrayNotNullSelection.bind({
                collector: this,
                fieldName: "createManyAndReturnTodo",
                args,
                argsMeta: MutationCreateManyAndReturnTodoArgsMeta,
            }),
        createOneTodo: (args: MutationCreateOneTodoArgs) =>
            TodoNotNullSelection.bind({
                collector: this,
                fieldName: "createOneTodo",
                args,
                argsMeta: MutationCreateOneTodoArgsMeta,
            }),
        deleteManyTodo: (args: MutationDeleteManyTodoArgs) =>
            AffectedRowsOutputNotNullSelection.bind({
                collector: this,
                fieldName: "deleteManyTodo",
                args,
                argsMeta: MutationDeleteManyTodoArgsMeta,
            }),
        deleteOneTodo: (args: MutationDeleteOneTodoArgs) =>
            TodoSelection.bind({
                collector: this,
                fieldName: "deleteOneTodo",
                args,
                argsMeta: MutationDeleteOneTodoArgsMeta,
            }),
        updateManyTodo: (args: MutationUpdateManyTodoArgs) =>
            AffectedRowsOutputNotNullSelection.bind({
                collector: this,
                fieldName: "updateManyTodo",
                args,
                argsMeta: MutationUpdateManyTodoArgsMeta,
            }),
        updateOneTodo: (args: MutationUpdateOneTodoArgs) =>
            TodoSelection.bind({
                collector: this,
                fieldName: "updateOneTodo",
                args,
                argsMeta: MutationUpdateOneTodoArgsMeta,
            }),
        upsertOneTodo: (args: MutationUpsertOneTodoArgs) =>
            TodoNotNullSelection.bind({
                collector: this,
                fieldName: "upsertOneTodo",
                args,
                argsMeta: MutationUpsertOneTodoArgsMeta,
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

type ReturnTypeFromAffectedRowsOutputSelection = {
    count: SelectionWrapperImpl<"count", "Int", 0, {}, undefined>;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeAffectedRowsOutputSelectionInput>
    >;
};

export function makeAffectedRowsOutputSelectionInput(
    this: any,
): ReturnTypeFromAffectedRowsOutputSelection {
    return {
        count: new SelectionWrapper("count", "Int", 0, {}, this, undefined),

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
                makeAffectedRowsOutputSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeAffectedRowsOutputSelectionInput>
            >,
    } as const;
}
export const AffectedRowsOutputSelection = makeSLFN(
    makeAffectedRowsOutputSelectionInput,
    "AffectedRowsOutputSelection",
    "AffectedRowsOutput",
    0,
);

type ReturnTypeFromCreateManyAndReturnTodoSelection = {
    id: SelectionWrapperImpl<"id", "String", 0, {}, undefined>;
    text: SelectionWrapperImpl<"text", "String", 0, {}, undefined>;
    completed: SelectionWrapperImpl<"completed", "Boolean", 0, {}, undefined>;
    createdAt: SelectionWrapperImpl<
        "createdAt",
        "DateTimeISO",
        0,
        {},
        undefined
    >;
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCreateManyAndReturnTodoSelectionInput>
    >;
};

export function makeCreateManyAndReturnTodoSelectionInput(
    this: any,
): ReturnTypeFromCreateManyAndReturnTodoSelection {
    return {
        id: new SelectionWrapper("id", "String", 0, {}, this, undefined),
        text: new SelectionWrapper("text", "String", 0, {}, this, undefined),
        completed: new SelectionWrapper(
            "completed",
            "Boolean",
            0,
            {},
            this,
            undefined,
        ),
        createdAt: new SelectionWrapper(
            "createdAt",
            "DateTimeISO",
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
                makeCreateManyAndReturnTodoSelectionInput.bind(this)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCreateManyAndReturnTodoSelectionInput>
            >,
    } as const;
}
export const CreateManyAndReturnTodoSelection = makeSLFN(
    makeCreateManyAndReturnTodoSelectionInput,
    "CreateManyAndReturnTodoSelection",
    "CreateManyAndReturnTodo",
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
        }) as finalReturnTypeBasedOnIfHasLazyPromises;
    } else {
        returnValue = result as finalReturnTypeBasedOnIfHasLazyPromises;
    }

    Object.defineProperty(returnValue, "auth", {
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

                            return returnValue;
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

                return returnValue;
            };
        },
    });

    return returnValue as finalReturnTypeBasedOnIfHasLazyPromises & {
        auth: (
            auth: __AuthenticationArg__,
        ) => finalReturnTypeBasedOnIfHasLazyPromises;
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
