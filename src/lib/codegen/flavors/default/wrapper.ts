const Proxy = global.Proxy;
Proxy.prototype = {};

export class RootOperation {
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
        const operations: { [key: string]: selection } = {};
        for (const [
            opName,
            opSelection,
        ] of this.rootCollector?.selections.entries()) {
            operations[opName] = opSelection[SLW_COLLECTOR]!.renderSelections([
                opName,
            ]);
        }

        const ops = Object.entries(operations).reduce(
            (acc, [opName, op]) => ({
                ...acc,
                [opName]: {
                    query: `${this.rootCollector!.selections.get(opName)?.[
                        SLW_IS_ROOT_TYPE
                    ]?.toLowerCase()} ${opName} ${
                        op.variableDefinitions.length
                            ? `(${op.variableDefinitions.join(", ")})`
                            : ""
                    } ${op.selection}
                    `,
                    variables: op.variables,
                    fragments: op.usedFragments,
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
        const result = await res.json();

        const { data, errors } = result ?? {};
        if (errors?.length > 0) {
            for (const error of errors) {
                if (error.path) {
                    this.utilSet(data, error.path, error);
                }
            }
        }
        return data;
    }
}

const OPTIONS = Symbol("OPTIONS");
export class OperationSelectionCollector {
    public static [OPTIONS] = {
        headers: {},
        scalars: {
            DateTime: (value: string) => new Date(value),
            Date: (value: string) => new Date(value),
            Time: (value: string) => new Date(value),
            JSON: (value: string) => JSON.parse(value),
        },
    };

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
        headers: Record<string, string> = OperationSelectionCollector[OPTIONS]
            .headers,
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
        SelectionWrapperImpl<string, string, any>
    >();
    public registerSelection(
        id: string,
        selection: SelectionWrapperImpl<string, string, any>,
    ) {
        this.selections.set(id, selection);
    }

    public renderSelections(
        path: string[] = [],
        opVars: Record<string, any> = {},
        usedFragments: Map<string, string> = new Map(),
    ) {
        const result: Record<string, any> = {};
        const varDefs: string[] = [];
        const variables: Record<string, any> = {};

        for (const [key, value] of this.selections.entries()) {
            const subPath = [...path, key];
            const {
                selection: fieldSelection,
                variableDefinitions: fieldVarDefs,
                variables: fieldVars,
            } = value[SLW_RENDER_WITH_ARGS](opVars);

            Object.assign(variables, fieldVars);
            Object.assign(opVars, fieldVars);
            varDefs.push(...fieldVarDefs);
            value[SLW_REGISTER_PATH](subPath);

            if (value[SLW_PARENT_COLLECTOR] === undefined) {
                result[key] = fieldSelection;
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
                    result[key] =
                        `... on ${value[SLW_IS_ON_TYPE_FRAGMENT]} ${subSelection}`;
                } else if (value[SLW_IS_FRAGMENT]) {
                    const fragmentName = `${key}_${subVarDefs.map((v) => v.split(":")[0].slice(1)).join("_")}`;
                    result[key] = `...${fragmentName}`;
                    const fragment = `fragment ${fragmentName} on ${value[SLW_FIELD_TYPE]} ${subSelection}`;
                    if (!usedFragments.has(fragmentName)) {
                        usedFragments.set(fragmentName, fragment);
                    } else if (usedFragments.get(fragmentName) !== fragment) {
                        console.warn(
                            `Fragment ${fragmentName} is already defined with a different selection`,
                        );
                    }
                } else {
                    result[key] = `${fieldSelection} ${subSelection}`;
                }

                Object.assign(variables, subVars);
                Object.assign(opVars, subVars);
                varDefs.push(...subVarDefs);
            }
        }
        let rendered = "{ ";
        for (const [key, value] of Object.entries(result)) {
            const isSubSelection = value.toString().startsWith("{");
            const isOnType = value.toString().startsWith("... on");
            const isFragment = value.toString().startsWith("...");
            if (key === value) {
                rendered += `${key} `;
            } else if (isOnType || isFragment) {
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
    public getOperationResultPath<T>(
        path: string[] = [],
        typeName?: string,
    ): T {
        if (!this.op) {
            throw new Error(
                "OperationSelectionCollector is not registered to a root operation",
            );
        }

        let result = this.operationResult;

        if (path.length === 0) return result as T;

        result = this.utilGet(result, path) as T;

        if (typeName && result) {
            const type = typeName
                .replaceAll("!", "")
                .replaceAll("[", "")
                .replaceAll("]", "");

            if (type in OperationSelectionCollector[OPTIONS].scalars) {
                let depth = 0;
                let finalResult =
                    result instanceof Array ? [...result] : result;

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
                    OperationSelectionCollector[OPTIONS].scalars[
                        type as keyof (typeof OperationSelectionCollector)[typeof OPTIONS]["scalars"]
                    ],
                ) as T;
            }
        }

        return result as T;
    }
}

export const SLW_UID = Symbol("SLW_UID");
export const SLW_FIELD_NAME = Symbol("SLW_FIELD_NAME");
export const SLW_FIELD_TYPE = Symbol("SLW_FIELD_TYPE");
export const SLW_IS_ROOT_TYPE = Symbol("SLW_IS_ROOT_TYPE");
export const SLW_IS_ON_TYPE_FRAGMENT = Symbol("SLW_IS_ON_TYPE_FRAGMENT");
export const SLW_IS_FRAGMENT = Symbol("SLW_IS_FRAGMENT");
export const SLW_VALUE = Symbol("SLW_VALUE");
export const SLW_ARGS = Symbol("SLW_ARGS");
export const SLW_ARGS_META = Symbol("SLW_ARGS_META");
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
    [SLW_VALUE]?: valueT;

    [SLW_IS_ROOT_TYPE]?: "Query" | "Mutation" | "Subscription";
    [SLW_IS_ON_TYPE_FRAGMENT]?: string;
    [SLW_IS_FRAGMENT]?: string;

    [SLW_ARGS]?: argsT;
    [SLW_ARGS_META]?: Record<string, string>;

    constructor(
        fieldName?: fieldName,
        typeName?: typeName,
        value?: valueT,
        collector?: OperationSelectionCollector,
        parent?: OperationSelectionCollector | RootOperation,
        args?: argsT,
        argsMeta?: Record<string, string>,
    ) {
        this[SLW_FIELD_NAME] = fieldName;
        this[SLW_FIELD_TYPE] = typeName;
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
        if (this[SLW_ARGS]) {
            const args = this[SLW_ARGS];
            const argsMeta = this[SLW_ARGS_META]!;

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
            return {
                selection: `${this[SLW_FIELD_NAME]}${Object.keys(args).length ? argsString : ""}`,
                variables: args,
                variableDefinitions: Object.keys(args).map((key) => {
                    const varName = argToVarMap[key] ?? key;
                    return `$${varName}: ${argsMeta[key]}`;
                }),
            };
        }
        return {
            selection: this[SLW_FIELD_NAME],
            variables: {},
            variableDefinitions: [] as string[],
        };
    }
}
export class SelectionWrapper<
    fieldName extends string,
    typeName extends string,
    valueT extends any = any,
    argsT extends Record<string, any> | undefined = undefined,
> extends Proxy<SelectionWrapperImpl<fieldName, typeName, valueT, argsT>> {
    constructor(
        fieldName?: fieldName,
        typeName?: typeName,
        value?: valueT,
        collector?: OperationSelectionCollector,
        parent?: OperationSelectionCollector,
        args?: argsT,
        argsMeta?: Record<string, string>,
    ) {
        super(
            new SelectionWrapperImpl<fieldName, typeName, valueT, argsT>(
                fieldName,
                typeName,
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
                    if (
                        prop === SLW_UID ||
                        prop === SLW_FIELD_NAME ||
                        prop === SLW_FIELD_TYPE ||
                        prop === SLW_IS_ROOT_TYPE ||
                        prop === SLW_IS_ON_TYPE_FRAGMENT ||
                        prop === SLW_IS_FRAGMENT ||
                        prop === SLW_VALUE ||
                        prop === SLW_ARGS ||
                        prop === SLW_ARGS_META ||
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

                    if (target[ROOT_OP_COLLECTOR]?.isExecuted) {
                        const getResultDataForTarget = (
                            t: SelectionWrapperImpl<
                                fieldName,
                                typeName,
                                valueT,
                                argsT
                            >,
                        ): valueT | undefined => {
                            const data = t[
                                ROOT_OP_COLLECTOR
                            ]!.getOperationResultPath<valueT>(
                                t[SLW_OP_PATH]?.split(".") ?? [],
                                t[SLW_FIELD_TYPE],
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
                    }

                    return slw_value?.[String(prop)] ?? undefined;
                },
            },
        );
    }
}
