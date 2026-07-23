const Proxy = globalThis.Proxy;
Proxy.prototype = {};

/** Wrap real response data so property access re-enters the SelectionWrapper handler (Array.isArray works). */
function proxify(_data: any, slw: SelectionWrapperImpl<any, any, any, any, any>): any & ArrayLike<any> {
    const data = _data;
    const proxy = new Proxy(data as any | any[], {
        get(target: any[], prop: PropertyKey, receiver: any): any {
            return Reflect.get(slw, prop, receiver);
        },
        set(target: any[], prop: PropertyKey, value: any, receiver: any): boolean {
            return Reflect.set(slw, prop, value, receiver);
        },
        has(target: any[], prop: PropertyKey): boolean {
            return Reflect.has(slw, prop);
        },
        deleteProperty(target: any[], prop: PropertyKey): boolean {
            return Reflect.deleteProperty(slw, prop);
        },
        ownKeys(target: any[]): ArrayLike<string | symbol> {
            return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor(target: any[], prop: PropertyKey): PropertyDescriptor | undefined {
            return Reflect.getOwnPropertyDescriptor(target, prop);
        },
        getPrototypeOf(target: any[]): object | null {
            return Object.getPrototypeOf(target);
        },
    });
    return proxy as unknown as any & ArrayLike<any>;
}

export const _ = Symbol("_") as any;
export const OPTIONS = Symbol("OPTIONS");

type OpenAPIRequest = {
    path: string;
    method: "get" | "post" | "put" | "delete" | "patch" | "head" | "options" | "trace";
    header: Record<string, any>;
    params: {
        path: Record<string, any>;
        query: Record<string, any>;
    };
    body: Record<string, any>;
    cookie: Record<string, any>;
    isEventStream?: boolean;
};

export class RootOperation {
    public static [OPTIONS] = {
        headers: {} as Record<string, string>,
        _auth_fn: undefined as
            | (() => string | { [key: string]: string })
            | (() => Promise<string | { [key: string]: string }>)
            | undefined,
        fetcher: undefined as unknown as (
            input: string | URL | globalThis.Request,
            init?: RequestInit,
        ) => Promise<Response>,
        scalars: {
            DateTime: (value: string) => new Date(value),
            DateTimeISO: (value: string) => new Date(value),
            Date: (value: string) => new Date(value),
            Time: (value: string) => new Date(value),
            JSON: (value: string) => JSON.parse(value),
        },
    };

    private utilSet = (obj: Record<string, any>, path: string[], value: any) =>
        path.reduce((o, p, i, a) => (o[p] = a.length - 1 === i ? value : o[p] || {}), obj);

    private rootCollector: OperationSelectionCollector | undefined = undefined;
    public registerRootCollector(collector: OperationSelectionCollector) {
        this.rootCollector = collector;
    }

    private buildRequestUrl(request: OpenAPIRequest): {
        finalPath: string;
        cookies: string;
    } {
        let finalPath = request.path.replace(/\{([^}]+)\}/g, (_, key) => {
            return request.params.path[key];
        });
        const finalQuery = new URLSearchParams(request.params.query).toString();
        finalPath = `${finalPath.replace(/\{.*?\}$/, "")}${finalQuery ? `?${finalQuery}` : ""}`;
        const cookies = new URLSearchParams(request.cookie).toString();
        return { finalPath, cookies };
    }

    public async execute(headers: Record<string, string> = {}) {
        if (!this.rootCollector) {
            throw new Error("RootOperation has no registered collector");
        }

        type selection = ReturnType<typeof OperationSelectionCollector.prototype.renderSelections>;
        const operations: {
            [key: string]: {
                selection: selection;
                rootSlw: SelectionWrapperImpl<string, string, number, any>;
            };
        } = {};
        for (const [opName, opSelection] of this.rootCollector?.selections.entries()) {
            if (opSelection[SLW_LAZY_FLAG]) continue;

            const rootSlw = opSelection;
            const selection = rootSlw[SLW_PARENT_COLLECTOR]!.renderSelections([], [rootSlw]);

            operations[opName] = {
                selection,
                rootSlw,
            };
        }

        const ops = Object.entries(operations).reduce(
            (acc, [opName, { selection, rootSlw }]) => {
                const bodyVarDefCount = Object.entries(selection.variableDefinitions).filter(
                    ([_, v]) => v.location === "body",
                ).length;
                const body =
                    bodyVarDefCount === 0
                        ? undefined
                        : bodyVarDefCount === 1 && Object.keys(selection.variableDefinitions).length === 1
                          ? selection.variables
                          : bodyVarDefCount === 1 &&
                              "$body" in selection.variableDefinitions &&
                              "$body" in selection.variables
                            ? selection.variables["$body"]
                            : Object.fromEntries(
                                  Object.entries(selection.variableDefinitions)
                                      .filter(([_, v]) => v.location === "body")
                                      .map(([k, _]) => [k, selection.variables[k]]),
                              );

                return {
                    ...acc,
                    [opName]: {
                        path: rootSlw[ROOT_OP_META]!.path,
                        method: rootSlw[ROOT_OP_META]!.method,
                        header: Object.fromEntries(
                            Object.entries(selection.variableDefinitions)
                                .filter(([_, v]) => v.location === "header")
                                .map(([k, v]) => [k, selection.variables[k]]),
                        ),
                        params: {
                            path: Object.fromEntries(
                                Object.entries(selection.variableDefinitions)
                                    .filter(([_, v]) => v.location === "path")
                                    .map(([k, v]) => [k, selection.variables[k]]),
                            ),
                            query: Object.fromEntries(
                                Object.entries(selection.variableDefinitions)
                                    .filter(([_, v]) => v.location === "query")
                                    .map(([k, v]) => [k, selection.variables[k]]),
                            ),
                        },
                        body,
                        cookie: Object.fromEntries(
                            Object.entries(selection.variableDefinitions)
                                .filter(([_, v]) => v.location === "cookie")
                                .map(([k, v]) => [k, selection.variables[k]]),
                        ),
                    },
                };
            },
            {} as Record<string, OpenAPIRequest>,
        );
        // const subscription = `{${subscriptions.join("")}}`;

        const results = Object.fromEntries(
            await Promise.all([
                ...Object.entries(ops).map(
                    async ([opName, op]) => [opName, await this.executeOperation(op, headers)] as const,
                ),
            ]),
        );

        return results;
    }

    private async executeOperation(request: OpenAPIRequest, headers: Record<string, string> = {}) {
        const { finalPath, cookies } = this.buildRequestUrl(request);

        const res = await (RootOperation[OPTIONS].fetcher ?? globalThis.fetch)(`[ENDPOINT]${finalPath}`, {
            method: request.method,
            headers: {
                ...(request.body ? { "Content-Type": "application/json" } : {}),
                ...(request.header ? request.header : {}),
                ...(cookies ? { Cookie: cookies } : {}),
                ...headers,
            },
            body: request.body ? JSON.stringify(request.body) : undefined,
        });

        if (!res.ok) {
            throw new Error(`${res.statusText}: ${await res.text()}`);
        }

        const data = (await res.json()) as any;

        return data;
    }
}

export type OperationSelectionCollectorRef = {
    ref: OperationSelectionCollector;
};
export class OperationSelectionCollector {
    constructor(
        public readonly name?: string,
        public readonly parent?: OperationSelectionCollector | OperationSelectionCollectorRef,
        public readonly op?: RootOperation,
    ) {
        if (op) op.registerRootCollector(this);
    }

    private executed = false;
    private operationResult: any | undefined = undefined;

    /** Path → resolved data / proxied arrays (stable identity for frameworks). */
    public cache: {
        data: Map<string, any>;
        proxiedArray: Map<string, any[]>;
    } = {
        data: new Map(),
        proxiedArray: new Map(),
    };

    public async execute(headers: Record<string, string> = RootOperation[OPTIONS].headers) {
        if (!this.op) {
            throw new Error("OperationSelectionCollector is not registered to a root operation");
        }
        this.operationResult = await this.op.execute(headers);
        this.executed = true;
        return this.operationResult;
    }
    public get isExecuted() {
        return this.executed;
    }

    public readonly selections = new Map<string, SelectionWrapperImpl<string, string, number, any>>();
    public registerSelection(id: string, selection: SelectionWrapperImpl<string, string, number, any, any>) {
        this.selections.set(id, selection);
    }

    public renderSelections(
        path: string[] = [],
        renderOnlyTheseSelections: SelectionWrapperImpl<string, string, number, any>[] = [],
    ) {
        const varDefs: Record<
            string,
            {
                type: string;
                location: "path" | "query" | "header" | "cookie" | "body";
            }
        > = {};
        const variables: Record<string, any> = {};

        for (const [key, value] of [...this.selections.entries()].filter(
            ([k, v]) =>
                renderOnlyTheseSelections.length === 0 ||
                renderOnlyTheseSelections.find((r) => r[SLW_UID] === v[SLW_UID]),
        )) {
            const subPath = [...path, key];
            const { variableDefinitions: fieldVarDefs, variables: fieldVars } = value[SLW_RENDER_WITH_ARGS]();

            Object.assign(variables, fieldVars);
            Object.assign(varDefs, fieldVarDefs);

            value[SLW_REGISTER_PATH](subPath);

            if (value[SLW_PARENT_COLLECTOR] === undefined) {
                // do nothing
            } else if (value[SLW_COLLECTOR] instanceof OperationSelectionCollector) {
                const { variableDefinitions: subVarDefs, variables: subVars } =
                    value[SLW_COLLECTOR].renderSelections(subPath);

                Object.assign(variables, subVars);
                Object.assign(varDefs, subVarDefs);
            }
        }

        return {
            variableDefinitions: varDefs,
            variables,
        };
    }

    private utilGet = (obj: Record<string, any>, path: (string | number)[]) => path.reduce((o, p) => o?.[p], obj);
    public getOperationResultPath<T>(
        path: (string | number)[] = [],
        type?: string,
        opResultDataOverride?: any,
    ): T {
        if (!this.op) {
            throw new Error("OperationSelectionCollector is not registered to a root operation");
        }

        let result = opResultDataOverride ?? this.operationResult;

        if (path.length === 0) return result as T;

        result = this.utilGet(result, path) as T;

        const typeName = type?.replaceAll("!", "");
        if (typeName && result && typeName in RootOperation[OPTIONS].scalars) {
            let depth = 0;
            let finalResult = result instanceof Array ? [...result] : result;

            while (result instanceof Array) {
                result = result[0];
                depth++;
            }

            const deepParse = (res: any | any[], depth: number, parse: (v: string) => any) => {
                if (depth === 0) {
                    return parse(res);
                }
                return res.map((rarr: any) => deepParse(rarr, depth - 1, parse));
            };

            return deepParse(
                finalResult,
                depth,
                RootOperation[OPTIONS].scalars[typeName as keyof (typeof RootOperation)[typeof OPTIONS]["scalars"]] ??
                    ((value: string) => JSON.parse(value)),
            ) as T;
        }

        return result as T;
    }
}

export const SLW_UID = Symbol("SLW_UID");
export const SLW_FIELD_NAME = Symbol("SLW_FIELD_NAME");
export const SLW_FIELD_TYPENAME = Symbol("SLW_FIELD_TYPENAME");
export const SLW_FIELD_ARR_DEPTH = Symbol("SLW_FIELD_ARR_DEPTH");

export const ROOT_OP_META = Symbol("ROOT_OP_META");

export const SLW_VALUE = Symbol("SLW_VALUE");
export const SLW_ARGS = Symbol("SLW_ARGS");
export const SLW_ARGS_META = Symbol("SLW_ARGS_META");
export const SLW_PARENT_SLW = Symbol("SLW_PARENT_SLW");
export const SLW_LAZY_FLAG = Symbol("SLW_LAZY_FLAG");

export const OP = Symbol("OP");
export const ROOT_OP_COLLECTOR = Symbol("ROOT_OP_COLLECTOR");
export const SLW_PARENT_COLLECTOR = Symbol("SLW_PARENT_COLLECTOR");
export const SLW_COLLECTOR = Symbol("SLW_COLLECTOR");
export const SLW_OP_PATH = Symbol("SLW_OP_PATH");
export const SLW_REGISTER_PATH = Symbol("SLW_REGISTER_PATH");
export const SLW_RENDER_WITH_ARGS = Symbol("SLW_RENDER_WITH_ARGS");

export const SLW_OP_RESULT_DATA_OVERRIDE = Symbol("SLW_OP_RESULT_DATA_OVERRIDE");
export const SLW_RECREATE_VALUE_CALLBACK = Symbol("SLW_RECREATE_VALUE_CALLBACK");
export const SLW_NEEDS_CLONE = Symbol("SLW_NEEDS_CLONE");
export const SLW_CLONE = Symbol("SLW_CLONE");

export const OP_SCALAR_RESULT = Symbol("OP_SCALAR_RESULT");
export const SLW_IS_SCALAR_OP = Symbol("SLW_IS_SCALAR_OP");

export class SelectionWrapperImpl<
    fieldName extends string,
    typeNamePure extends string,
    typeArrDepth extends number,
    valueT extends any = any,
    argsT extends Record<string, any> | any | undefined = undefined,
> {
    private generateUniqueId(): string {
        return performance.now().toString(36) + Math.random().toString(36).substring(2);
    }
    [SLW_CLONE](
        overrides: {
            SLW_OP_PATH?: string;
            OP_RESULT_DATA?: any;
            SLW_NEEDS_CLONE?: boolean;
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
            this[SLW_IS_SCALAR_OP],
        );
        slw[ROOT_OP_META] = this[ROOT_OP_META];
        slw[SLW_PARENT_SLW] = this[SLW_PARENT_SLW];
        slw[SLW_OP_PATH] = overrides.SLW_OP_PATH ?? this[SLW_OP_PATH];
        slw[SLW_NEEDS_CLONE] = overrides.SLW_NEEDS_CLONE ? true : this[SLW_NEEDS_CLONE] ? false : true;
        if (overrides.OP_RESULT_DATA !== undefined) {
            slw[SLW_OP_RESULT_DATA_OVERRIDE] = overrides.OP_RESULT_DATA;
        } else if (this[SLW_OP_RESULT_DATA_OVERRIDE] !== undefined) {
            slw[SLW_OP_RESULT_DATA_OVERRIDE] = this[SLW_OP_RESULT_DATA_OVERRIDE];
        }
        // Keep ROOT_OP_COLLECTOR from the new construction; for clones under same op, re-bind to source collector
        if (this[ROOT_OP_COLLECTOR]) {
            slw[ROOT_OP_COLLECTOR] = this[ROOT_OP_COLLECTOR];
        }
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

    [ROOT_OP_META]?: {
        path: string;
        method: "get" | "post" | "put" | "delete" | "patch" | "head" | "options" | "trace";
    };

    [SLW_ARGS]?: argsT;
    [SLW_ARGS_META]?: Record<
        string,
        {
            type: string;
            location: "path" | "query" | "header" | "cookie" | "body";
        }
    >;

    [SLW_PARENT_SLW]?: SelectionWrapperImpl<string, string, number, any, any>;
    [SLW_LAZY_FLAG]?: boolean;

    [SLW_RECREATE_VALUE_CALLBACK]?: () => valueT;
    [SLW_OP_RESULT_DATA_OVERRIDE]?: any;
    [SLW_NEEDS_CLONE]?: boolean;

    [SLW_IS_SCALAR_OP]?: boolean;

    constructor(
        fieldName?: fieldName,
        typeNamePure?: typeNamePure,
        typeArrDepth?: typeArrDepth,
        value?: valueT,
        collector?: OperationSelectionCollector,
        parent?: OperationSelectionCollector | OperationSelectionCollectorRef,
        args?: argsT,
        argsMeta?: Record<
            string,
            {
                type: string;
                location: "path" | "query" | "header" | "cookie" | "body";
            }
        >,
        reCreateValueCallback?: () => valueT,
        isScalarOp?: boolean,
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
            while (rootCollector?.parent instanceof OperationSelectionCollector) {
                rootCollector = rootCollector.parent;
            }
            if (rootCollector.parent && "ref" in rootCollector.parent) {
                this[ROOT_OP_COLLECTOR] = rootCollector.parent;
            }
        }

        if (reCreateValueCallback) {
            this[SLW_RECREATE_VALUE_CALLBACK] = reCreateValueCallback;
        }
        if (isScalarOp !== undefined) {
            this[SLW_IS_SCALAR_OP] = isScalarOp;
        }
    }

    [SLW_OP_PATH]?: string;
    [SLW_REGISTER_PATH](path: string[]) {
        if (!this[SLW_OP_PATH]) this[SLW_OP_PATH] = path.join(".");
    }
    [SLW_RENDER_WITH_ARGS]() {
        if (this[SLW_ARGS]) {
            const args = this[SLW_ARGS];
            const argsMeta = this[SLW_ARGS_META]!;

            if (typeof args !== "object" || Array.isArray(args)) {
                return {
                    variables: args,
                    variableDefinitions: argsMeta,
                };
            }

            return {
                variables: args ?? {},
                variableDefinitions: argsMeta?.["$body"]
                    ? (argsMeta ?? {})
                    : args
                      ? Object.keys(args).reduce(
                            (acc, key) => {
                                acc[key] = argsMeta?.[key];
                                return acc;
                            },
                            {} as Record<
                                string,
                                {
                                    type: string;
                                    location: "path" | "query" | "header" | "cookie" | "body";
                                }
                            >,
                        )
                      : {},
            };
        }
        return {
            variables: {},
            variableDefinitions: {} as Record<
                string,
                {
                    type: string;
                    location: "path" | "query" | "header" | "cookie" | "body";
                }
            >,
        };
    }
}
export class SelectionWrapper<
    fieldName extends string,
    typeNamePure extends string,
    typeArrDepth extends number,
    valueT extends any = any,
    argsT extends Record<string, any> | any | undefined = undefined,
> extends Proxy<SelectionWrapperImpl<fieldName, typeNamePure, typeArrDepth, valueT, argsT>> {
    constructor(
        fieldName?: fieldName,
        typeNamePure?: typeNamePure,
        typeArrDepth?: typeArrDepth,
        value?: valueT,
        collector?: OperationSelectionCollector,
        parent?: OperationSelectionCollector | OperationSelectionCollectorRef,
        args?: argsT,
        argsMeta?: Record<
            string,
            {
                type: string;
                location: "path" | "query" | "header" | "cookie" | "body";
            }
        >,
        reCreateValueCallback?: () => valueT,
        isScalarOp?: boolean,
    ) {
        super(
            new SelectionWrapperImpl<fieldName, typeNamePure, typeArrDepth, valueT, argsT>(
                fieldName,
                typeNamePure,
                typeArrDepth,
                value,
                collector,
                parent,
                args,
                argsMeta,
                reCreateValueCallback,
                isScalarOp,
            ),
            (() => {
                const getCache = (t: SelectionWrapperImpl<fieldName, typeNamePure, typeArrDepth, valueT, argsT>) => {
                    if (t[SLW_OP_RESULT_DATA_OVERRIDE] || !t[ROOT_OP_COLLECTOR]) {
                        return { data: new Map(), proxiedArray: new Map() };
                    }
                    return t[ROOT_OP_COLLECTOR].ref.cache;
                };

                const getResultDataForTarget = (
                    t: SelectionWrapperImpl<fieldName, typeNamePure, typeArrDepth, valueT, argsT>,
                    overrideOpPath?: string,
                ): valueT | undefined => {
                    if (!t[ROOT_OP_COLLECTOR]) return undefined;
                    const cache = getCache(t);
                    const path = overrideOpPath ?? t[SLW_OP_PATH] ?? undefined;

                    if (path && cache.data.has(path) && !t[SLW_NEEDS_CLONE]) return cache.data.get(path);

                    const data = t[ROOT_OP_COLLECTOR].ref.getOperationResultPath<valueT>(
                        (path?.split(".") ?? []).map((p) => (!isNaN(+p) ? +p : p)),
                        t[SLW_FIELD_TYPENAME],
                        t[SLW_OP_RESULT_DATA_OVERRIDE],
                    );

                    if (path && !t[SLW_OP_RESULT_DATA_OVERRIDE]) cache.data.set(path, data);
                    return data;
                };

                return {
                    ownKeys(target) {
                        if (target[SLW_FIELD_ARR_DEPTH]) {
                            return Reflect.ownKeys(new Array(target[SLW_FIELD_ARR_DEPTH]));
                        }
                        return Reflect.ownKeys(value ?? {});
                    },
                    getOwnPropertyDescriptor(target, prop) {
                        if (target[SLW_FIELD_ARR_DEPTH]) {
                            return Reflect.getOwnPropertyDescriptor(new Array(target[SLW_FIELD_ARR_DEPTH]), prop);
                        }
                        return Reflect.getOwnPropertyDescriptor(value ?? {}, prop);
                    },
                    has(target, prop) {
                        if (prop === Symbol.for("nodejs.util.inspect.custom")) return true;
                        if (prop === Symbol.iterator && typeArrDepth) {
                            const dataArr = getResultDataForTarget(target);
                            if (Array.isArray(dataArr)) return true;
                            if (dataArr === undefined || dataArr === null) return false;
                        }
                        if (target[SLW_FIELD_ARR_DEPTH]) {
                            return Reflect.has(new Array(target[SLW_FIELD_ARR_DEPTH]), prop);
                        }
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
                                    ref: new OperationSelectionCollector(undefined, undefined, new RootOperation()),
                                };

                                const newThisCollector = new OperationSelectionCollector(
                                    undefined,
                                    newRootOpCollectorRef,
                                );
                                const r = that[SLW_RECREATE_VALUE_CALLBACK]?.bind(newThisCollector)();

                                const newThat = new SelectionWrapper(
                                    that[SLW_FIELD_NAME],
                                    that[SLW_FIELD_TYPENAME],
                                    that[SLW_FIELD_ARR_DEPTH],
                                    r,
                                    newThisCollector,
                                    that[SLW_PARENT_COLLECTOR] ? newRootOpCollectorRef : undefined,
                                    that[SLW_ARGS],
                                    that[SLW_ARGS_META],
                                    that[SLW_RECREATE_VALUE_CALLBACK],
                                    that[SLW_IS_SCALAR_OP],
                                );
                                Object.keys(r!).forEach((key) => (newThat as valueT)[key as keyof valueT]);

                                newThat[ROOT_OP_META] = that[ROOT_OP_META];

                                newThat[SLW_PARENT_SLW] = parentSlw;
                                parentSlw[SLW_COLLECTOR]?.registerSelection(key, newThat);
                                newThat[SLW_ARGS] = {
                                    ...(that[SLW_ARGS] ?? {}),
                                    ...(args as any),
                                } as argsT;

                                newThat[SLW_OP_PATH] = that[SLW_OP_PATH];

                                newRootOpCollectorRef.ref.registerSelection(newThat[SLW_FIELD_NAME]!, newThat);

                                const isScalar = newThat[SLW_PARENT_COLLECTOR] === undefined;

                                return new Promise((resolve, reject) => {
                                    newRootOpCollectorRef.ref
                                        .execute()
                                        .catch(reject)
                                        .then((_data) => {
                                            if (_data === undefined || _data === null) {
                                                return resolve(_data);
                                            }

                                            const fieldName = newThat[SLW_FIELD_NAME]!;
                                            const d = _data[fieldName];

                                            if (typeof d === "object" && d && fieldName in d) {
                                                const retval = d[fieldName];
                                                if (retval === undefined || retval === null) {
                                                    return resolve(retval);
                                                }
                                                const ret = isScalar
                                                    ? getResultDataForTarget(newThat as any)
                                                    : proxify(retval, newThat);
                                                return resolve(ret);
                                            }

                                            // One-shot body is the op value directly under opName
                                            if (d === undefined || d === null) {
                                                return resolve(d);
                                            }
                                            if (typeof d === "object" && !isScalar) {
                                                return resolve(proxify(d, newThat));
                                            }
                                            return resolve(
                                                isScalar ? getResultDataForTarget(newThat as any) : newThat,
                                            );
                                        });
                                });
                            }
                            target[SLW_LAZY_FLAG] = true;
                            lazy[SLW_LAZY_FLAG] = true;
                            return lazy;
                        }
                        if (prop === SLW_VALUE && target[SLW_IS_SCALAR_OP]) {
                            return (target[SLW_VALUE] as any)[OP_SCALAR_RESULT];
                        }
                        if (
                            prop === SLW_UID ||
                            prop === SLW_FIELD_NAME ||
                            prop === SLW_FIELD_TYPENAME ||
                            prop === SLW_FIELD_ARR_DEPTH ||
                            prop === ROOT_OP_META ||
                            prop === SLW_ARGS ||
                            prop === SLW_ARGS_META ||
                            prop === SLW_PARENT_SLW ||
                            prop === SLW_LAZY_FLAG ||
                            prop === ROOT_OP_COLLECTOR ||
                            prop === SLW_PARENT_COLLECTOR ||
                            prop === SLW_COLLECTOR ||
                            prop === SLW_OP_PATH ||
                            prop === SLW_VALUE ||
                            prop === SLW_REGISTER_PATH ||
                            prop === SLW_RENDER_WITH_ARGS ||
                            prop === SLW_RECREATE_VALUE_CALLBACK ||
                            prop === SLW_OP_RESULT_DATA_OVERRIDE ||
                            prop === SLW_CLONE ||
                            prop === SLW_NEEDS_CLONE ||
                            prop === SLW_IS_SCALAR_OP
                        ) {
                            return target[
                                prop as keyof SelectionWrapperImpl<fieldName, typeNamePure, typeArrDepth, valueT>
                            ];
                        }
                        if (prop === SLW_VALUE) {
                            return value;
                        }
                        if (prop === "then") {
                            return this;
                        }

                        let slw_value = target[SLW_VALUE] as Record<string, any> | undefined;

                        if (target[ROOT_OP_COLLECTOR]?.ref.isExecuted) {

                            if (!Object.hasOwn(slw_value ?? {}, String(prop))) {
                                const _data = getResultDataForTarget(target);
                                const path = target[SLW_OP_PATH]!;

                                if (typeArrDepth && Array.isArray(_data)) {
                                    if (!isNaN(+String(prop))) {
                                        const elm = target[SLW_CLONE]({
                                            SLW_OP_PATH: path + "." + String(prop),
                                            OP_RESULT_DATA: target[SLW_OP_RESULT_DATA_OVERRIDE],
                                        });
                                        const d = _data[Number(prop)];
                                        if (typeof d === "undefined" || d === null) {
                                            return d;
                                        }
                                        return typeof d === "object" ? proxify(d, elm) : elm;
                                    }

                                    const data = _data as valueT[] | undefined;
                                    if (data === undefined) return undefined;
                                    if (data === null) return null;

                                    const cache = getCache(target);
                                    const proxiedData =
                                        cache.proxiedArray.get(path) ??
                                        Array.from({ length: data.length }, (_, i) =>
                                            typeof data[i] === "object" && data[i] !== null
                                                ? proxify(
                                                      data[i],
                                                      target[SLW_CLONE]({
                                                          SLW_OP_PATH: path + "." + String(i),
                                                          OP_RESULT_DATA: target[SLW_OP_RESULT_DATA_OVERRIDE],
                                                      }),
                                                  )
                                                : target[SLW_CLONE]({
                                                      SLW_OP_PATH: path + "." + String(i),
                                                      OP_RESULT_DATA: target[SLW_OP_RESULT_DATA_OVERRIDE],
                                                  }),
                                        );

                                    if (!cache.proxiedArray.has(path)) {
                                        cache.proxiedArray.set(path, proxiedData);
                                    }

                                    const proto = Object.getPrototypeOf(proxiedData);
                                    if (Object.hasOwn(proto, prop)) {
                                        const v = (proxiedData as any)[prop];
                                        if (typeof v === "function") return v.bind(proxiedData);
                                        return v;
                                    }

                                    return (proxiedData as any)[prop];
                                }

                                const data = _data as valueT | undefined;
                                if (data === undefined) return undefined;
                                if (data === null) return null;

                                const proto = Object.getPrototypeOf(data);
                                if (Object.hasOwn(proto, prop)) {
                                    const v = (data as any)[prop];
                                    if (typeof v === "function") return v.bind(data);
                                    return v;
                                }

                                return (data as any)[prop];
                            }

                            let slw = slw_value?.[String(prop)];
                            if (slw === undefined) return undefined;
                            if (slw === null) return null;
                            if (typeof slw !== "object") return slw;

                            let slwOpPathIsIndexAccessOrInArray = false;
                            let targetOpPathArr = target[SLW_OP_PATH]?.split(".") ?? [];
                            while (targetOpPathArr.length) {
                                if (!isNaN(+targetOpPathArr.pop()!)) {
                                    slwOpPathIsIndexAccessOrInArray = true;
                                    break;
                                }
                            }
                            if (
                                slw instanceof SelectionWrapperImpl &&
                                (slwOpPathIsIndexAccessOrInArray ||
                                    (target[SLW_OP_RESULT_DATA_OVERRIDE] && !slw[SLW_OP_RESULT_DATA_OVERRIDE]))
                            ) {
                                if (target[SLW_NEEDS_CLONE]) {
                                    slw = slw[SLW_CLONE]({
                                        SLW_OP_PATH: target[SLW_OP_PATH] + "." + String(prop),
                                        OP_RESULT_DATA: target[SLW_OP_RESULT_DATA_OVERRIDE],
                                        SLW_NEEDS_CLONE: true,
                                    });
                                } else {
                                    slw[SLW_OP_PATH] = target[SLW_OP_PATH] + "." + String(prop);
                                    slw[SLW_OP_RESULT_DATA_OVERRIDE] = target[SLW_OP_RESULT_DATA_OVERRIDE];
                                }
                            }

                            if (slw instanceof SelectionWrapperImpl && slw[SLW_FIELD_ARR_DEPTH]) {
                                const dataArr = getResultDataForTarget(slw) as unknown[] | undefined | null;
                                if (dataArr === undefined) return undefined;
                                if (dataArr === null) return null;
                                if (!dataArr?.length) {
                                    return [];
                                }
                                if (slw[SLW_PARENT_COLLECTOR]) {
                                    return proxify(dataArr, slw);
                                }
                            } else if (slw instanceof SelectionWrapperImpl) {
                                const data = getResultDataForTarget(slw) as unknown | undefined | null;
                                if (data === undefined) return undefined;
                                if (data === null) return null;

                                if (slw[SLW_PARENT_COLLECTOR] && typeof data === "object") {
                                    return proxify(data, slw);
                                }
                            }

                            if (slw instanceof SelectionWrapperImpl) {
                                return getResultDataForTarget(slw);
                            } else if (slw[SLW_LAZY_FLAG]) {
                                return slw;
                            }

                            return getResultDataForTarget(target);
                        }

                        if (
                            Object.hasOwn(slw_value ?? {}, String(prop)) &&
                            slw_value?.[String(prop)] instanceof SelectionWrapperImpl
                        ) {
                            if (target[SLW_COLLECTOR]) {
                                target[SLW_COLLECTOR].registerSelection(String(prop), slw_value[String(prop)]);
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
                };
            })(),
        );
    }
}
