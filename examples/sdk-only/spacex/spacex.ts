const Proxy = globalThis.Proxy;
Proxy.prototype = {};

function proxify(data: any, slw: any): any & ArrayLike<any> {
    // Create proxy around empty array (ensures Array.isArray(proxy) === true)
    const proxy = new Proxy(data as any | any[], {
        get(target: any[], prop: PropertyKey, receiver: any): any {
            return Reflect.get(slw, prop, receiver);
        },
        set(
            target: any[],
            prop: PropertyKey,
            value: any,
            receiver: any,
        ): boolean {
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
        getOwnPropertyDescriptor(
            target: any[],
            prop: PropertyKey,
        ): PropertyDescriptor | undefined {
            return Reflect.getOwnPropertyDescriptor(target, prop);
        },
        getPrototypeOf(target: any[]): object | null {
            // Return Array.prototype for better array-like behavior (e.g., instanceof Array)
            return Object.getPrototypeOf(target);
        },
        // Add more traps as needed for full array-like behavior (e.g., apply/construct if callable)
    });

    // Optionally, augment here (e.g., add methods or computed props via additional get trap logic)
    return proxy as unknown as any & ArrayLike<any>;
}

type FnOrPromisOrPrimitive =
    | (() => string | { [key: string]: string } | undefined)
    | (() => Promise<string | { [key: string]: string } | undefined>)
    | string
    | { [key: string]: string };
export const _ = Symbol("_") as any;
export const OPTIONS = Symbol("OPTIONS");
export const PLUGINS = Symbol("PLUGINS");
export class RootOperation {
    public static authHeaderName = "[AUTH_HEADER_NAME]";
    private resolveFnOrPromisOrPrimitiveHeaders = (
        arg?: FnOrPromisOrPrimitive,
    ) => {
        if (!arg) return undefined;
        let headers: Record<string, string> | undefined = undefined;
        if (typeof arg === "string") {
            headers = { [RootOperation.authHeaderName]: arg };
        } else if (typeof arg === "function") {
            const tokenOrPromise = arg();
            if (tokenOrPromise instanceof Promise) {
                return tokenOrPromise.then((t) => {
                    if (typeof t === "string")
                        headers = { [RootOperation.authHeaderName]: t };
                    else headers = t;

                    return headers;
                });
            }
            if (typeof tokenOrPromise === "string") {
                headers = { [RootOperation.authHeaderName]: tokenOrPromise };
            } else {
                headers = tokenOrPromise;
            }
        } else {
            headers = arg;
        }

        return headers;
    };

    constructor(
        public authArg?: FnOrPromisOrPrimitive,
        public headers?: FnOrPromisOrPrimitive,
    ) {}
    public setAuth(auth: FnOrPromisOrPrimitive) {
        this.authArg = auth;
        return this;
    }
    public setHeaders(headers: FnOrPromisOrPrimitive) {
        this.headers = headers;
        return this;
    }

    public static [OPTIONS] = {
        headers: {},
        fetcher: undefined as unknown as (
            input: string | URL | globalThis.Request,
            init?: RequestInit,
        ) => Promise<Response>,
        sseFetchTransform: undefined as unknown as (
            input: string | URL | globalThis.Request,
            init?: RequestInit,
        ) => Promise<
            [string | URL | globalThis.Request, RequestInit | undefined]
        >,

        _auth_fn: undefined as
            | (() => string | { [key: string]: string } | undefined)
            | (() => Promise<string | { [key: string]: string } | undefined>)
            | undefined,
        scalars: {
            DateTime: (value: string) => new Date(value),
            DateTimeISO: (value: string) => new Date(value),
            Date: (value: string) => new Date(value),
            Time: (value: string) => new Date(value),
            JSON: (value: string) => JSON.parse(value),
        },
    };

    private static [PLUGINS]: {
        onSLWConstruct?: (
            slw: SelectionWrapperImpl<any, any, any, any, any>,
        ) => void;
        onSLWSetTrap?: (
            target: SelectionWrapperImpl<any, any, any, any, any>,
            p: PropertyKey,
            newValue: any,
            receiver: any,
        ) => void;
        onGetResultData?: (
            t: SelectionWrapperImpl<any, any, any, any, any>,
            path?: string,
        ) => void;
    }[] = [];
    private static hasPlugins = false;
    public static setPlugins(plugins: (typeof RootOperation)[typeof PLUGINS]) {
        RootOperation[PLUGINS] = plugins;
        RootOperation.hasPlugins = plugins.length > 0;
    }
    public static runPlugins<
        N extends keyof (typeof RootOperation)[typeof PLUGINS][number],
    >(
        name: N,
        ...args: Parameters<
            NonNullable<(typeof RootOperation)[typeof PLUGINS][number][N]>
        >
    ) {
        if (!RootOperation.hasPlugins) return;
        for (const plugin of RootOperation[PLUGINS]) {
            const fn = plugin[name as keyof typeof plugin];
            if (fn) (fn as (...args: any[]) => any).apply(undefined, args);
        }
    }

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
        if (!this.rootCollector?.op) {
            throw new Error("RootOperation has no registered collector");
        }

        const authHeaders =
            await this.rootCollector.op!.resolveFnOrPromisOrPrimitiveHeaders(
                this.rootCollector.op!.authArg ??
                    RootOperation[OPTIONS]._auth_fn,
            );
        const headersHeaders =
            await this.rootCollector.op!.resolveFnOrPromisOrPrimitiveHeaders(
                this.rootCollector.op!.headers ??
                    RootOperation[OPTIONS].headers,
            );

        headers = {
            ...authHeaders,
            ...headersHeaders,
            ...headers,
        };

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
                    opType: rootSlw[SLW_IS_ROOT_TYPE]?.toLowerCase() as
                        | "subscription"
                        | "query"
                        | "mutation",
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
                    opType: "subscription" | "query" | "mutation";
                    query: string;
                    variables: any;
                    fragments: Map<string, string>;
                }
            >,
        );

        const results = Object.fromEntries(
            await Promise.all([
                ...Object.entries(ops).map(
                    async ([opName, op]) =>
                        [
                            opName,
                            op.opType === "subscription"
                                ? await this.subscribeOperation(op, headers)
                                : await this.executeOperation(op, headers),
                        ] as const,
                ),
            ]),
        );

        return results;
    }

    private async subscribeOperation(
        query: {
            opType: "subscription" | "query" | "mutation";
            query: string;
            variables: any;
            fragments: Map<string, string>;
        },
        headers: Record<string, string> = {},
    ): Promise<AsyncGenerator<any, void, unknown>> {
        const that = this;
        const generator = (async function* () {
            const [url, options] = (await (
                RootOperation[OPTIONS].sseFetchTransform ??
                ((url: string, options?: RequestInit) => [url, options])
            )("https://spacex-production.up.railway.app", {
                method: "POST",
                headers: {
                    ...headers,
                    "Content-Type": "application/json",
                    Accept: "text/event-stream",
                },
                body: JSON.stringify({
                    query: `${[...query.fragments.values()].join("\n")}\n ${query.query}`.trim(),
                    variables: query.variables,
                }),
            })) as [string | URL | Request, RequestInit];
            const response = await (
                RootOperation[OPTIONS].fetcher ?? globalThis.fetch
            )(url, {
                ...options,
                headers: {
                    ...options?.headers,
                    "Content-Type": "application/json",
                    Accept: "text/event-stream",
                },
            });

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split("\n\n");
                buffer = events.pop() || "";

                for (const event of events) {
                    if (event.trim()) {
                        const eventName = event.match(/^event: (.*)$/m)?.[1];
                        const rawdata = event.match(/^data: (.*)$/m)?.[1];

                        if ((eventName === null && rawdata === "") || !rawdata)
                            continue;
                        if (eventName === "complete" || done) break;

                        const parsed = JSON.parse(rawdata) as {
                            data: any;
                            errors: any[];
                        };
                        const { data, errors } = parsed ?? {};
                        if (errors?.length > 0) {
                            if (!data) {
                                const err = new Error(JSON.stringify(errors), {
                                    cause: "Only errors were returned from the server.",
                                });
                                throw err;
                            }
                            for (const error of errors) {
                                if (error.path) {
                                    that.utilSet(data, error.path, error);
                                }
                            }
                        }

                        yield data;
                    }
                }
            }

            return;
        })();

        return generator;
    }

    private async executeOperation(
        query: {
            opType: "subscription" | "query" | "mutation";
            query: string;
            variables: any;
            fragments: Map<string, string>;
        },
        headers: Record<string, string> = {},
    ) {
        const res = await (RootOperation[OPTIONS].fetcher ?? globalThis.fetch)(
            "https://spacex-production.up.railway.app",
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
            if (!data) {
                const err = new Error(JSON.stringify(errors), {
                    cause: "Only errors were returned from the server.",
                });
                throw err;
            }
            for (const error of errors) {
                if (error.path) {
                    this.utilSet(data, error.path, error);
                }
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

    public cache: {
        data: Map<string, any>;
        proxiedArray: Map<string, any[]>;
    } = {
        data: new Map(),
        proxiedArray: new Map(),
    };

    public async execute(headers?: Record<string, string>) {
        if (!this.op) {
            throw new Error(
                "OperationSelectionCollector is not registered to a root operation",
            );
        }
        this.operationResult = await this.op.execute(headers);
        this.executed = true;
        return this.operationResult;
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
        _type?: string,
        opResultDataOverride?: any,
    ): T {
        if (!this.op) {
            throw new Error(
                "OperationSelectionCollector is not registered to a root operation",
            );
        }

        let result = opResultDataOverride ?? this.operationResult;

        if (path.length === 0) return result as T;

        result = this.utilGet(result, path) as T;

        const type = _type?.replaceAll("!", "");
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
                ] ?? ((value: string) => JSON.parse(value)),
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

export const SLW_OP_RESULT_DATA_OVERRIDE = Symbol(
    "SLW_OP_RESULT_DATA_OVERRIDE",
);

export const SLW_RECREATE_VALUE_CALLBACK = Symbol(
    "SLW_RECREATE_VALUE_CALLBACK",
);
export const SLW_SETTER_DATA_OVERRIDE = Symbol("SLW_SETTER_DATA_OVERRIDE");
export const SLW_NEEDS_CLONE = Symbol("SLW_NEEDS_CLONE");

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
            OP_RESULT_DATA?: any;
            SLW_SETTER_DATA_OVERRIDE?: any;
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
        );
        slw[SLW_IS_ROOT_TYPE] = this[SLW_IS_ROOT_TYPE];
        slw[SLW_IS_ON_TYPE_FRAGMENT] = this[SLW_IS_ON_TYPE_FRAGMENT];
        slw[SLW_IS_FRAGMENT] = this[SLW_IS_FRAGMENT];
        slw[SLW_PARENT_SLW] = this[SLW_PARENT_SLW];
        slw[SLW_OP_PATH] = overrides.SLW_OP_PATH ?? this[SLW_OP_PATH];
        slw[SLW_SETTER_DATA_OVERRIDE] =
            overrides.SLW_SETTER_DATA_OVERRIDE ??
            this[SLW_SETTER_DATA_OVERRIDE];

        slw[SLW_NEEDS_CLONE] = overrides.SLW_NEEDS_CLONE
            ? true
            : this[SLW_NEEDS_CLONE]
              ? false
              : true;

        if (overrides.OP_RESULT_DATA) {
            slw[SLW_OP_RESULT_DATA_OVERRIDE] = overrides.OP_RESULT_DATA;
        }

        if (this[ROOT_OP_COLLECTOR]) {
            slw[ROOT_OP_COLLECTOR] = this[ROOT_OP_COLLECTOR];
        }

        return slw;
    }

    [SLW_UID] = this.generateUniqueId();
    [ROOT_OP_COLLECTOR]?: OperationSelectionCollectorRef;
    [SLW_PARENT_COLLECTOR]?: OperationSelectionCollector;
    [SLW_COLLECTOR]?: OperationSelectionCollector;

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

    [SLW_OP_RESULT_DATA_OVERRIDE]?: any;
    [SLW_SETTER_DATA_OVERRIDE]?: any;
    [SLW_NEEDS_CLONE]?: boolean;

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

        RootOperation.runPlugins("onSLWConstruct", this);
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
            const argsStringParts: string[] = [];
            for (const key of Object.keys(args)) {
                let varName = key;
                if (opVars[key] !== undefined) {
                    varName = `${key}_${Object.keys(opVars).filter((k) => k.startsWith(key)).length}`;
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
            (() => {
                const getCache = (
                    t: SelectionWrapperImpl<
                        fieldName,
                        typeNamePure,
                        typeArrDepth,
                        valueT,
                        argsT
                    >,
                ) =>
                    t[SLW_OP_RESULT_DATA_OVERRIDE]
                        ? { data: new Map(), proxiedArray: new Map() }
                        : t[ROOT_OP_COLLECTOR]!.ref.cache;

                const getResultDataForTarget = (
                    t: SelectionWrapperImpl<
                        fieldName,
                        typeNamePure,
                        typeArrDepth,
                        valueT,
                        argsT
                    >,
                    overrideOpPath?: string,
                    skipPlugins?: boolean,
                ): valueT | undefined => {
                    const cache = getCache(t);

                    const path = overrideOpPath ?? t[SLW_OP_PATH] ?? undefined;

                    if (!skipPlugins)
                        RootOperation.runPlugins("onGetResultData", t, path);

                    if (path && cache.data.has(path) && !t[SLW_NEEDS_CLONE])
                        return cache.data.get(path);

                    const data = t[
                        ROOT_OP_COLLECTOR
                    ]!.ref.getOperationResultPath<valueT>(
                        (path?.split(".") ?? []).map((p) =>
                            !isNaN(+p) ? +p : p,
                        ),
                        t[SLW_FIELD_TYPENAME],
                        t[SLW_OP_RESULT_DATA_OVERRIDE],
                    );

                    if (path) cache.data.set(path, data);
                    return data;
                };

                return {
                    // implement ProxyHandler methods
                    ownKeys(target) {
                        if (target[SLW_FIELD_ARR_DEPTH]) {
                            return Reflect.ownKeys(
                                new Array(target[SLW_FIELD_ARR_DEPTH]),
                            );
                        }
                        return Reflect.ownKeys(value ?? {});
                    },
                    getOwnPropertyDescriptor(target, prop) {
                        if (target[SLW_FIELD_ARR_DEPTH]) {
                            return Reflect.getOwnPropertyDescriptor(
                                new Array(target[SLW_FIELD_ARR_DEPTH]),
                                prop,
                            );
                        }
                        return Reflect.getOwnPropertyDescriptor(
                            value ?? {},
                            prop,
                        );
                    },
                    has(target, prop) {
                        if (prop === Symbol.for("nodejs.util.inspect.custom"))
                            return true;
                        if (prop === Symbol.iterator && typeArrDepth) {
                            const dataArr = getResultDataForTarget(
                                target,
                                undefined,
                                true,
                            );
                            if (Array.isArray(dataArr)) return true;
                            if (dataArr === undefined || dataArr === null)
                                return false;
                        }
                        if (target[SLW_FIELD_ARR_DEPTH]) {
                            return Reflect.has(
                                new Array(target[SLW_FIELD_ARR_DEPTH]),
                                prop,
                            );
                        }

                        return Reflect.has(value ?? {}, prop);
                    },
                    set(target, p, newValue, receiver) {
                        RootOperation.runPlugins(
                            "onSLWSetTrap",
                            target,
                            p,
                            newValue,
                            receiver,
                        );

                        const pstr = String(p);
                        if (
                            typeof p === "symbol" &&
                            (pstr.startsWith("Symbol(SLW_") ||
                                pstr == "Symbol(ROOT_OP_COLLECTOR)")
                        ) {
                            return Reflect.set(target, p, newValue, receiver);
                        }

                        return Reflect.set(
                            target,
                            SLW_SETTER_DATA_OVERRIDE,
                            {
                                ...(target[SLW_SETTER_DATA_OVERRIDE] ?? {}),
                                [p]: newValue,
                            },
                            receiver,
                        );
                    },
                    get: (target, prop) => {
                        if (
                            target[SLW_SETTER_DATA_OVERRIDE] &&
                            target[SLW_SETTER_DATA_OVERRIDE][prop]
                        ) {
                            return target[SLW_SETTER_DATA_OVERRIDE][prop];
                        }
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
                                        new RootOperation(
                                            that[
                                                ROOT_OP_COLLECTOR
                                            ]!.ref.op!.authArg,
                                            that[
                                                ROOT_OP_COLLECTOR
                                            ]!.ref.op!.headers,
                                        ),
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
                                    )?.() ?? {};

                                const newThat = new SelectionWrapper(
                                    that[SLW_FIELD_NAME],
                                    that[SLW_FIELD_TYPENAME],
                                    that[SLW_FIELD_ARR_DEPTH],
                                    r,
                                    newThisCollector,
                                    // only set parent collector, if 'that' had one,
                                    // the absence indicates, that 'that' is a scalar field
                                    // without a subselection!
                                    that[SLW_PARENT_COLLECTOR]
                                        ? newRootOpCollectorRef
                                        : undefined,
                                    that[SLW_ARGS],
                                    that[SLW_ARGS_META],
                                );
                                newThat[SLW_UID] = that[SLW_UID];

                                Object.keys(r!).forEach(
                                    (key) =>
                                        (newThat as valueT)[
                                            key as keyof valueT
                                        ],
                                );

                                newThat[SLW_IS_ROOT_TYPE] =
                                    that[SLW_IS_ROOT_TYPE];
                                newThat[SLW_IS_ON_TYPE_FRAGMENT] =
                                    that[SLW_IS_ON_TYPE_FRAGMENT];
                                newThat[SLW_IS_FRAGMENT] =
                                    that[SLW_IS_FRAGMENT];

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

                                const isScalar =
                                    newThat[SLW_PARENT_COLLECTOR] === undefined;

                                const resultProxy = new Proxy(
                                    {},
                                    {
                                        get(_t, _prop) {
                                            const result = new Promise(
                                                (resolve, reject) => {
                                                    newRootOpCollectorRef.ref
                                                        .execute()
                                                        .catch(reject)
                                                        .then((_data) => {
                                                            const fieldName =
                                                                newThat[
                                                                    SLW_FIELD_NAME
                                                                ]!;
                                                            const d =
                                                                _data[
                                                                    fieldName
                                                                ];

                                                            if (
                                                                Symbol.asyncIterator in
                                                                d
                                                            ) {
                                                                return resolve(
                                                                    newThat,
                                                                );
                                                            }
                                                            if (
                                                                typeof d ===
                                                                    "object" &&
                                                                d &&
                                                                fieldName in d
                                                            ) {
                                                                const retval =
                                                                    d[
                                                                        fieldName
                                                                    ];
                                                                if (
                                                                    retval ===
                                                                        undefined ||
                                                                    retval ===
                                                                        null
                                                                ) {
                                                                    return resolve(
                                                                        retval,
                                                                    );
                                                                }
                                                                const ret =
                                                                    isScalar
                                                                        ? getResultDataForTarget(
                                                                              newThat as SelectionWrapper<
                                                                                  fieldName,
                                                                                  typeNamePure,
                                                                                  typeArrDepth,
                                                                                  valueT,
                                                                                  argsT
                                                                              >,
                                                                          )
                                                                        : proxify(
                                                                              retval,
                                                                              newThat,
                                                                          );
                                                                return resolve(
                                                                    ret,
                                                                );
                                                            }

                                                            return resolve(
                                                                newThat,
                                                            );
                                                        });
                                                },
                                            );
                                            if (String(_prop) === "then") {
                                                return result.then.bind(result);
                                            }
                                            return result;
                                        },
                                    },
                                ) as any;

                                return new Proxy(
                                    {},
                                    {
                                        get(_t, _prop) {
                                            if (String(_prop) === "auth") {
                                                return (
                                                    auth: FnOrPromisOrPrimitive,
                                                ) => {
                                                    newRootOpCollectorRef.ref.op!.setAuth(
                                                        auth,
                                                    );
                                                    return resultProxy;
                                                };
                                            }
                                            return resultProxy[_prop];
                                        },
                                    },
                                );
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
                            prop === SLW_OP_RESULT_DATA_OVERRIDE ||
                            prop === SLW_CLONE ||
                            prop === SLW_SETTER_DATA_OVERRIDE ||
                            prop === SLW_NEEDS_CLONE
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
                            if (prop === Symbol.asyncIterator) {
                                const asyncGenRootPath =
                                    target[SLW_OP_PATH]?.split(".")?.[0];
                                const asyncGen = getResultDataForTarget(
                                    target,
                                    asyncGenRootPath,
                                    true,
                                ) as AsyncGenerator<valueT, any, any>;
                                const isScalar =
                                    target[SLW_PARENT_COLLECTOR] === undefined;

                                return function () {
                                    return {
                                        next() {
                                            return asyncGen
                                                .next()
                                                .then((val) => {
                                                    const clonedSlw = target[
                                                        SLW_CLONE
                                                    ]({
                                                        SLW_OP_PATH:
                                                            asyncGenRootPath,
                                                        OP_RESULT_DATA: isScalar
                                                            ? {
                                                                  [asyncGenRootPath!]:
                                                                      val.value,
                                                              }
                                                            : val.value,

                                                        // this is only for subscriptions
                                                        SLW_NEEDS_CLONE: true,
                                                    });
                                                    const ret =
                                                        typeof val.value ===
                                                        "object"
                                                            ? proxify(
                                                                  val.value,
                                                                  clonedSlw,
                                                              )
                                                            : clonedSlw;
                                                    return {
                                                        done: val.done,
                                                        value: isScalar
                                                            ? ret[
                                                                  asyncGenRootPath!
                                                              ]
                                                            : ret,
                                                    };
                                                });
                                        },
                                    };
                                };
                            }

                            if (!Object.hasOwn(slw_value ?? {}, String(prop))) {
                                const _data = getResultDataForTarget(target);
                                const path = target[SLW_OP_PATH]!;

                                // check if the selected field is an array
                                if (typeArrDepth && Array.isArray(_data)) {
                                    if (!isNaN(+String(prop))) {
                                        const elm = target[SLW_CLONE]({
                                            SLW_OP_PATH:
                                                path + "." + String(prop),
                                            OP_RESULT_DATA:
                                                target[
                                                    SLW_OP_RESULT_DATA_OVERRIDE
                                                ],
                                        });
                                        return proxify(
                                            _data[Number(prop)],
                                            elm,
                                        );
                                    }

                                    const data = _data as valueT[] | undefined;

                                    if (data === undefined) return undefined;
                                    const cache = getCache(target);

                                    const proxiedData =
                                        cache.proxiedArray.get(
                                            target[SLW_OP_PATH]!,
                                        ) ??
                                        Array.from(
                                            { length: data.length },
                                            (_, i) =>
                                                typeof data[i] === "object"
                                                    ? proxify(
                                                          data[i],
                                                          target[SLW_CLONE]({
                                                              SLW_OP_PATH:
                                                                  target[
                                                                      SLW_OP_PATH
                                                                  ] +
                                                                  "." +
                                                                  String(i),
                                                              OP_RESULT_DATA:
                                                                  target[
                                                                      SLW_OP_RESULT_DATA_OVERRIDE
                                                                  ],
                                                          }),
                                                      )
                                                    : target[SLW_CLONE]({
                                                          SLW_OP_PATH:
                                                              target[
                                                                  SLW_OP_PATH
                                                              ] +
                                                              "." +
                                                              String(i),
                                                          OP_RESULT_DATA:
                                                              target[
                                                                  SLW_OP_RESULT_DATA_OVERRIDE
                                                              ],
                                                      }),
                                        );

                                    if (!cache.proxiedArray.has(path)) {
                                        cache.proxiedArray.set(
                                            path,
                                            proxiedData,
                                        );
                                    }

                                    const proto =
                                        Object.getPrototypeOf(proxiedData);
                                    if (Object.hasOwn(proto, prop)) {
                                        const v = (proxiedData as any)[prop];
                                        if (typeof v === "function")
                                            return v.bind(proxiedData);
                                        return v;
                                    }

                                    if (data === undefined) return undefined;
                                    if (data === null) return null;

                                    return (proxiedData as any)[prop];
                                }

                                const data = _data as valueT | undefined;
                                if (data === undefined) return undefined;
                                if (data === null) return null;

                                const proto = Object.getPrototypeOf(data);
                                if (Object.hasOwn(proto, prop)) {
                                    const v = (data as any)[prop];
                                    if (typeof v === "function")
                                        return v.bind(data);
                                    return v;
                                }

                                return (data as any)[prop];
                            }

                            let slw = slw_value?.[String(prop)];
                            let slwOpPathIsIndexAccessOrInArray = false;
                            let targetOpPathArr =
                                target[SLW_OP_PATH]?.split(".") ?? [];
                            while (targetOpPathArr.length) {
                                if (!isNaN(+targetOpPathArr.pop()!)) {
                                    slwOpPathIsIndexAccessOrInArray = true;
                                    break;
                                }
                            }

                            if (
                                slwOpPathIsIndexAccessOrInArray ||
                                (target[SLW_OP_RESULT_DATA_OVERRIDE] &&
                                    !slw[SLW_OP_RESULT_DATA_OVERRIDE])
                            ) {
                                if (target[SLW_NEEDS_CLONE]) {
                                    // if the slw is flagged it needs to be cloned
                                    // this is only for subscriptions, because
                                    // the original slw will continue to exist
                                    // and also have the same op path
                                    // we need a new object that doesn't reference
                                    // the other objects
                                    slw = slw[SLW_CLONE]({
                                        SLW_OP_PATH:
                                            target[SLW_OP_PATH] +
                                            "." +
                                            String(prop),
                                        OP_RESULT_DATA:
                                            target[SLW_OP_RESULT_DATA_OVERRIDE],
                                    });
                                } else {
                                    // index access detected, setting the op path
                                    // with the index (coming from the slw's parent (target))
                                    // it's in the parent because the parent was cloned before
                                    slw[SLW_OP_PATH] =
                                        target[SLW_OP_PATH] +
                                        "." +
                                        String(prop);
                                    slw[SLW_OP_RESULT_DATA_OVERRIDE] =
                                        target[SLW_OP_RESULT_DATA_OVERRIDE];
                                }
                            }

                            if (
                                slw instanceof SelectionWrapperImpl &&
                                slw[SLW_FIELD_ARR_DEPTH]
                            ) {
                                const dataArr = getResultDataForTarget(
                                    slw,
                                    undefined,
                                    true,
                                ) as unknown[] | undefined | null;
                                if (dataArr === undefined) return undefined;
                                if (dataArr === null) return null;
                                if (!dataArr?.length) {
                                    return [];
                                }

                                if (slw[SLW_PARENT_COLLECTOR]) {
                                    return proxify(dataArr, slw);
                                }
                            } else if (slw instanceof SelectionWrapperImpl) {
                                const data = getResultDataForTarget(
                                    slw,
                                    undefined,
                                    true,
                                ) as unknown | undefined | null;
                                if (data === undefined) return undefined;
                                if (data === null) return null;

                                if (slw[SLW_PARENT_COLLECTOR]) {
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
                                slw_value[String(prop)][SLW_PARENT_SLW] =
                                    target;
                            }
                        }
                        if (slw_value?.[String(prop)]?.[SLW_LAZY_FLAG]) {
                            if (!slw_value[String(prop)][SLW_PARENT_SLW]) {
                                const lazyFn = slw_value[String(prop)];
                                slw_value[String(prop)] = lazyFn.bind({
                                    parentSlw: target,
                                    key: String(prop),
                                });
                                slw_value[String(prop)][SLW_PARENT_SLW] =
                                    target;
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

export interface ScalarTypeMapWithCustom {
    ObjectID: Record<string | number | symbol, unknown>;
    timestamptz: Record<string | number | symbol, unknown>;
    uuid: Record<string | number | symbol, unknown>;
    link__Import: Record<string | number | symbol, unknown>;
    federation__FieldSet: Record<string | number | symbol, unknown>;
    _Any: Record<string | number | symbol, unknown>;
}
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
type Prettify<T> = (T extends Array<infer U>
    ? U[]
    : {
          [K in keyof T]: T[K];
      }) & {};

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

type ReplaceReturnType<T, R, E = unknown> = T extends (
    ...a: any
) => (...a: any) => any
    ? (
          ...a: Parameters<T>
      ) => ReturnType<ReturnType<T>> extends Promise<any>
          ? Promise<R> & E
          : R & E
    : T extends (...a: any) => any
      ? (
            ...a: Parameters<T>
        ) => ReturnType<T> extends Promise<any> ? Promise<R> & E : R & E
      : never;
type SLW_TPN_ToType<
    TNP extends string,
    TNP_TYPE = TNP extends `${infer _TNP}!` ? _TNP : TNP,
    IS_NULLABLE = TNP extends `${infer _TNP}!` ? false : true,
    RESULT = TNP_TYPE extends keyof ScalarTypeMapWithCustom
        ? ScalarTypeMapWithCustom[TNP_TYPE]
        : TNP_TYPE extends keyof ScalarTypeMapDefault
          ? ScalarTypeMapDefault[TNP_TYPE]
          : TNP_TYPE extends keyof EnumTypesMapped
            ? EnumTypesMapped[TNP_TYPE]
            : never,
> = IS_NULLABLE extends true ? RESULT | null : RESULT;
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ...0[]];
type ToTArrayWithDepth<T, D extends number> = D extends 0
    ? T
    : ToTArrayWithDepth<T[], Prev[D]>;
type ConvertToPromise<T, skip = 1> = skip extends 0 ? T : Promise<T>;
type ConvertToAsyncIter<T, skip = 1> = skip extends 0 ? T : AsyncIterable<T>;
type ReplacePlaceHoldersWithTNested<
    inferedResult,
    EE,
    REP extends string | number | symbol,
> = {
    [k in keyof EE]: k extends REP
        ? EE[k] extends (...args: any) => infer R
            ? ReplaceReturnType<
                  EE[k],
                  inferedResult,
                  {
                      [kk in Exclude<REP, k>]: kk extends keyof R
                          ? ReplaceReturnType<R[kk], inferedResult>
                          : never;
                  }
              >
            : inferedResult
        : EE[k];
};

type SLFNReturned<
    T extends object,
    F extends object,
    E extends { [key: string | number | symbol]: any },
    TAD extends number,
    AS_PROMISE,
    AS_ASYNC_ITER,
    REP extends string | number | symbol,
> =
    // Overload 1: No 's' provided -> return full transformed F
    (() => Prettify<
        ConvertToPromise<
            ConvertToAsyncIter<
                ToTArrayWithDepth<
                    Prettify<
                        "$all" extends keyof F
                            ? F["$all"] extends (...args: any) => any
                                ? ReturnType<F["$all"]>
                                : never
                            : never
                    >,
                    TAD
                >,
                AS_ASYNC_ITER
            >,
            AS_PROMISE
        > &
            ReplacePlaceHoldersWithTNested<
                ConvertToAsyncIter<
                    ToTArrayWithDepth<
                        Prettify<
                            "$all" extends keyof F
                                ? F["$all"] extends (...args: any) => any
                                    ? ReturnType<F["$all"]>
                                    : never
                                : never
                        >,
                        TAD
                    >,
                    AS_ASYNC_ITER
                >,
                E,
                REP
            >
    >) &
        // Overload 2: With 's' provided -> infer result from selection
        (<
            TT = T,
            FF = F,
            EE = E,
            inferedResult = {
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
        >(
            this: any,
            s: (selection: FF) => TT,
        ) => Prettify<
            ConvertToPromise<
                ConvertToAsyncIter<
                    ToTArrayWithDepth<inferedResult, TAD>,
                    AS_ASYNC_ITER
                >,
                AS_PROMISE
            > &
                ReplacePlaceHoldersWithTNested<
                    ConvertToAsyncIter<
                        ToTArrayWithDepth<inferedResult, TAD>,
                        AS_ASYNC_ITER
                    >,
                    EE,
                    REP
                >
        >);

export type SLFN<
    T extends object,
    F extends object,
    N extends string,
    TNP extends string,
    TAD extends number,
    E extends { [key: string | number | symbol]: any } = {},
    REP extends string | number | symbol = never,
    AS_PROMISE = 0,
    AS_ASYNC_ITER = 0,
> = (
    makeSLFNInput: () => F,
    SLFN_name: N,
    SLFN_typeNamePure: TNP,
    SLFN_typeArrDepth: TAD,
) => SLFNReturned<T, F, E, TAD, AS_PROMISE, AS_ASYNC_ITER, REP>;

const selectScalars = (selection: Record<string, any>) =>
    Object.fromEntries(
        Object.entries(selection).filter(
            ([k, v]) => v instanceof SelectionWrapperImpl,
        ),
    );

type AllNonFuncFieldsFromType<
    TRaw,
    T = TRaw extends Array<infer A> ? A : TRaw,
> = Pick<
    T,
    { [k in keyof T]: T[k] extends (args: any) => any ? never : k }[keyof T]
>;

type SetNestedFieldNever<
    T,
    Path extends string,
> = Path extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
        ? {
              [K in keyof T]: K extends Key
                  ? SetNestedFieldNever<T[K], Rest>
                  : T[K];
          }
        : T
    : { [K in keyof T]: K extends Path ? never : T[K] };

type primitives =
    | string
    | number
    | boolean
    | Record<string | number | symbol, unknown>;
type isScalar<T> =
    T extends Exclude<
        ScalarTypeMapDefault[keyof ScalarTypeMapDefault],
        primitives
    >
        ? true
        : T extends Exclude<
                ScalarTypeMapWithCustom[keyof ScalarTypeMapWithCustom],
                primitives
            >
          ? true
          : false;

// Utility type to get all possible dot-notation paths
type Paths<T, Visited = never, Depth extends Prev[number] = 9> =
    isScalar<T> extends true
        ? never
        : Depth extends never
          ? never
          : T extends object
            ? T extends Visited
                ? never // Stop recursion if type is cyclic
                : {
                      [K in keyof T]: T[K] extends Array<infer U>
                          ? K extends string | number
                              ?
                                    | `${K}`
                                    | `${K}.${Paths<U, Visited | T, Prev[Depth]>}`
                              : never
                          : K extends string | number
                            ? T[K] extends object
                                ?
                                      | `${K}`
                                      | `${K}.${Paths<T[K], Visited | T, Prev[Depth]>}`
                                : `${K}`
                            : never;
                  }[keyof T]
            : never;

// Utility type to get only cyclic paths
type CyclicPaths<
    T,
    Visited = never,
    Depth extends Prev[number] = 9,
    Prefix extends string = "",
> =
    isScalar<T> extends true
        ? never
        : Depth extends never
          ? never
          : T extends object
            ? {
                  [K in keyof T]: T[K] extends Array<infer U>
                      ? K extends string | number
                          ? U extends Visited
                              ? `${Prefix}${K}` // Cyclic path found for array element
                              : CyclicPaths<
                                    U,
                                    Visited | T,
                                    Prev[Depth],
                                    `${Prefix}${K}.`
                                >
                          : never
                      : K extends string | number
                        ? T[K] extends Visited
                            ? `${Prefix}${K}` // Cyclic path found
                            : T[K] extends object
                              ? CyclicPaths<
                                    T[K],
                                    Visited | T,
                                    Prev[Depth],
                                    `${Prefix}${K}.`
                                >
                              : never
                        : never;
              }[keyof T]
            : never;

// Utility type to exclude multiple paths
type OmitMultiplePaths<T, Paths extends string> = Paths extends any
    ? SetNestedFieldNever<T, Paths>
    : T;
type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
    x: infer I,
) => void
    ? I
    : never;
type MergeUnion<T> = UnionToIntersection<T>;
type TurnToArray<T, yes extends boolean> = yes extends true ? T[] : T;
type OmitNever<
    TRaw,
    TisArray extends boolean = TRaw extends Array<any> ? true : false,
    T = TRaw extends Array<infer A> ? A : TRaw,
> =
    isScalar<T> extends true
        ? TurnToArray<T, TisArray>
        : T extends object
          ? TurnToArray<
                {
                    [K in keyof T as T[K] extends never
                        ? never
                        : T[K] extends never[]
                          ? never
                          : K]: isScalar<T[K]> extends true
                        ? T[K]
                        : T[K] extends object
                          ? OmitNever<T[K]>
                          : T[K];
                },
                TisArray
            >
          : TurnToArray<T, TisArray>;

const selectCyclicFieldsOptsStr = "select cyclic levels: ";
type selectCyclicFieldsOptsStrType = typeof selectCyclicFieldsOptsStr;
type cyclicOpts<
    S,
    CP = CyclicPaths<S>,
    kOpts = "exclude" | `${selectCyclicFieldsOptsStrType}${1 | 2 | 3 | 4 | 5}`,
> = CP extends never
    ? never
    : {
          [k in CP & string]: kOpts;
      };

type Next = [1, 2, 3, 4, 5, 6, 7, 8, 9, ...0[]];
type StringToNumber<S extends string> = S extends `${infer N extends number}`
    ? N
    : never;

type getNumberNestedLevels<str extends string> =
    str extends `${selectCyclicFieldsOptsStrType}${infer n}`
        ? StringToNumber<n>
        : never;

type selectAllOpts<S> =
    | {
          exclude?: Paths<S>[];
      }
    | {
          exclude?: Paths<S>[];
          cyclic: cyclicOpts<S>;
      };
type RepeatString<
    S extends string,
    N extends number,
    Splitter extends string = "",
    Acc extends string = "",
    Count extends number = N,
> = Count extends 0
    ? Acc
    : RepeatString<
          S,
          N,
          Splitter,
          `${Acc}${Acc extends "" ? "" : Splitter}${S}`,
          Prev[Count]
      >;

type GetSuffix<
    Str extends string,
    Prefix extends string,
> = Str extends `${Prefix}${infer Suffix}` ? Suffix : never;

type selectAllFunc<T, TNP extends string> = <
    const P = Paths<T>,
    const CP_WITH_TNP = cyclicOpts<T, `${TNP}.${CyclicPaths<T>}`>,
>(
    opts: CyclicPaths<T> extends never
        ? {
              exclude?: `${TNP}.${P & string}`[];
          }
        : {
              exclude?: `${TNP}.${P & string}`[];
              cyclic: CP_WITH_TNP;
          },
) => OmitNever<
    MergeUnion<
        OmitMultiplePaths<
            T,
            | (Exclude<Paths<T>, P> extends never ? "" : P & string)
            | (CP_WITH_TNP extends never
                  ? ""
                  : {
                        [k in keyof CP_WITH_TNP]: "exclude" extends CP_WITH_TNP[k]
                            ? GetSuffix<k & string, `${TNP}.`>
                            : RepeatString<
                                  GetSuffix<k & string, `${TNP}.`>,
                                  Next[getNumberNestedLevels<
                                      CP_WITH_TNP[k] & string
                                  >],
                                  "."
                              >;
                    }[keyof CP_WITH_TNP])
        >
    >
>;

const selectAll = <
    S,
    TNP extends string,
    SUB extends ReturnType<SLFN<{}, object, string, string, number>>,
    V extends
        | (SelectionWrapperImpl<any, any, any> | SUB)
        | ((args: any) => SelectionWrapperImpl<any, any, any> | SUB),
>(
    selection: Record<string, V>,
    typeNamePure: TNP,
    opts: selectAllOpts<S>,
    collector?: { parents: string[]; path?: string },
) => {
    // let's not make the type too complicated, it's basically a
    // nested map of string to either SLW or again
    // a map of string to SLW
    const s: Record<string, any> = {};
    const entries = Object.entries(selection);
    for (const [k, v] of entries) {
        const tk = collector?.path
            ? `${collector.path}.${k}`
            : `${typeNamePure}.${k}`;
        let excludePaths = opts?.exclude ?? ([] as string[]);
        if ("cyclic" in opts) {
            const exclude = Object.entries(
                opts.cyclic as Record<string, string>,
            )
                .filter(([k, v]) => v === "exclude")
                .map((e) => e[0]);
            const cyclicLevels = Object.entries(
                opts.cyclic as Record<string, string>,
            )
                .filter(([k, v]) => v !== "exclude")
                .filter(([k, v]) =>
                    v.match(new RegExp(`${selectCyclicFieldsOptsStr}(.*)`)),
                )
                .map((e) => {
                    const levels =
                        parseInt(
                            e[1]
                                .match(
                                    new RegExp(
                                        `${selectCyclicFieldsOptsStr}(.*)`,
                                    ),
                                )!
                                .at(1)![0],
                        ) + 1;
                    const pathFragment = e[0].split(".").slice(1).join(".");
                    return `${e[0].split(".")[0]}.${Array.from({ length: levels }).fill(pathFragment).join(".")}`;
                });
            excludePaths.push(...exclude, ...cyclicLevels);
        }
        if (excludePaths.includes(tk as any)) continue;

        if (typeof v === "function") {
            if (v.name.startsWith("bound ")) {
                // if (collector?.parents?.includes(tk)) continue;
                const col = {
                    parents: [...(collector?.parents ?? []), tk],
                    path: tk,
                };
                s[k] = v(
                    (sub_s: {
                        $on?: {
                            [k: string]: (
                                utype_sub: (utype_sub_s: {
                                    $all: (_opts?: {}, collector?: {}) => any;
                                }) => any,
                            ) => any;
                        };
                        $all?: (_opts?: {}, collector?: {}) => any;
                    }) => {
                        if (sub_s.$all) {
                            return sub_s.$all(opts, col);
                        }
                        if (sub_s.$on) {
                            return Object.values(sub_s.$on).reduce(
                                (sel, tselfn) => ({
                                    ...sel,
                                    ...tselfn((utype_sub_s) => {
                                        return utype_sub_s.$all(opts, col);
                                    }),
                                }),
                                {},
                            );
                        }
                    },
                );
            } else if (!k.startsWith("$")) {
                console.warn(
                    `Cannot use $all on fields with args: ${k}: ${v.toString()}`,
                );
            }
        } else {
            s[k] = v;
        }
    }
    return s;
};

const makeSLFN = <
    T extends object,
    F extends object,
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
        _s?: (selection: FF) => TT,
    ) {
        let parent: SelectionFnParent = this ?? {
            collector: new OperationSelectionCollector(),
        };
        function innerFn(this: any) {
            const s =
                _s ??
                ((selection: FF) =>
                    (selection as any)["$all"]({ cyclic: "exclude" }) as TT);

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
    id: ScalarTypeMapWithCustom["uuid"];
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
    id: ScalarTypeMapWithCustom["uuid"];
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
    id?: order_by;
    name?: order_by;
    rocket?: order_by;
    timestamp?: order_by;
    twitter?: order_by;
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
    _eq?: ScalarTypeMapWithCustom["uuid"];
    _gt?: ScalarTypeMapWithCustom["uuid"];
    _gte?: ScalarTypeMapWithCustom["uuid"];
    _in?: Array<any>;
    _is_null?: boolean;
    _lt?: ScalarTypeMapWithCustom["uuid"];
    _lte?: ScalarTypeMapWithCustom["uuid"];
    _neq?: ScalarTypeMapWithCustom["uuid"];
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
    _eq?: ScalarTypeMapWithCustom["timestamptz"];
    _gt?: ScalarTypeMapWithCustom["timestamptz"];
    _gte?: ScalarTypeMapWithCustom["timestamptz"];
    _in?: Array<any>;
    _is_null?: boolean;
    _lt?: ScalarTypeMapWithCustom["timestamptz"];
    _lte?: ScalarTypeMapWithCustom["timestamptz"];
    _neq?: ScalarTypeMapWithCustom["timestamptz"];
    _nin?: Array<any>;
};

export type users_insert_input = {
    id?: ScalarTypeMapWithCustom["uuid"];
    name?: string;
    rocket?: string;
    timestamp?: ScalarTypeMapWithCustom["timestamptz"];
    twitter?: string;
};

export type users_on_conflict = {
    constraint: users_constraint;
    update_columns: Array<users_update_column>;
};

export type users_set_input = {
    id?: ScalarTypeMapWithCustom["uuid"];
    name?: string;
    rocket?: string;
    timestamp?: ScalarTypeMapWithCustom["timestamptz"];
    twitter?: string;
};

export type users_aggregate_order_by = {
    count?: order_by;
    max?: users_max_order_by;
    min?: users_min_order_by;
};

export type users_max_order_by = {
    name?: order_by;
    rocket?: order_by;
    timestamp?: order_by;
    twitter?: order_by;
};

export type users_min_order_by = {
    name?: order_by;
    rocket?: order_by;
    timestamp?: order_by;
    twitter?: order_by;
};

export type users_arr_rel_insert_input = {
    data: users_insert_input[];
    on_conflict?: users_on_conflict;
};

export type users_obj_rel_insert_input = {
    data: users_insert_input;
    on_conflict?: users_on_conflict;
};

export type Capsule = {
    dragon?: Dragon;
    id?: string;
    landings?: number;
    missions?: CapsuleMission[];
    original_launch?: Date;
    reuse_count?: number;
    status?: string;
    type?: string;
};

export type Dragon = {
    active?: boolean;
    crew_capacity?: number;
    description?: string;
    diameter?: Distance;
    dry_mass_kg?: number;
    dry_mass_lb?: number;
    first_flight?: string;
    heat_shield?: DragonHeatShield;
    height_w_trunk?: Distance;
    id?: string;
    launch_payload_mass?: Mass;
    launch_payload_vol?: Volume;
    name?: string;
    orbit_duration_yr?: number;
    pressurized_capsule?: DragonPressurizedCapsule;
    return_payload_mass?: Mass;
    return_payload_vol?: Volume;
    sidewall_angle_deg?: number;
    thrusters?: DragonThrust[];
    trunk?: DragonTrunk;
    type?: string;
    wikipedia?: string;
};

export type Distance = {
    feet?: number;
    meters?: number;
};

export type DragonHeatShield = {
    dev_partner?: string;
    material?: string;
    size_meters?: number;
    temp_degrees?: number;
};

export type Mass = {
    kg?: number;
    lb?: number;
};

export type Volume = {
    cubic_feet?: number;
    cubic_meters?: number;
};

export type DragonPressurizedCapsule = {
    payload_volume?: Volume;
};

export type DragonThrust = {
    amount?: number;
    fuel_1?: string;
    fuel_2?: string;
    pods?: number;
    thrust?: Force;
    type?: string;
};

export type Force = {
    kN?: number;
    lbf?: number;
};

export type DragonTrunk = {
    cargo?: DragonTrunkCargo;
    trunk_volume?: Volume;
};

export type DragonTrunkCargo = {
    solar_array?: number;
    unpressurized_cargo?: boolean;
};

export type CapsuleMission = {
    flight?: number;
    name?: string;
};

export type Info = {
    ceo?: string;
    coo?: string;
    cto?: string;
    cto_propulsion?: string;
    employees?: number;
    founded?: number;
    founder?: string;
    headquarters?: Address;
    launch_sites?: number;
    links?: InfoLinks;
    name?: string;
    summary?: string;
    test_sites?: number;
    valuation?: number;
    vehicles?: number;
};

export type Address = {
    address?: string;
    city?: string;
    state?: string;
};

export type InfoLinks = {
    elon_twitter?: string;
    flickr?: string;
    twitter?: string;
    website?: string;
};

export type Core = {
    asds_attempts?: number;
    asds_landings?: number;
    block?: number;
    id?: string;
    missions?: CapsuleMission[];
    original_launch?: Date;
    reuse_count?: number;
    rtls_attempts?: number;
    rtls_landings?: number;
    status?: string;
    water_landing?: boolean;
};

export type History = {
    details?: string;
    event_date_unix?: Date;
    event_date_utc?: Date;
    flight?: Launch;
    id?: string;
    links?: Link;
    title?: string;
};

export type Launch = {
    details?: string;
    id?: string;
    is_tentative?: boolean;
    launch_date_local?: Date;
    launch_date_unix?: Date;
    launch_date_utc?: Date;
    launch_site?: LaunchSite;
    launch_success?: boolean;
    launch_year?: string;
    links?: LaunchLinks;
    mission_id?: Array<string>;
    mission_name?: string;
    rocket?: LaunchRocket;
    ships?: Ship[];
    static_fire_date_unix?: Date;
    static_fire_date_utc?: Date;
    telemetry?: LaunchTelemetry;
    tentative_max_precision?: string;
    upcoming?: boolean;
};

export type LaunchSite = {
    site_id?: string;
    site_name?: string;
    site_name_long?: string;
};

export type LaunchLinks = {
    article_link?: string;
    flickr_images?: Array<string>;
    mission_patch?: string;
    mission_patch_small?: string;
    presskit?: string;
    reddit_campaign?: string;
    reddit_launch?: string;
    reddit_media?: string;
    reddit_recovery?: string;
    video_link?: string;
    wikipedia?: string;
};

export type LaunchRocket = {
    fairings?: LaunchRocketFairings;
    first_stage?: LaunchRocketFirstStage;
    rocket?: Rocket;
    rocket_name?: string;
    rocket_type?: string;
    second_stage?: LaunchRocketSecondStage;
};

export type LaunchRocketFairings = {
    recovered?: boolean;
    recovery_attempt?: boolean;
    reused?: boolean;
    ship?: string;
};

export type LaunchRocketFirstStage = {
    cores?: LaunchRocketFirstStageCore[];
};

export type LaunchRocketFirstStageCore = {
    block?: number;
    core?: Core;
    flight?: number;
    gridfins?: boolean;
    land_success?: boolean;
    landing_intent?: boolean;
    landing_type?: string;
    landing_vehicle?: string;
    legs?: boolean;
    reused?: boolean;
};

export type Rocket = {
    active?: boolean;
    boosters?: number;
    company?: string;
    cost_per_launch?: number;
    country?: string;
    description?: string;
    diameter?: Distance;
    engines?: RocketEngines;
    first_flight?: Date;
    first_stage?: RocketFirstStage;
    height?: Distance;
    id?: string;
    landing_legs?: RocketLandingLegs;
    mass?: Mass;
    name?: string;
    payload_weights?: RocketPayloadWeight[];
    second_stage?: RocketSecondStage;
    stages?: number;
    success_rate_pct?: number;
    type?: string;
    wikipedia?: string;
};

export type RocketEngines = {
    engine_loss_max?: string;
    layout?: string;
    number?: number;
    propellant_1?: string;
    propellant_2?: string;
    thrust_sea_level?: Force;
    thrust_to_weight?: number;
    thrust_vacuum?: Force;
    type?: string;
    version?: string;
};

export type RocketFirstStage = {
    burn_time_sec?: number;
    engines?: number;
    fuel_amount_tons?: number;
    reusable?: boolean;
    thrust_sea_level?: Force;
    thrust_vacuum?: Force;
};

export type RocketLandingLegs = {
    material?: string;
    number?: number;
};

export type RocketPayloadWeight = {
    id?: string;
    kg?: number;
    lb?: number;
    name?: string;
};

export type RocketSecondStage = {
    burn_time_sec?: number;
    engines?: number;
    fuel_amount_tons?: number;
    payloads?: RocketSecondStagePayloads;
    thrust?: Force;
};

export type RocketSecondStagePayloads = {
    composite_fairing?: RocketSecondStagePayloadCompositeFairing;
    option_1?: string;
};

export type RocketSecondStagePayloadCompositeFairing = {
    diameter?: Distance;
    height?: Distance;
};

export type LaunchRocketSecondStage = {
    block?: number;
    payloads?: Payload[];
};

export type Payload = {
    customers?: Array<string>;
    id?: string;
    manufacturer?: string;
    nationality?: string;
    norad_id?: Array<number>;
    orbit?: string;
    orbit_params?: PayloadOrbitParams;
    payload_mass_kg?: number;
    payload_mass_lbs?: number;
    payload_type?: string;
    reused?: boolean;
};

export type PayloadOrbitParams = {
    apoapsis_km?: number;
    arg_of_pericenter?: number;
    eccentricity?: number;
    epoch?: Date;
    inclination_deg?: number;
    lifespan_years?: number;
    longitude?: number;
    mean_anomaly?: number;
    mean_motion?: number;
    periapsis_km?: number;
    period_min?: number;
    raan?: number;
    reference_system?: string;
    regime?: string;
    semi_major_axis_km?: number;
};

export type Ship = {
    abs?: number;
    active?: boolean;
    attempted_landings?: number;
    class?: number;
    course_deg?: number;
    home_port?: string;
    id?: string;
    image?: string;
    imo?: number;
    missions?: ShipMission[];
    mmsi?: number;
    model?: string;
    name?: string;
    position?: ShipLocation;
    roles?: Array<string>;
    speed_kn?: number;
    status?: string;
    successful_landings?: number;
    type?: string;
    url?: string;
    weight_kg?: number;
    weight_lbs?: number;
    year_built?: number;
};

export type ShipMission = {
    flight?: string;
    name?: string;
};

export type ShipLocation = {
    latitude?: number;
    longitude?: number;
};

export type LaunchTelemetry = {
    flight_club?: string;
};

export type Link = {
    article?: string;
    reddit?: string;
    wikipedia?: string;
};

export type HistoriesResult = {
    data?: History[];
    result?: Result;
};

export type Result = {
    totalCount?: number;
};

export type Landpad = {
    attempted_landings?: string;
    details?: string;
    full_name?: string;
    id?: string;
    landing_type?: string;
    location?: Location;
    status?: string;
    successful_landings?: string;
    wikipedia?: string;
};

export type Location = {
    latitude?: number;
    longitude?: number;
    name?: string;
    region?: string;
};

export type LaunchesPastResult = {
    data?: Launch[];
    result?: Result;
};

export type Launchpad = {
    attempted_launches?: number;
    details?: string;
    id?: string;
    location?: Location;
    name?: string;
    status?: string;
    successful_launches?: number;
    vehicles_launched?: Rocket[];
    wikipedia?: string;
};

export type Mission = {
    description?: string;
    id?: string;
    manufacturers?: Array<string>;
    name?: string;
    payloads?: Payload[];
    twitter?: string;
    website?: string;
    wikipedia?: string;
};

export type MissionResult = {
    data?: Mission[];
    result?: Result;
};

export type Roadster = {
    apoapsis_au?: number;
    details?: string;
    earth_distance_km?: number;
    earth_distance_mi?: number;
    eccentricity?: number;
    epoch_jd?: number;
    inclination?: number;
    launch_date_unix?: Date;
    launch_date_utc?: Date;
    launch_mass_kg?: number;
    launch_mass_lbs?: number;
    longitude?: number;
    mars_distance_km?: number;
    mars_distance_mi?: number;
    name?: string;
    norad_id?: number;
    orbit_type?: number;
    periapsis_arg?: number;
    periapsis_au?: number;
    period_days?: number;
    semi_major_axis_au?: number;
    speed_kph?: number;
    speed_mph?: number;
    wikipedia?: string;
};

export type RocketsResult = {
    data?: Rocket[];
    result?: Result;
};

export type ShipsResult = {
    data?: Ship[];
    result?: Result;
};

export type users = {
    id: ScalarTypeMapWithCustom["uuid"];
    name?: string;
    rocket?: string;
    timestamp: ScalarTypeMapWithCustom["timestamptz"];
    twitter?: string;
};

export type users_aggregate = {
    aggregate?: users_aggregate_fields;
    nodes: users[];
};

export type users_aggregate_fields = {
    count: (args?: users_aggregate_fieldsCountArgs) => number;
    max?: users_max_fields;
    min?: users_min_fields;
};

export type users_max_fields = {
    name?: string;
    rocket?: string;
    timestamp?: ScalarTypeMapWithCustom["timestamptz"];
    twitter?: string;
};

export type users_min_fields = {
    name?: string;
    rocket?: string;
    timestamp?: ScalarTypeMapWithCustom["timestamptz"];
    twitter?: string;
};

export type _Service = {
    sdl?: string;
};

export type users_mutation_response = {
    /* number of affected rows by the mutation */
    affected_rows: number;
    /* data of the affected rows by the mutation */
    returning: users[];
};

export type CoreMission = {
    flight?: number;
    name?: string;
};

export type Mutation = {
    /* delete data from the table: "users" */
    delete_users: (args: MutationDelete_usersArgs) => users_mutation_response;
    /* insert data into the table: "users" */
    insert_users: (args: MutationInsert_usersArgs) => users_mutation_response;
    /* update data of the table: "users" */
    update_users: (args: MutationUpdate_usersArgs) => users_mutation_response;
};

export type Query = {
    capsule: (args: QueryCapsuleArgs) => Capsule;
    capsules: (args?: QueryCapsulesArgs) => Capsule[];
    capsulesPast: (args?: QueryCapsulesPastArgs) => Capsule[];
    capsulesUpcoming: (args?: QueryCapsulesUpcomingArgs) => Capsule[];
    company?: Info;
    core: (args: QueryCoreArgs) => Core;
    cores: (args?: QueryCoresArgs) => Core[];
    coresPast: (args?: QueryCoresPastArgs) => Core[];
    coresUpcoming: (args?: QueryCoresUpcomingArgs) => Core[];
    dragon: (args: QueryDragonArgs) => Dragon;
    dragons: (args?: QueryDragonsArgs) => Dragon[];
    histories: (args?: QueryHistoriesArgs) => History[];
    historiesResult: (args?: QueryHistoriesResultArgs) => HistoriesResult;
    history: (args: QueryHistoryArgs) => History;
    landpad: (args: QueryLandpadArgs) => Landpad;
    landpads: (args?: QueryLandpadsArgs) => Landpad[];
    launch: (args: QueryLaunchArgs) => Launch;
    launchLatest: (args?: QueryLaunchLatestArgs) => Launch;
    launchNext: (args?: QueryLaunchNextArgs) => Launch;
    launches: (args?: QueryLaunchesArgs) => Launch[];
    launchesPast: (args?: QueryLaunchesPastArgs) => Launch[];
    launchesPastResult: (
        args?: QueryLaunchesPastResultArgs,
    ) => LaunchesPastResult;
    launchesUpcoming: (args?: QueryLaunchesUpcomingArgs) => Launch[];
    launchpad: (args: QueryLaunchpadArgs) => Launchpad;
    launchpads: (args?: QueryLaunchpadsArgs) => Launchpad[];
    mission: (args: QueryMissionArgs) => Mission;
    missions: (args?: QueryMissionsArgs) => Mission[];
    missionsResult: (args?: QueryMissionsResultArgs) => MissionResult;
    payload: (args: QueryPayloadArgs) => Payload;
    payloads: (args?: QueryPayloadsArgs) => Payload[];
    roadster?: Roadster;
    rocket: (args: QueryRocketArgs) => Rocket;
    rockets: (args?: QueryRocketsArgs) => Rocket[];
    rocketsResult: (args?: QueryRocketsResultArgs) => RocketsResult;
    ship: (args: QueryShipArgs) => Ship;
    ships: (args?: QueryShipsArgs) => Ship[];
    shipsResult: (args?: QueryShipsResultArgs) => ShipsResult;
    /* fetch data from the table: "users" */
    users: (args?: QueryUsersArgs) => users[];
    /* fetch aggregated fields from the table: "users" */
    users_aggregate: (args?: QueryUsers_aggregateArgs) => users_aggregate;
    /* fetch data from the table: "users" using primary key columns */
    users_by_pk: (args: QueryUsers_by_pkArgs) => users;
    _service: _Service;
};

export type Subscription = {
    /* fetch data from the table: "users" */
    users: (args?: SubscriptionUsersArgs) => users[];
    /* fetch aggregated fields from the table: "users" */
    users_aggregate: (
        args?: SubscriptionUsers_aggregateArgs,
    ) => users_aggregate;
    /* fetch data from the table: "users" using primary key columns */
    users_by_pk: (args: SubscriptionUsers_by_pkArgs) => users;
};

export interface EnumTypesMapped {
    users_select_column: users_select_column;
    order_by: order_by;
    users_constraint: users_constraint;
    users_update_column: users_update_column;
    link__Purpose: link__Purpose;
}

type ReturnTypeFromDragonSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromDragonSelection = {
    active: ReturnTypeFromDragonSelectionRetTypes["active"];
    crew_capacity: ReturnTypeFromDragonSelectionRetTypes["crew_capacity"];
    description: ReturnTypeFromDragonSelectionRetTypes["description"];
    diameter: ReturnTypeFromDragonSelectionRetTypes["diameter"];
    dry_mass_kg: ReturnTypeFromDragonSelectionRetTypes["dry_mass_kg"];
    dry_mass_lb: ReturnTypeFromDragonSelectionRetTypes["dry_mass_lb"];
    first_flight: ReturnTypeFromDragonSelectionRetTypes["first_flight"];
    heat_shield: ReturnTypeFromDragonSelectionRetTypes["heat_shield"];
    height_w_trunk: ReturnTypeFromDragonSelectionRetTypes["height_w_trunk"];
    id: ReturnTypeFromDragonSelectionRetTypes["id"];
    launch_payload_mass: ReturnTypeFromDragonSelectionRetTypes["launch_payload_mass"];
    launch_payload_vol: ReturnTypeFromDragonSelectionRetTypes["launch_payload_vol"];
    name: ReturnTypeFromDragonSelectionRetTypes["name"];
    orbit_duration_yr: ReturnTypeFromDragonSelectionRetTypes["orbit_duration_yr"];
    pressurized_capsule: ReturnTypeFromDragonSelectionRetTypes["pressurized_capsule"];
    return_payload_mass: ReturnTypeFromDragonSelectionRetTypes["return_payload_mass"];
    return_payload_vol: ReturnTypeFromDragonSelectionRetTypes["return_payload_vol"];
    sidewall_angle_deg: ReturnTypeFromDragonSelectionRetTypes["sidewall_angle_deg"];
    thrusters: ReturnTypeFromDragonSelectionRetTypes["thrusters"];
    trunk: ReturnTypeFromDragonSelectionRetTypes["trunk"];
    type: ReturnTypeFromDragonSelectionRetTypes["type"];
    wikipedia: ReturnTypeFromDragonSelectionRetTypes["wikipedia"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Dragon>, "Dragon">;
};

export function makeDragonSelectionInput(
    this: any,
): ReturnTypeFromDragonSelection {
    const that = this;
    return {
        get active() {
            return new SelectionWrapper(
                "active",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get crew_capacity() {
            return new SelectionWrapper(
                "crew_capacity",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get description() {
            return new SelectionWrapper(
                "description",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        diameter: DistanceSelection.bind({
            collector: that,
            fieldName: "diameter",
        }) as any,
        get dry_mass_kg() {
            return new SelectionWrapper(
                "dry_mass_kg",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get dry_mass_lb() {
            return new SelectionWrapper(
                "dry_mass_lb",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get first_flight() {
            return new SelectionWrapper(
                "first_flight",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        heat_shield: DragonHeatShieldSelection.bind({
            collector: that,
            fieldName: "heat_shield",
        }) as any,
        height_w_trunk: DistanceSelection.bind({
            collector: that,
            fieldName: "height_w_trunk",
        }) as any,
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        launch_payload_mass: MassSelection.bind({
            collector: that,
            fieldName: "launch_payload_mass",
        }) as any,
        launch_payload_vol: VolumeSelection.bind({
            collector: that,
            fieldName: "launch_payload_vol",
        }) as any,
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get orbit_duration_yr() {
            return new SelectionWrapper(
                "orbit_duration_yr",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        pressurized_capsule: DragonPressurizedCapsuleSelection.bind({
            collector: that,
            fieldName: "pressurized_capsule",
        }) as any,
        return_payload_mass: MassSelection.bind({
            collector: that,
            fieldName: "return_payload_mass",
        }) as any,
        return_payload_vol: VolumeSelection.bind({
            collector: that,
            fieldName: "return_payload_vol",
        }) as any,
        get sidewall_angle_deg() {
            return new SelectionWrapper(
                "sidewall_angle_deg",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        thrusters: DragonThrustArraySelection.bind({
            collector: that,
            fieldName: "thrusters",
        }) as any,
        trunk: DragonTrunkSelection.bind({
            collector: that,
            fieldName: "trunk",
        }) as any,
        get type() {
            return new SelectionWrapper(
                "type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get wikipedia() {
            return new SelectionWrapper(
                "wikipedia",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeDragonSelectionInput.bind(that)(),
            ) as SLWsFromSelection<ReturnType<typeof makeDragonSelectionInput>>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeDragonSelectionInput.bind(that)() as any,
                "Dragon",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const DragonSelection = makeSLFN(
    makeDragonSelectionInput,
    "DragonSelection",
    "Dragon",
    0,
);

type ReturnTypeFromDistanceSelectionRetTypes<AS_PROMISE = 0> = {
    feet: SelectionWrapperImpl<"feet", "Float", 0, {}, undefined>;
    meters: SelectionWrapperImpl<"meters", "Float", 0, {}, undefined>;
};
type ReturnTypeFromDistanceSelection = {
    feet: ReturnTypeFromDistanceSelectionRetTypes["feet"];
    meters: ReturnTypeFromDistanceSelectionRetTypes["meters"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDistanceSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Distance>, "Distance">;
};

export function makeDistanceSelectionInput(
    this: any,
): ReturnTypeFromDistanceSelection {
    const that = this;
    return {
        get feet() {
            return new SelectionWrapper(
                "feet",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get meters() {
            return new SelectionWrapper(
                "meters",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeDistanceSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDistanceSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeDistanceSelectionInput.bind(that)() as any,
                "Distance",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const DistanceSelection = makeSLFN(
    makeDistanceSelectionInput,
    "DistanceSelection",
    "Distance",
    0,
);

type ReturnTypeFromDragonHeatShieldSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromDragonHeatShieldSelection = {
    dev_partner: ReturnTypeFromDragonHeatShieldSelectionRetTypes["dev_partner"];
    material: ReturnTypeFromDragonHeatShieldSelectionRetTypes["material"];
    size_meters: ReturnTypeFromDragonHeatShieldSelectionRetTypes["size_meters"];
    temp_degrees: ReturnTypeFromDragonHeatShieldSelectionRetTypes["temp_degrees"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonHeatShieldSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<DragonHeatShield>,
        "DragonHeatShield"
    >;
};

export function makeDragonHeatShieldSelectionInput(
    this: any,
): ReturnTypeFromDragonHeatShieldSelection {
    const that = this;
    return {
        get dev_partner() {
            return new SelectionWrapper(
                "dev_partner",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get material() {
            return new SelectionWrapper(
                "material",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get size_meters() {
            return new SelectionWrapper(
                "size_meters",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get temp_degrees() {
            return new SelectionWrapper(
                "temp_degrees",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeDragonHeatShieldSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonHeatShieldSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeDragonHeatShieldSelectionInput.bind(that)() as any,
                "DragonHeatShield",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const DragonHeatShieldSelection = makeSLFN(
    makeDragonHeatShieldSelectionInput,
    "DragonHeatShieldSelection",
    "DragonHeatShield",
    0,
);

type ReturnTypeFromMassSelectionRetTypes<AS_PROMISE = 0> = {
    kg: SelectionWrapperImpl<"kg", "Int", 0, {}, undefined>;
    lb: SelectionWrapperImpl<"lb", "Int", 0, {}, undefined>;
};
type ReturnTypeFromMassSelection = {
    kg: ReturnTypeFromMassSelectionRetTypes["kg"];
    lb: ReturnTypeFromMassSelectionRetTypes["lb"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeMassSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Mass>, "Mass">;
};

export function makeMassSelectionInput(this: any): ReturnTypeFromMassSelection {
    const that = this;
    return {
        get kg() {
            return new SelectionWrapper("kg", "Int", 0, {}, that, undefined);
        },
        get lb() {
            return new SelectionWrapper("lb", "Int", 0, {}, that, undefined);
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeMassSelectionInput.bind(that)(),
            ) as SLWsFromSelection<ReturnType<typeof makeMassSelectionInput>>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeMassSelectionInput.bind(that)() as any,
                "Mass",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const MassSelection = makeSLFN(
    makeMassSelectionInput,
    "MassSelection",
    "Mass",
    0,
);

type ReturnTypeFromVolumeSelectionRetTypes<AS_PROMISE = 0> = {
    cubic_feet: SelectionWrapperImpl<"cubic_feet", "Int", 0, {}, undefined>;
    cubic_meters: SelectionWrapperImpl<"cubic_meters", "Int", 0, {}, undefined>;
};
type ReturnTypeFromVolumeSelection = {
    cubic_feet: ReturnTypeFromVolumeSelectionRetTypes["cubic_feet"];
    cubic_meters: ReturnTypeFromVolumeSelectionRetTypes["cubic_meters"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeVolumeSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Volume>, "Volume">;
};

export function makeVolumeSelectionInput(
    this: any,
): ReturnTypeFromVolumeSelection {
    const that = this;
    return {
        get cubic_feet() {
            return new SelectionWrapper(
                "cubic_feet",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get cubic_meters() {
            return new SelectionWrapper(
                "cubic_meters",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeVolumeSelectionInput.bind(that)(),
            ) as SLWsFromSelection<ReturnType<typeof makeVolumeSelectionInput>>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeVolumeSelectionInput.bind(that)() as any,
                "Volume",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const VolumeSelection = makeSLFN(
    makeVolumeSelectionInput,
    "VolumeSelection",
    "Volume",
    0,
);

type ReturnTypeFromDragonPressurizedCapsuleSelectionRetTypes<AS_PROMISE = 0> = {
    payload_volume: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeVolumeSelectionInput>,
            "VolumeSelection",
            "Volume",
            0
        >
    >;
};
type ReturnTypeFromDragonPressurizedCapsuleSelection = {
    payload_volume: ReturnTypeFromDragonPressurizedCapsuleSelectionRetTypes["payload_volume"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<DragonPressurizedCapsule>,
        "DragonPressurizedCapsule"
    >;
};

export function makeDragonPressurizedCapsuleSelectionInput(
    this: any,
): ReturnTypeFromDragonPressurizedCapsuleSelection {
    const that = this;
    return {
        payload_volume: VolumeSelection.bind({
            collector: that,
            fieldName: "payload_volume",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeDragonPressurizedCapsuleSelectionInput.bind(that)() as any,
                "DragonPressurizedCapsule",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const DragonPressurizedCapsuleSelection = makeSLFN(
    makeDragonPressurizedCapsuleSelectionInput,
    "DragonPressurizedCapsuleSelection",
    "DragonPressurizedCapsule",
    0,
);

type ReturnTypeFromDragonThrustArraySelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromDragonThrustArraySelection = {
    amount: ReturnTypeFromDragonThrustArraySelectionRetTypes["amount"];
    fuel_1: ReturnTypeFromDragonThrustArraySelectionRetTypes["fuel_1"];
    fuel_2: ReturnTypeFromDragonThrustArraySelectionRetTypes["fuel_2"];
    pods: ReturnTypeFromDragonThrustArraySelectionRetTypes["pods"];
    thrust: ReturnTypeFromDragonThrustArraySelectionRetTypes["thrust"];
    type: ReturnTypeFromDragonThrustArraySelectionRetTypes["type"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonThrustArraySelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<DragonThrust[]>,
        "DragonThrust[]"
    >;
};

export function makeDragonThrustArraySelectionInput(
    this: any,
): ReturnTypeFromDragonThrustArraySelection {
    const that = this;
    return {
        get amount() {
            return new SelectionWrapper(
                "amount",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get fuel_1() {
            return new SelectionWrapper(
                "fuel_1",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get fuel_2() {
            return new SelectionWrapper(
                "fuel_2",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get pods() {
            return new SelectionWrapper("pods", "Int", 0, {}, that, undefined);
        },
        thrust: ForceSelection.bind({
            collector: that,
            fieldName: "thrust",
        }) as any,
        get type() {
            return new SelectionWrapper(
                "type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeDragonThrustArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonThrustArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeDragonThrustArraySelectionInput.bind(that)() as any,
                "DragonThrust[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const DragonThrustArraySelection = makeSLFN(
    makeDragonThrustArraySelectionInput,
    "DragonThrustArraySelection",
    "DragonThrust",
    1,
);

type ReturnTypeFromForceSelectionRetTypes<AS_PROMISE = 0> = {
    kN: SelectionWrapperImpl<"kN", "Float", 0, {}, undefined>;
    lbf: SelectionWrapperImpl<"lbf", "Float", 0, {}, undefined>;
};
type ReturnTypeFromForceSelection = {
    kN: ReturnTypeFromForceSelectionRetTypes["kN"];
    lbf: ReturnTypeFromForceSelectionRetTypes["lbf"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeForceSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Force>, "Force">;
};

export function makeForceSelectionInput(
    this: any,
): ReturnTypeFromForceSelection {
    const that = this;
    return {
        get kN() {
            return new SelectionWrapper("kN", "Float", 0, {}, that, undefined);
        },
        get lbf() {
            return new SelectionWrapper("lbf", "Float", 0, {}, that, undefined);
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeForceSelectionInput.bind(that)(),
            ) as SLWsFromSelection<ReturnType<typeof makeForceSelectionInput>>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeForceSelectionInput.bind(that)() as any,
                "Force",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const ForceSelection = makeSLFN(
    makeForceSelectionInput,
    "ForceSelection",
    "Force",
    0,
);

type ReturnTypeFromDragonTrunkSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromDragonTrunkSelection = {
    cargo: ReturnTypeFromDragonTrunkSelectionRetTypes["cargo"];
    trunk_volume: ReturnTypeFromDragonTrunkSelectionRetTypes["trunk_volume"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $all: selectAllFunc<AllNonFuncFieldsFromType<DragonTrunk>, "DragonTrunk">;
};

export function makeDragonTrunkSelectionInput(
    this: any,
): ReturnTypeFromDragonTrunkSelection {
    const that = this;
    return {
        cargo: DragonTrunkCargoSelection.bind({
            collector: that,
            fieldName: "cargo",
        }) as any,
        trunk_volume: VolumeSelection.bind({
            collector: that,
            fieldName: "trunk_volume",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeDragonTrunkSelectionInput.bind(that)() as any,
                "DragonTrunk",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const DragonTrunkSelection = makeSLFN(
    makeDragonTrunkSelectionInput,
    "DragonTrunkSelection",
    "DragonTrunk",
    0,
);

type ReturnTypeFromDragonTrunkCargoSelectionRetTypes<AS_PROMISE = 0> = {
    solar_array: SelectionWrapperImpl<"solar_array", "Int", 0, {}, undefined>;
    unpressurized_cargo: SelectionWrapperImpl<
        "unpressurized_cargo",
        "Boolean",
        0,
        {},
        undefined
    >;
};
type ReturnTypeFromDragonTrunkCargoSelection = {
    solar_array: ReturnTypeFromDragonTrunkCargoSelectionRetTypes["solar_array"];
    unpressurized_cargo: ReturnTypeFromDragonTrunkCargoSelectionRetTypes["unpressurized_cargo"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonTrunkCargoSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<DragonTrunkCargo>,
        "DragonTrunkCargo"
    >;
};

export function makeDragonTrunkCargoSelectionInput(
    this: any,
): ReturnTypeFromDragonTrunkCargoSelection {
    const that = this;
    return {
        get solar_array() {
            return new SelectionWrapper(
                "solar_array",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get unpressurized_cargo() {
            return new SelectionWrapper(
                "unpressurized_cargo",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeDragonTrunkCargoSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonTrunkCargoSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeDragonTrunkCargoSelectionInput.bind(that)() as any,
                "DragonTrunkCargo",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const DragonTrunkCargoSelection = makeSLFN(
    makeDragonTrunkCargoSelectionInput,
    "DragonTrunkCargoSelection",
    "DragonTrunkCargo",
    0,
);

type ReturnTypeFromCapsuleMissionArraySelectionRetTypes<AS_PROMISE = 0> = {
    flight: SelectionWrapperImpl<"flight", "Int", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
};
type ReturnTypeFromCapsuleMissionArraySelection = {
    flight: ReturnTypeFromCapsuleMissionArraySelectionRetTypes["flight"];
    name: ReturnTypeFromCapsuleMissionArraySelectionRetTypes["name"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCapsuleMissionArraySelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<CapsuleMission[]>,
        "CapsuleMission[]"
    >;
};

export function makeCapsuleMissionArraySelectionInput(
    this: any,
): ReturnTypeFromCapsuleMissionArraySelection {
    const that = this;
    return {
        get flight() {
            return new SelectionWrapper(
                "flight",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeCapsuleMissionArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCapsuleMissionArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeCapsuleMissionArraySelectionInput.bind(that)() as any,
                "CapsuleMission[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const CapsuleMissionArraySelection = makeSLFN(
    makeCapsuleMissionArraySelectionInput,
    "CapsuleMissionArraySelection",
    "CapsuleMission",
    1,
);

type ReturnTypeFromCapsuleSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromCapsuleSelection = {
    dragon: ReturnTypeFromCapsuleSelectionRetTypes["dragon"];
    id: ReturnTypeFromCapsuleSelectionRetTypes["id"];
    landings: ReturnTypeFromCapsuleSelectionRetTypes["landings"];
    missions: ReturnTypeFromCapsuleSelectionRetTypes["missions"];
    original_launch: ReturnTypeFromCapsuleSelectionRetTypes["original_launch"];
    reuse_count: ReturnTypeFromCapsuleSelectionRetTypes["reuse_count"];
    status: ReturnTypeFromCapsuleSelectionRetTypes["status"];
    type: ReturnTypeFromCapsuleSelectionRetTypes["type"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCapsuleSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Capsule>, "Capsule">;
};

export function makeCapsuleSelectionInput(
    this: any,
): ReturnTypeFromCapsuleSelection {
    const that = this;
    return {
        dragon: DragonSelection.bind({
            collector: that,
            fieldName: "dragon",
        }) as any,
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        get landings() {
            return new SelectionWrapper(
                "landings",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        missions: CapsuleMissionArraySelection.bind({
            collector: that,
            fieldName: "missions",
        }) as any,
        get original_launch() {
            return new SelectionWrapper(
                "original_launch",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get reuse_count() {
            return new SelectionWrapper(
                "reuse_count",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get status() {
            return new SelectionWrapper(
                "status",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get type() {
            return new SelectionWrapper(
                "type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeCapsuleSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCapsuleSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeCapsuleSelectionInput.bind(that)() as any,
                "Capsule",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const CapsuleSelection = makeSLFN(
    makeCapsuleSelectionInput,
    "CapsuleSelection",
    "Capsule",
    0,
);

type ReturnTypeFromCapsuleArraySelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromCapsuleArraySelection = {
    dragon: ReturnTypeFromCapsuleArraySelectionRetTypes["dragon"];
    id: ReturnTypeFromCapsuleArraySelectionRetTypes["id"];
    landings: ReturnTypeFromCapsuleArraySelectionRetTypes["landings"];
    missions: ReturnTypeFromCapsuleArraySelectionRetTypes["missions"];
    original_launch: ReturnTypeFromCapsuleArraySelectionRetTypes["original_launch"];
    reuse_count: ReturnTypeFromCapsuleArraySelectionRetTypes["reuse_count"];
    status: ReturnTypeFromCapsuleArraySelectionRetTypes["status"];
    type: ReturnTypeFromCapsuleArraySelectionRetTypes["type"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCapsuleArraySelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Capsule[]>, "Capsule[]">;
};

export function makeCapsuleArraySelectionInput(
    this: any,
): ReturnTypeFromCapsuleArraySelection {
    const that = this;
    return {
        dragon: DragonSelection.bind({
            collector: that,
            fieldName: "dragon",
        }) as any,
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        get landings() {
            return new SelectionWrapper(
                "landings",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        missions: CapsuleMissionArraySelection.bind({
            collector: that,
            fieldName: "missions",
        }) as any,
        get original_launch() {
            return new SelectionWrapper(
                "original_launch",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get reuse_count() {
            return new SelectionWrapper(
                "reuse_count",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get status() {
            return new SelectionWrapper(
                "status",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get type() {
            return new SelectionWrapper(
                "type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeCapsuleArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCapsuleArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeCapsuleArraySelectionInput.bind(that)() as any,
                "Capsule[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const CapsuleArraySelection = makeSLFN(
    makeCapsuleArraySelectionInput,
    "CapsuleArraySelection",
    "Capsule",
    1,
);

type ReturnTypeFromAddressSelectionRetTypes<AS_PROMISE = 0> = {
    address: SelectionWrapperImpl<"address", "String", 0, {}, undefined>;
    city: SelectionWrapperImpl<"city", "String", 0, {}, undefined>;
    state: SelectionWrapperImpl<"state", "String", 0, {}, undefined>;
};
type ReturnTypeFromAddressSelection = {
    address: ReturnTypeFromAddressSelectionRetTypes["address"];
    city: ReturnTypeFromAddressSelectionRetTypes["city"];
    state: ReturnTypeFromAddressSelectionRetTypes["state"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeAddressSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Address>, "Address">;
};

export function makeAddressSelectionInput(
    this: any,
): ReturnTypeFromAddressSelection {
    const that = this;
    return {
        get address() {
            return new SelectionWrapper(
                "address",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get city() {
            return new SelectionWrapper(
                "city",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get state() {
            return new SelectionWrapper(
                "state",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeAddressSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeAddressSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeAddressSelectionInput.bind(that)() as any,
                "Address",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const AddressSelection = makeSLFN(
    makeAddressSelectionInput,
    "AddressSelection",
    "Address",
    0,
);

type ReturnTypeFromInfoLinksSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromInfoLinksSelection = {
    elon_twitter: ReturnTypeFromInfoLinksSelectionRetTypes["elon_twitter"];
    flickr: ReturnTypeFromInfoLinksSelectionRetTypes["flickr"];
    twitter: ReturnTypeFromInfoLinksSelectionRetTypes["twitter"];
    website: ReturnTypeFromInfoLinksSelectionRetTypes["website"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeInfoLinksSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<InfoLinks>, "InfoLinks">;
};

export function makeInfoLinksSelectionInput(
    this: any,
): ReturnTypeFromInfoLinksSelection {
    const that = this;
    return {
        get elon_twitter() {
            return new SelectionWrapper(
                "elon_twitter",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get flickr() {
            return new SelectionWrapper(
                "flickr",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get twitter() {
            return new SelectionWrapper(
                "twitter",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get website() {
            return new SelectionWrapper(
                "website",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeInfoLinksSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeInfoLinksSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeInfoLinksSelectionInput.bind(that)() as any,
                "InfoLinks",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const InfoLinksSelection = makeSLFN(
    makeInfoLinksSelectionInput,
    "InfoLinksSelection",
    "InfoLinks",
    0,
);

type ReturnTypeFromInfoSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromInfoSelection = {
    ceo: ReturnTypeFromInfoSelectionRetTypes["ceo"];
    coo: ReturnTypeFromInfoSelectionRetTypes["coo"];
    cto: ReturnTypeFromInfoSelectionRetTypes["cto"];
    cto_propulsion: ReturnTypeFromInfoSelectionRetTypes["cto_propulsion"];
    employees: ReturnTypeFromInfoSelectionRetTypes["employees"];
    founded: ReturnTypeFromInfoSelectionRetTypes["founded"];
    founder: ReturnTypeFromInfoSelectionRetTypes["founder"];
    headquarters: ReturnTypeFromInfoSelectionRetTypes["headquarters"];
    launch_sites: ReturnTypeFromInfoSelectionRetTypes["launch_sites"];
    links: ReturnTypeFromInfoSelectionRetTypes["links"];
    name: ReturnTypeFromInfoSelectionRetTypes["name"];
    summary: ReturnTypeFromInfoSelectionRetTypes["summary"];
    test_sites: ReturnTypeFromInfoSelectionRetTypes["test_sites"];
    valuation: ReturnTypeFromInfoSelectionRetTypes["valuation"];
    vehicles: ReturnTypeFromInfoSelectionRetTypes["vehicles"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeInfoSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Info>, "Info">;
};

export function makeInfoSelectionInput(this: any): ReturnTypeFromInfoSelection {
    const that = this;
    return {
        get ceo() {
            return new SelectionWrapper(
                "ceo",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get coo() {
            return new SelectionWrapper(
                "coo",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get cto() {
            return new SelectionWrapper(
                "cto",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get cto_propulsion() {
            return new SelectionWrapper(
                "cto_propulsion",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get employees() {
            return new SelectionWrapper(
                "employees",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get founded() {
            return new SelectionWrapper(
                "founded",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get founder() {
            return new SelectionWrapper(
                "founder",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        headquarters: AddressSelection.bind({
            collector: that,
            fieldName: "headquarters",
        }) as any,
        get launch_sites() {
            return new SelectionWrapper(
                "launch_sites",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        links: InfoLinksSelection.bind({
            collector: that,
            fieldName: "links",
        }) as any,
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get summary() {
            return new SelectionWrapper(
                "summary",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get test_sites() {
            return new SelectionWrapper(
                "test_sites",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get valuation() {
            return new SelectionWrapper(
                "valuation",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get vehicles() {
            return new SelectionWrapper(
                "vehicles",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeInfoSelectionInput.bind(that)(),
            ) as SLWsFromSelection<ReturnType<typeof makeInfoSelectionInput>>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeInfoSelectionInput.bind(that)() as any,
                "Info",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const InfoSelection = makeSLFN(
    makeInfoSelectionInput,
    "InfoSelection",
    "Info",
    0,
);

type ReturnTypeFromCoreSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromCoreSelection = {
    asds_attempts: ReturnTypeFromCoreSelectionRetTypes["asds_attempts"];
    asds_landings: ReturnTypeFromCoreSelectionRetTypes["asds_landings"];
    block: ReturnTypeFromCoreSelectionRetTypes["block"];
    id: ReturnTypeFromCoreSelectionRetTypes["id"];
    missions: ReturnTypeFromCoreSelectionRetTypes["missions"];
    original_launch: ReturnTypeFromCoreSelectionRetTypes["original_launch"];
    reuse_count: ReturnTypeFromCoreSelectionRetTypes["reuse_count"];
    rtls_attempts: ReturnTypeFromCoreSelectionRetTypes["rtls_attempts"];
    rtls_landings: ReturnTypeFromCoreSelectionRetTypes["rtls_landings"];
    status: ReturnTypeFromCoreSelectionRetTypes["status"];
    water_landing: ReturnTypeFromCoreSelectionRetTypes["water_landing"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCoreSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Core>, "Core">;
};

export function makeCoreSelectionInput(this: any): ReturnTypeFromCoreSelection {
    const that = this;
    return {
        get asds_attempts() {
            return new SelectionWrapper(
                "asds_attempts",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get asds_landings() {
            return new SelectionWrapper(
                "asds_landings",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get block() {
            return new SelectionWrapper("block", "Int", 0, {}, that, undefined);
        },
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        missions: CapsuleMissionArraySelection.bind({
            collector: that,
            fieldName: "missions",
        }) as any,
        get original_launch() {
            return new SelectionWrapper(
                "original_launch",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get reuse_count() {
            return new SelectionWrapper(
                "reuse_count",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get rtls_attempts() {
            return new SelectionWrapper(
                "rtls_attempts",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get rtls_landings() {
            return new SelectionWrapper(
                "rtls_landings",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get status() {
            return new SelectionWrapper(
                "status",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get water_landing() {
            return new SelectionWrapper(
                "water_landing",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeCoreSelectionInput.bind(that)(),
            ) as SLWsFromSelection<ReturnType<typeof makeCoreSelectionInput>>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeCoreSelectionInput.bind(that)() as any,
                "Core",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const CoreSelection = makeSLFN(
    makeCoreSelectionInput,
    "CoreSelection",
    "Core",
    0,
);

type ReturnTypeFromCoreArraySelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromCoreArraySelection = {
    asds_attempts: ReturnTypeFromCoreArraySelectionRetTypes["asds_attempts"];
    asds_landings: ReturnTypeFromCoreArraySelectionRetTypes["asds_landings"];
    block: ReturnTypeFromCoreArraySelectionRetTypes["block"];
    id: ReturnTypeFromCoreArraySelectionRetTypes["id"];
    missions: ReturnTypeFromCoreArraySelectionRetTypes["missions"];
    original_launch: ReturnTypeFromCoreArraySelectionRetTypes["original_launch"];
    reuse_count: ReturnTypeFromCoreArraySelectionRetTypes["reuse_count"];
    rtls_attempts: ReturnTypeFromCoreArraySelectionRetTypes["rtls_attempts"];
    rtls_landings: ReturnTypeFromCoreArraySelectionRetTypes["rtls_landings"];
    status: ReturnTypeFromCoreArraySelectionRetTypes["status"];
    water_landing: ReturnTypeFromCoreArraySelectionRetTypes["water_landing"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCoreArraySelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Core[]>, "Core[]">;
};

export function makeCoreArraySelectionInput(
    this: any,
): ReturnTypeFromCoreArraySelection {
    const that = this;
    return {
        get asds_attempts() {
            return new SelectionWrapper(
                "asds_attempts",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get asds_landings() {
            return new SelectionWrapper(
                "asds_landings",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get block() {
            return new SelectionWrapper("block", "Int", 0, {}, that, undefined);
        },
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        missions: CapsuleMissionArraySelection.bind({
            collector: that,
            fieldName: "missions",
        }) as any,
        get original_launch() {
            return new SelectionWrapper(
                "original_launch",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get reuse_count() {
            return new SelectionWrapper(
                "reuse_count",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get rtls_attempts() {
            return new SelectionWrapper(
                "rtls_attempts",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get rtls_landings() {
            return new SelectionWrapper(
                "rtls_landings",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get status() {
            return new SelectionWrapper(
                "status",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get water_landing() {
            return new SelectionWrapper(
                "water_landing",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeCoreArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCoreArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeCoreArraySelectionInput.bind(that)() as any,
                "Core[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const CoreArraySelection = makeSLFN(
    makeCoreArraySelectionInput,
    "CoreArraySelection",
    "Core",
    1,
);

type ReturnTypeFromDragonArraySelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromDragonArraySelection = {
    active: ReturnTypeFromDragonArraySelectionRetTypes["active"];
    crew_capacity: ReturnTypeFromDragonArraySelectionRetTypes["crew_capacity"];
    description: ReturnTypeFromDragonArraySelectionRetTypes["description"];
    diameter: ReturnTypeFromDragonArraySelectionRetTypes["diameter"];
    dry_mass_kg: ReturnTypeFromDragonArraySelectionRetTypes["dry_mass_kg"];
    dry_mass_lb: ReturnTypeFromDragonArraySelectionRetTypes["dry_mass_lb"];
    first_flight: ReturnTypeFromDragonArraySelectionRetTypes["first_flight"];
    heat_shield: ReturnTypeFromDragonArraySelectionRetTypes["heat_shield"];
    height_w_trunk: ReturnTypeFromDragonArraySelectionRetTypes["height_w_trunk"];
    id: ReturnTypeFromDragonArraySelectionRetTypes["id"];
    launch_payload_mass: ReturnTypeFromDragonArraySelectionRetTypes["launch_payload_mass"];
    launch_payload_vol: ReturnTypeFromDragonArraySelectionRetTypes["launch_payload_vol"];
    name: ReturnTypeFromDragonArraySelectionRetTypes["name"];
    orbit_duration_yr: ReturnTypeFromDragonArraySelectionRetTypes["orbit_duration_yr"];
    pressurized_capsule: ReturnTypeFromDragonArraySelectionRetTypes["pressurized_capsule"];
    return_payload_mass: ReturnTypeFromDragonArraySelectionRetTypes["return_payload_mass"];
    return_payload_vol: ReturnTypeFromDragonArraySelectionRetTypes["return_payload_vol"];
    sidewall_angle_deg: ReturnTypeFromDragonArraySelectionRetTypes["sidewall_angle_deg"];
    thrusters: ReturnTypeFromDragonArraySelectionRetTypes["thrusters"];
    trunk: ReturnTypeFromDragonArraySelectionRetTypes["trunk"];
    type: ReturnTypeFromDragonArraySelectionRetTypes["type"];
    wikipedia: ReturnTypeFromDragonArraySelectionRetTypes["wikipedia"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonArraySelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Dragon[]>, "Dragon[]">;
};

export function makeDragonArraySelectionInput(
    this: any,
): ReturnTypeFromDragonArraySelection {
    const that = this;
    return {
        get active() {
            return new SelectionWrapper(
                "active",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get crew_capacity() {
            return new SelectionWrapper(
                "crew_capacity",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get description() {
            return new SelectionWrapper(
                "description",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        diameter: DistanceSelection.bind({
            collector: that,
            fieldName: "diameter",
        }) as any,
        get dry_mass_kg() {
            return new SelectionWrapper(
                "dry_mass_kg",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get dry_mass_lb() {
            return new SelectionWrapper(
                "dry_mass_lb",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get first_flight() {
            return new SelectionWrapper(
                "first_flight",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        heat_shield: DragonHeatShieldSelection.bind({
            collector: that,
            fieldName: "heat_shield",
        }) as any,
        height_w_trunk: DistanceSelection.bind({
            collector: that,
            fieldName: "height_w_trunk",
        }) as any,
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        launch_payload_mass: MassSelection.bind({
            collector: that,
            fieldName: "launch_payload_mass",
        }) as any,
        launch_payload_vol: VolumeSelection.bind({
            collector: that,
            fieldName: "launch_payload_vol",
        }) as any,
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get orbit_duration_yr() {
            return new SelectionWrapper(
                "orbit_duration_yr",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        pressurized_capsule: DragonPressurizedCapsuleSelection.bind({
            collector: that,
            fieldName: "pressurized_capsule",
        }) as any,
        return_payload_mass: MassSelection.bind({
            collector: that,
            fieldName: "return_payload_mass",
        }) as any,
        return_payload_vol: VolumeSelection.bind({
            collector: that,
            fieldName: "return_payload_vol",
        }) as any,
        get sidewall_angle_deg() {
            return new SelectionWrapper(
                "sidewall_angle_deg",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        thrusters: DragonThrustArraySelection.bind({
            collector: that,
            fieldName: "thrusters",
        }) as any,
        trunk: DragonTrunkSelection.bind({
            collector: that,
            fieldName: "trunk",
        }) as any,
        get type() {
            return new SelectionWrapper(
                "type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get wikipedia() {
            return new SelectionWrapper(
                "wikipedia",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeDragonArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeDragonArraySelectionInput.bind(that)() as any,
                "Dragon[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const DragonArraySelection = makeSLFN(
    makeDragonArraySelectionInput,
    "DragonArraySelection",
    "Dragon",
    1,
);

type ReturnTypeFromLaunchSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromLaunchSelection = {
    details: ReturnTypeFromLaunchSelectionRetTypes["details"];
    id: ReturnTypeFromLaunchSelectionRetTypes["id"];
    is_tentative: ReturnTypeFromLaunchSelectionRetTypes["is_tentative"];
    launch_date_local: ReturnTypeFromLaunchSelectionRetTypes["launch_date_local"];
    launch_date_unix: ReturnTypeFromLaunchSelectionRetTypes["launch_date_unix"];
    launch_date_utc: ReturnTypeFromLaunchSelectionRetTypes["launch_date_utc"];
    launch_site: ReturnTypeFromLaunchSelectionRetTypes["launch_site"];
    launch_success: ReturnTypeFromLaunchSelectionRetTypes["launch_success"];
    launch_year: ReturnTypeFromLaunchSelectionRetTypes["launch_year"];
    links: ReturnTypeFromLaunchSelectionRetTypes["links"];
    mission_id: ReturnTypeFromLaunchSelectionRetTypes["mission_id"];
    mission_name: ReturnTypeFromLaunchSelectionRetTypes["mission_name"];
    rocket: ReturnTypeFromLaunchSelectionRetTypes["rocket"];
    ships: ReturnTypeFromLaunchSelectionRetTypes["ships"];
    static_fire_date_unix: ReturnTypeFromLaunchSelectionRetTypes["static_fire_date_unix"];
    static_fire_date_utc: ReturnTypeFromLaunchSelectionRetTypes["static_fire_date_utc"];
    telemetry: ReturnTypeFromLaunchSelectionRetTypes["telemetry"];
    tentative_max_precision: ReturnTypeFromLaunchSelectionRetTypes["tentative_max_precision"];
    upcoming: ReturnTypeFromLaunchSelectionRetTypes["upcoming"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Launch>, "Launch">;
};

export function makeLaunchSelectionInput(
    this: any,
): ReturnTypeFromLaunchSelection {
    const that = this;
    return {
        get details() {
            return new SelectionWrapper(
                "details",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        get is_tentative() {
            return new SelectionWrapper(
                "is_tentative",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get launch_date_local() {
            return new SelectionWrapper(
                "launch_date_local",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get launch_date_unix() {
            return new SelectionWrapper(
                "launch_date_unix",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get launch_date_utc() {
            return new SelectionWrapper(
                "launch_date_utc",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        launch_site: LaunchSiteSelection.bind({
            collector: that,
            fieldName: "launch_site",
        }) as any,
        get launch_success() {
            return new SelectionWrapper(
                "launch_success",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get launch_year() {
            return new SelectionWrapper(
                "launch_year",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        links: LaunchLinksSelection.bind({
            collector: that,
            fieldName: "links",
        }) as any,
        get mission_id() {
            return new SelectionWrapper(
                "mission_id",
                "String",
                1,
                {},
                that,
                undefined,
            );
        },
        get mission_name() {
            return new SelectionWrapper(
                "mission_name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        rocket: LaunchRocketSelection.bind({
            collector: that,
            fieldName: "rocket",
        }) as any,
        ships: ShipArraySelection.bind({
            collector: that,
            fieldName: "ships",
        }) as any,
        get static_fire_date_unix() {
            return new SelectionWrapper(
                "static_fire_date_unix",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get static_fire_date_utc() {
            return new SelectionWrapper(
                "static_fire_date_utc",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        telemetry: LaunchTelemetrySelection.bind({
            collector: that,
            fieldName: "telemetry",
        }) as any,
        get tentative_max_precision() {
            return new SelectionWrapper(
                "tentative_max_precision",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get upcoming() {
            return new SelectionWrapper(
                "upcoming",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchSelectionInput.bind(that)(),
            ) as SLWsFromSelection<ReturnType<typeof makeLaunchSelectionInput>>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLaunchSelectionInput.bind(that)() as any,
                "Launch",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LaunchSelection = makeSLFN(
    makeLaunchSelectionInput,
    "LaunchSelection",
    "Launch",
    0,
);

type ReturnTypeFromLaunchSiteSelectionRetTypes<AS_PROMISE = 0> = {
    site_id: SelectionWrapperImpl<"site_id", "String", 0, {}, undefined>;
    site_name: SelectionWrapperImpl<"site_name", "String", 0, {}, undefined>;
    site_name_long: SelectionWrapperImpl<
        "site_name_long",
        "String",
        0,
        {},
        undefined
    >;
};
type ReturnTypeFromLaunchSiteSelection = {
    site_id: ReturnTypeFromLaunchSiteSelectionRetTypes["site_id"];
    site_name: ReturnTypeFromLaunchSiteSelectionRetTypes["site_name"];
    site_name_long: ReturnTypeFromLaunchSiteSelectionRetTypes["site_name_long"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchSiteSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<LaunchSite>, "LaunchSite">;
};

export function makeLaunchSiteSelectionInput(
    this: any,
): ReturnTypeFromLaunchSiteSelection {
    const that = this;
    return {
        get site_id() {
            return new SelectionWrapper(
                "site_id",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get site_name() {
            return new SelectionWrapper(
                "site_name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get site_name_long() {
            return new SelectionWrapper(
                "site_name_long",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchSiteSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchSiteSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLaunchSiteSelectionInput.bind(that)() as any,
                "LaunchSite",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LaunchSiteSelection = makeSLFN(
    makeLaunchSiteSelectionInput,
    "LaunchSiteSelection",
    "LaunchSite",
    0,
);

type ReturnTypeFromLaunchLinksSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromLaunchLinksSelection = {
    article_link: ReturnTypeFromLaunchLinksSelectionRetTypes["article_link"];
    flickr_images: ReturnTypeFromLaunchLinksSelectionRetTypes["flickr_images"];
    mission_patch: ReturnTypeFromLaunchLinksSelectionRetTypes["mission_patch"];
    mission_patch_small: ReturnTypeFromLaunchLinksSelectionRetTypes["mission_patch_small"];
    presskit: ReturnTypeFromLaunchLinksSelectionRetTypes["presskit"];
    reddit_campaign: ReturnTypeFromLaunchLinksSelectionRetTypes["reddit_campaign"];
    reddit_launch: ReturnTypeFromLaunchLinksSelectionRetTypes["reddit_launch"];
    reddit_media: ReturnTypeFromLaunchLinksSelectionRetTypes["reddit_media"];
    reddit_recovery: ReturnTypeFromLaunchLinksSelectionRetTypes["reddit_recovery"];
    video_link: ReturnTypeFromLaunchLinksSelectionRetTypes["video_link"];
    wikipedia: ReturnTypeFromLaunchLinksSelectionRetTypes["wikipedia"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchLinksSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<LaunchLinks>, "LaunchLinks">;
};

export function makeLaunchLinksSelectionInput(
    this: any,
): ReturnTypeFromLaunchLinksSelection {
    const that = this;
    return {
        get article_link() {
            return new SelectionWrapper(
                "article_link",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get flickr_images() {
            return new SelectionWrapper(
                "flickr_images",
                "String",
                1,
                {},
                that,
                undefined,
            );
        },
        get mission_patch() {
            return new SelectionWrapper(
                "mission_patch",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get mission_patch_small() {
            return new SelectionWrapper(
                "mission_patch_small",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get presskit() {
            return new SelectionWrapper(
                "presskit",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get reddit_campaign() {
            return new SelectionWrapper(
                "reddit_campaign",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get reddit_launch() {
            return new SelectionWrapper(
                "reddit_launch",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get reddit_media() {
            return new SelectionWrapper(
                "reddit_media",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get reddit_recovery() {
            return new SelectionWrapper(
                "reddit_recovery",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get video_link() {
            return new SelectionWrapper(
                "video_link",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get wikipedia() {
            return new SelectionWrapper(
                "wikipedia",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchLinksSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchLinksSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLaunchLinksSelectionInput.bind(that)() as any,
                "LaunchLinks",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LaunchLinksSelection = makeSLFN(
    makeLaunchLinksSelectionInput,
    "LaunchLinksSelection",
    "LaunchLinks",
    0,
);

type ReturnTypeFromLaunchRocketSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromLaunchRocketSelection = {
    fairings: ReturnTypeFromLaunchRocketSelectionRetTypes["fairings"];
    first_stage: ReturnTypeFromLaunchRocketSelectionRetTypes["first_stage"];
    rocket: ReturnTypeFromLaunchRocketSelectionRetTypes["rocket"];
    rocket_name: ReturnTypeFromLaunchRocketSelectionRetTypes["rocket_name"];
    rocket_type: ReturnTypeFromLaunchRocketSelectionRetTypes["rocket_type"];
    second_stage: ReturnTypeFromLaunchRocketSelectionRetTypes["second_stage"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<LaunchRocket>, "LaunchRocket">;
};

export function makeLaunchRocketSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketSelection {
    const that = this;
    return {
        fairings: LaunchRocketFairingsSelection.bind({
            collector: that,
            fieldName: "fairings",
        }) as any,
        first_stage: LaunchRocketFirstStageSelection.bind({
            collector: that,
            fieldName: "first_stage",
        }) as any,
        rocket: RocketSelection.bind({
            collector: that,
            fieldName: "rocket",
        }) as any,
        get rocket_name() {
            return new SelectionWrapper(
                "rocket_name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get rocket_type() {
            return new SelectionWrapper(
                "rocket_type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        second_stage: LaunchRocketSecondStageSelection.bind({
            collector: that,
            fieldName: "second_stage",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchRocketSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchRocketSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLaunchRocketSelectionInput.bind(that)() as any,
                "LaunchRocket",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LaunchRocketSelection = makeSLFN(
    makeLaunchRocketSelectionInput,
    "LaunchRocketSelection",
    "LaunchRocket",
    0,
);

type ReturnTypeFromLaunchRocketFairingsSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromLaunchRocketFairingsSelection = {
    recovered: ReturnTypeFromLaunchRocketFairingsSelectionRetTypes["recovered"];
    recovery_attempt: ReturnTypeFromLaunchRocketFairingsSelectionRetTypes["recovery_attempt"];
    reused: ReturnTypeFromLaunchRocketFairingsSelectionRetTypes["reused"];
    ship: ReturnTypeFromLaunchRocketFairingsSelectionRetTypes["ship"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketFairingsSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<LaunchRocketFairings>,
        "LaunchRocketFairings"
    >;
};

export function makeLaunchRocketFairingsSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketFairingsSelection {
    const that = this;
    return {
        get recovered() {
            return new SelectionWrapper(
                "recovered",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get recovery_attempt() {
            return new SelectionWrapper(
                "recovery_attempt",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get reused() {
            return new SelectionWrapper(
                "reused",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get ship() {
            return new SelectionWrapper(
                "ship",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchRocketFairingsSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchRocketFairingsSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLaunchRocketFairingsSelectionInput.bind(that)() as any,
                "LaunchRocketFairings",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LaunchRocketFairingsSelection = makeSLFN(
    makeLaunchRocketFairingsSelectionInput,
    "LaunchRocketFairingsSelection",
    "LaunchRocketFairings",
    0,
);

type ReturnTypeFromLaunchRocketFirstStageSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromLaunchRocketFirstStageSelection = {
    cores: ReturnTypeFromLaunchRocketFirstStageSelectionRetTypes["cores"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<LaunchRocketFirstStage>,
        "LaunchRocketFirstStage"
    >;
};

export function makeLaunchRocketFirstStageSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketFirstStageSelection {
    const that = this;
    return {
        cores: LaunchRocketFirstStageCoreArraySelection.bind({
            collector: that,
            fieldName: "cores",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLaunchRocketFirstStageSelectionInput.bind(that)() as any,
                "LaunchRocketFirstStage",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LaunchRocketFirstStageSelection = makeSLFN(
    makeLaunchRocketFirstStageSelectionInput,
    "LaunchRocketFirstStageSelection",
    "LaunchRocketFirstStage",
    0,
);

type ReturnTypeFromLaunchRocketFirstStageCoreArraySelectionRetTypes<
    AS_PROMISE = 0,
> = {
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
};
type ReturnTypeFromLaunchRocketFirstStageCoreArraySelection = {
    block: ReturnTypeFromLaunchRocketFirstStageCoreArraySelectionRetTypes["block"];
    core: ReturnTypeFromLaunchRocketFirstStageCoreArraySelectionRetTypes["core"];
    flight: ReturnTypeFromLaunchRocketFirstStageCoreArraySelectionRetTypes["flight"];
    gridfins: ReturnTypeFromLaunchRocketFirstStageCoreArraySelectionRetTypes["gridfins"];
    land_success: ReturnTypeFromLaunchRocketFirstStageCoreArraySelectionRetTypes["land_success"];
    landing_intent: ReturnTypeFromLaunchRocketFirstStageCoreArraySelectionRetTypes["landing_intent"];
    landing_type: ReturnTypeFromLaunchRocketFirstStageCoreArraySelectionRetTypes["landing_type"];
    landing_vehicle: ReturnTypeFromLaunchRocketFirstStageCoreArraySelectionRetTypes["landing_vehicle"];
    legs: ReturnTypeFromLaunchRocketFirstStageCoreArraySelectionRetTypes["legs"];
    reused: ReturnTypeFromLaunchRocketFirstStageCoreArraySelectionRetTypes["reused"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketFirstStageCoreArraySelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<LaunchRocketFirstStageCore[]>,
        "LaunchRocketFirstStageCore[]"
    >;
};

export function makeLaunchRocketFirstStageCoreArraySelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketFirstStageCoreArraySelection {
    const that = this;
    return {
        get block() {
            return new SelectionWrapper("block", "Int", 0, {}, that, undefined);
        },
        core: CoreSelection.bind({ collector: that, fieldName: "core" }) as any,
        get flight() {
            return new SelectionWrapper(
                "flight",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get gridfins() {
            return new SelectionWrapper(
                "gridfins",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get land_success() {
            return new SelectionWrapper(
                "land_success",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get landing_intent() {
            return new SelectionWrapper(
                "landing_intent",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get landing_type() {
            return new SelectionWrapper(
                "landing_type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get landing_vehicle() {
            return new SelectionWrapper(
                "landing_vehicle",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get legs() {
            return new SelectionWrapper(
                "legs",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get reused() {
            return new SelectionWrapper(
                "reused",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchRocketFirstStageCoreArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<
                    typeof makeLaunchRocketFirstStageCoreArraySelectionInput
                >
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLaunchRocketFirstStageCoreArraySelectionInput.bind(
                    that,
                )() as any,
                "LaunchRocketFirstStageCore[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LaunchRocketFirstStageCoreArraySelection = makeSLFN(
    makeLaunchRocketFirstStageCoreArraySelectionInput,
    "LaunchRocketFirstStageCoreArraySelection",
    "LaunchRocketFirstStageCore",
    1,
);

type ReturnTypeFromRocketSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromRocketSelection = {
    active: ReturnTypeFromRocketSelectionRetTypes["active"];
    boosters: ReturnTypeFromRocketSelectionRetTypes["boosters"];
    company: ReturnTypeFromRocketSelectionRetTypes["company"];
    cost_per_launch: ReturnTypeFromRocketSelectionRetTypes["cost_per_launch"];
    country: ReturnTypeFromRocketSelectionRetTypes["country"];
    description: ReturnTypeFromRocketSelectionRetTypes["description"];
    diameter: ReturnTypeFromRocketSelectionRetTypes["diameter"];
    engines: ReturnTypeFromRocketSelectionRetTypes["engines"];
    first_flight: ReturnTypeFromRocketSelectionRetTypes["first_flight"];
    first_stage: ReturnTypeFromRocketSelectionRetTypes["first_stage"];
    height: ReturnTypeFromRocketSelectionRetTypes["height"];
    id: ReturnTypeFromRocketSelectionRetTypes["id"];
    landing_legs: ReturnTypeFromRocketSelectionRetTypes["landing_legs"];
    mass: ReturnTypeFromRocketSelectionRetTypes["mass"];
    name: ReturnTypeFromRocketSelectionRetTypes["name"];
    payload_weights: ReturnTypeFromRocketSelectionRetTypes["payload_weights"];
    second_stage: ReturnTypeFromRocketSelectionRetTypes["second_stage"];
    stages: ReturnTypeFromRocketSelectionRetTypes["stages"];
    success_rate_pct: ReturnTypeFromRocketSelectionRetTypes["success_rate_pct"];
    type: ReturnTypeFromRocketSelectionRetTypes["type"];
    wikipedia: ReturnTypeFromRocketSelectionRetTypes["wikipedia"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Rocket>, "Rocket">;
};

export function makeRocketSelectionInput(
    this: any,
): ReturnTypeFromRocketSelection {
    const that = this;
    return {
        get active() {
            return new SelectionWrapper(
                "active",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get boosters() {
            return new SelectionWrapper(
                "boosters",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get company() {
            return new SelectionWrapper(
                "company",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get cost_per_launch() {
            return new SelectionWrapper(
                "cost_per_launch",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get country() {
            return new SelectionWrapper(
                "country",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get description() {
            return new SelectionWrapper(
                "description",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        diameter: DistanceSelection.bind({
            collector: that,
            fieldName: "diameter",
        }) as any,
        engines: RocketEnginesSelection.bind({
            collector: that,
            fieldName: "engines",
        }) as any,
        get first_flight() {
            return new SelectionWrapper(
                "first_flight",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        first_stage: RocketFirstStageSelection.bind({
            collector: that,
            fieldName: "first_stage",
        }) as any,
        height: DistanceSelection.bind({
            collector: that,
            fieldName: "height",
        }) as any,
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        landing_legs: RocketLandingLegsSelection.bind({
            collector: that,
            fieldName: "landing_legs",
        }) as any,
        mass: MassSelection.bind({ collector: that, fieldName: "mass" }) as any,
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        payload_weights: RocketPayloadWeightArraySelection.bind({
            collector: that,
            fieldName: "payload_weights",
        }) as any,
        second_stage: RocketSecondStageSelection.bind({
            collector: that,
            fieldName: "second_stage",
        }) as any,
        get stages() {
            return new SelectionWrapper(
                "stages",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get success_rate_pct() {
            return new SelectionWrapper(
                "success_rate_pct",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get type() {
            return new SelectionWrapper(
                "type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get wikipedia() {
            return new SelectionWrapper(
                "wikipedia",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketSelectionInput.bind(that)(),
            ) as SLWsFromSelection<ReturnType<typeof makeRocketSelectionInput>>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeRocketSelectionInput.bind(that)() as any,
                "Rocket",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const RocketSelection = makeSLFN(
    makeRocketSelectionInput,
    "RocketSelection",
    "Rocket",
    0,
);

type ReturnTypeFromRocketEnginesSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromRocketEnginesSelection = {
    engine_loss_max: ReturnTypeFromRocketEnginesSelectionRetTypes["engine_loss_max"];
    layout: ReturnTypeFromRocketEnginesSelectionRetTypes["layout"];
    number: ReturnTypeFromRocketEnginesSelectionRetTypes["number"];
    propellant_1: ReturnTypeFromRocketEnginesSelectionRetTypes["propellant_1"];
    propellant_2: ReturnTypeFromRocketEnginesSelectionRetTypes["propellant_2"];
    thrust_sea_level: ReturnTypeFromRocketEnginesSelectionRetTypes["thrust_sea_level"];
    thrust_to_weight: ReturnTypeFromRocketEnginesSelectionRetTypes["thrust_to_weight"];
    thrust_vacuum: ReturnTypeFromRocketEnginesSelectionRetTypes["thrust_vacuum"];
    type: ReturnTypeFromRocketEnginesSelectionRetTypes["type"];
    version: ReturnTypeFromRocketEnginesSelectionRetTypes["version"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketEnginesSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<RocketEngines>,
        "RocketEngines"
    >;
};

export function makeRocketEnginesSelectionInput(
    this: any,
): ReturnTypeFromRocketEnginesSelection {
    const that = this;
    return {
        get engine_loss_max() {
            return new SelectionWrapper(
                "engine_loss_max",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get layout() {
            return new SelectionWrapper(
                "layout",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get number() {
            return new SelectionWrapper(
                "number",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get propellant_1() {
            return new SelectionWrapper(
                "propellant_1",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get propellant_2() {
            return new SelectionWrapper(
                "propellant_2",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        thrust_sea_level: ForceSelection.bind({
            collector: that,
            fieldName: "thrust_sea_level",
        }) as any,
        get thrust_to_weight() {
            return new SelectionWrapper(
                "thrust_to_weight",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        thrust_vacuum: ForceSelection.bind({
            collector: that,
            fieldName: "thrust_vacuum",
        }) as any,
        get type() {
            return new SelectionWrapper(
                "type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get version() {
            return new SelectionWrapper(
                "version",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketEnginesSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketEnginesSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeRocketEnginesSelectionInput.bind(that)() as any,
                "RocketEngines",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const RocketEnginesSelection = makeSLFN(
    makeRocketEnginesSelectionInput,
    "RocketEnginesSelection",
    "RocketEngines",
    0,
);

type ReturnTypeFromRocketFirstStageSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromRocketFirstStageSelection = {
    burn_time_sec: ReturnTypeFromRocketFirstStageSelectionRetTypes["burn_time_sec"];
    engines: ReturnTypeFromRocketFirstStageSelectionRetTypes["engines"];
    fuel_amount_tons: ReturnTypeFromRocketFirstStageSelectionRetTypes["fuel_amount_tons"];
    reusable: ReturnTypeFromRocketFirstStageSelectionRetTypes["reusable"];
    thrust_sea_level: ReturnTypeFromRocketFirstStageSelectionRetTypes["thrust_sea_level"];
    thrust_vacuum: ReturnTypeFromRocketFirstStageSelectionRetTypes["thrust_vacuum"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketFirstStageSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<RocketFirstStage>,
        "RocketFirstStage"
    >;
};

export function makeRocketFirstStageSelectionInput(
    this: any,
): ReturnTypeFromRocketFirstStageSelection {
    const that = this;
    return {
        get burn_time_sec() {
            return new SelectionWrapper(
                "burn_time_sec",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get engines() {
            return new SelectionWrapper(
                "engines",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get fuel_amount_tons() {
            return new SelectionWrapper(
                "fuel_amount_tons",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get reusable() {
            return new SelectionWrapper(
                "reusable",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        thrust_sea_level: ForceSelection.bind({
            collector: that,
            fieldName: "thrust_sea_level",
        }) as any,
        thrust_vacuum: ForceSelection.bind({
            collector: that,
            fieldName: "thrust_vacuum",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketFirstStageSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketFirstStageSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeRocketFirstStageSelectionInput.bind(that)() as any,
                "RocketFirstStage",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const RocketFirstStageSelection = makeSLFN(
    makeRocketFirstStageSelectionInput,
    "RocketFirstStageSelection",
    "RocketFirstStage",
    0,
);

type ReturnTypeFromRocketLandingLegsSelectionRetTypes<AS_PROMISE = 0> = {
    material: SelectionWrapperImpl<"material", "String", 0, {}, undefined>;
    number: SelectionWrapperImpl<"number", "Int", 0, {}, undefined>;
};
type ReturnTypeFromRocketLandingLegsSelection = {
    material: ReturnTypeFromRocketLandingLegsSelectionRetTypes["material"];
    number: ReturnTypeFromRocketLandingLegsSelectionRetTypes["number"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketLandingLegsSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<RocketLandingLegs>,
        "RocketLandingLegs"
    >;
};

export function makeRocketLandingLegsSelectionInput(
    this: any,
): ReturnTypeFromRocketLandingLegsSelection {
    const that = this;
    return {
        get material() {
            return new SelectionWrapper(
                "material",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get number() {
            return new SelectionWrapper(
                "number",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketLandingLegsSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketLandingLegsSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeRocketLandingLegsSelectionInput.bind(that)() as any,
                "RocketLandingLegs",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const RocketLandingLegsSelection = makeSLFN(
    makeRocketLandingLegsSelectionInput,
    "RocketLandingLegsSelection",
    "RocketLandingLegs",
    0,
);

type ReturnTypeFromRocketPayloadWeightArraySelectionRetTypes<AS_PROMISE = 0> = {
    id: SelectionWrapperImpl<"id", "String", 0, {}, undefined>;
    kg: SelectionWrapperImpl<"kg", "Int", 0, {}, undefined>;
    lb: SelectionWrapperImpl<"lb", "Int", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
};
type ReturnTypeFromRocketPayloadWeightArraySelection = {
    id: ReturnTypeFromRocketPayloadWeightArraySelectionRetTypes["id"];
    kg: ReturnTypeFromRocketPayloadWeightArraySelectionRetTypes["kg"];
    lb: ReturnTypeFromRocketPayloadWeightArraySelectionRetTypes["lb"];
    name: ReturnTypeFromRocketPayloadWeightArraySelectionRetTypes["name"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketPayloadWeightArraySelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<RocketPayloadWeight[]>,
        "RocketPayloadWeight[]"
    >;
};

export function makeRocketPayloadWeightArraySelectionInput(
    this: any,
): ReturnTypeFromRocketPayloadWeightArraySelection {
    const that = this;
    return {
        get id() {
            return new SelectionWrapper("id", "String", 0, {}, that, undefined);
        },
        get kg() {
            return new SelectionWrapper("kg", "Int", 0, {}, that, undefined);
        },
        get lb() {
            return new SelectionWrapper("lb", "Int", 0, {}, that, undefined);
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketPayloadWeightArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketPayloadWeightArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeRocketPayloadWeightArraySelectionInput.bind(that)() as any,
                "RocketPayloadWeight[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const RocketPayloadWeightArraySelection = makeSLFN(
    makeRocketPayloadWeightArraySelectionInput,
    "RocketPayloadWeightArraySelection",
    "RocketPayloadWeight",
    1,
);

type ReturnTypeFromRocketSecondStageSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromRocketSecondStageSelection = {
    burn_time_sec: ReturnTypeFromRocketSecondStageSelectionRetTypes["burn_time_sec"];
    engines: ReturnTypeFromRocketSecondStageSelectionRetTypes["engines"];
    fuel_amount_tons: ReturnTypeFromRocketSecondStageSelectionRetTypes["fuel_amount_tons"];
    payloads: ReturnTypeFromRocketSecondStageSelectionRetTypes["payloads"];
    thrust: ReturnTypeFromRocketSecondStageSelectionRetTypes["thrust"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketSecondStageSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<RocketSecondStage>,
        "RocketSecondStage"
    >;
};

export function makeRocketSecondStageSelectionInput(
    this: any,
): ReturnTypeFromRocketSecondStageSelection {
    const that = this;
    return {
        get burn_time_sec() {
            return new SelectionWrapper(
                "burn_time_sec",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get engines() {
            return new SelectionWrapper(
                "engines",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get fuel_amount_tons() {
            return new SelectionWrapper(
                "fuel_amount_tons",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        payloads: RocketSecondStagePayloadsSelection.bind({
            collector: that,
            fieldName: "payloads",
        }) as any,
        thrust: ForceSelection.bind({
            collector: that,
            fieldName: "thrust",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketSecondStageSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketSecondStageSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeRocketSecondStageSelectionInput.bind(that)() as any,
                "RocketSecondStage",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const RocketSecondStageSelection = makeSLFN(
    makeRocketSecondStageSelectionInput,
    "RocketSecondStageSelection",
    "RocketSecondStage",
    0,
);

type ReturnTypeFromRocketSecondStagePayloadsSelectionRetTypes<AS_PROMISE = 0> =
    {
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
    };
type ReturnTypeFromRocketSecondStagePayloadsSelection = {
    composite_fairing: ReturnTypeFromRocketSecondStagePayloadsSelectionRetTypes["composite_fairing"];
    option_1: ReturnTypeFromRocketSecondStagePayloadsSelectionRetTypes["option_1"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketSecondStagePayloadsSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<RocketSecondStagePayloads>,
        "RocketSecondStagePayloads"
    >;
};

export function makeRocketSecondStagePayloadsSelectionInput(
    this: any,
): ReturnTypeFromRocketSecondStagePayloadsSelection {
    const that = this;
    return {
        composite_fairing:
            RocketSecondStagePayloadCompositeFairingSelection.bind({
                collector: that,
                fieldName: "composite_fairing",
            }) as any,
        get option_1() {
            return new SelectionWrapper(
                "option_1",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketSecondStagePayloadsSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketSecondStagePayloadsSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeRocketSecondStagePayloadsSelectionInput.bind(that)() as any,
                "RocketSecondStagePayloads",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const RocketSecondStagePayloadsSelection = makeSLFN(
    makeRocketSecondStagePayloadsSelectionInput,
    "RocketSecondStagePayloadsSelection",
    "RocketSecondStagePayloads",
    0,
);

type ReturnTypeFromRocketSecondStagePayloadCompositeFairingSelectionRetTypes<
    AS_PROMISE = 0,
> = {
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
};
type ReturnTypeFromRocketSecondStagePayloadCompositeFairingSelection = {
    diameter: ReturnTypeFromRocketSecondStagePayloadCompositeFairingSelectionRetTypes["diameter"];
    height: ReturnTypeFromRocketSecondStagePayloadCompositeFairingSelectionRetTypes["height"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<RocketSecondStagePayloadCompositeFairing>,
        "RocketSecondStagePayloadCompositeFairing"
    >;
};

export function makeRocketSecondStagePayloadCompositeFairingSelectionInput(
    this: any,
): ReturnTypeFromRocketSecondStagePayloadCompositeFairingSelection {
    const that = this;
    return {
        diameter: DistanceSelection.bind({
            collector: that,
            fieldName: "diameter",
        }) as any,
        height: DistanceSelection.bind({
            collector: that,
            fieldName: "height",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeRocketSecondStagePayloadCompositeFairingSelectionInput.bind(
                    that,
                )() as any,
                "RocketSecondStagePayloadCompositeFairing",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const RocketSecondStagePayloadCompositeFairingSelection = makeSLFN(
    makeRocketSecondStagePayloadCompositeFairingSelectionInput,
    "RocketSecondStagePayloadCompositeFairingSelection",
    "RocketSecondStagePayloadCompositeFairing",
    0,
);

type ReturnTypeFromLaunchRocketSecondStageSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromLaunchRocketSecondStageSelection = {
    block: ReturnTypeFromLaunchRocketSecondStageSelectionRetTypes["block"];
    payloads: ReturnTypeFromLaunchRocketSecondStageSelectionRetTypes["payloads"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketSecondStageSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<LaunchRocketSecondStage>,
        "LaunchRocketSecondStage"
    >;
};

export function makeLaunchRocketSecondStageSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketSecondStageSelection {
    const that = this;
    return {
        get block() {
            return new SelectionWrapper("block", "Int", 0, {}, that, undefined);
        },
        payloads: PayloadArraySelection.bind({
            collector: that,
            fieldName: "payloads",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchRocketSecondStageSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchRocketSecondStageSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLaunchRocketSecondStageSelectionInput.bind(that)() as any,
                "LaunchRocketSecondStage",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LaunchRocketSecondStageSelection = makeSLFN(
    makeLaunchRocketSecondStageSelectionInput,
    "LaunchRocketSecondStageSelection",
    "LaunchRocketSecondStage",
    0,
);

type ReturnTypeFromPayloadArraySelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromPayloadArraySelection = {
    customers: ReturnTypeFromPayloadArraySelectionRetTypes["customers"];
    id: ReturnTypeFromPayloadArraySelectionRetTypes["id"];
    manufacturer: ReturnTypeFromPayloadArraySelectionRetTypes["manufacturer"];
    nationality: ReturnTypeFromPayloadArraySelectionRetTypes["nationality"];
    norad_id: ReturnTypeFromPayloadArraySelectionRetTypes["norad_id"];
    orbit: ReturnTypeFromPayloadArraySelectionRetTypes["orbit"];
    orbit_params: ReturnTypeFromPayloadArraySelectionRetTypes["orbit_params"];
    payload_mass_kg: ReturnTypeFromPayloadArraySelectionRetTypes["payload_mass_kg"];
    payload_mass_lbs: ReturnTypeFromPayloadArraySelectionRetTypes["payload_mass_lbs"];
    payload_type: ReturnTypeFromPayloadArraySelectionRetTypes["payload_type"];
    reused: ReturnTypeFromPayloadArraySelectionRetTypes["reused"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePayloadArraySelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Payload[]>, "Payload[]">;
};

export function makePayloadArraySelectionInput(
    this: any,
): ReturnTypeFromPayloadArraySelection {
    const that = this;
    return {
        get customers() {
            return new SelectionWrapper(
                "customers",
                "String",
                1,
                {},
                that,
                undefined,
            );
        },
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        get manufacturer() {
            return new SelectionWrapper(
                "manufacturer",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get nationality() {
            return new SelectionWrapper(
                "nationality",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get norad_id() {
            return new SelectionWrapper(
                "norad_id",
                "Int",
                1,
                {},
                that,
                undefined,
            );
        },
        get orbit() {
            return new SelectionWrapper(
                "orbit",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        orbit_params: PayloadOrbitParamsSelection.bind({
            collector: that,
            fieldName: "orbit_params",
        }) as any,
        get payload_mass_kg() {
            return new SelectionWrapper(
                "payload_mass_kg",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get payload_mass_lbs() {
            return new SelectionWrapper(
                "payload_mass_lbs",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get payload_type() {
            return new SelectionWrapper(
                "payload_type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get reused() {
            return new SelectionWrapper(
                "reused",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makePayloadArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePayloadArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makePayloadArraySelectionInput.bind(that)() as any,
                "Payload[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const PayloadArraySelection = makeSLFN(
    makePayloadArraySelectionInput,
    "PayloadArraySelection",
    "Payload",
    1,
);

type ReturnTypeFromPayloadOrbitParamsSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromPayloadOrbitParamsSelection = {
    apoapsis_km: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["apoapsis_km"];
    arg_of_pericenter: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["arg_of_pericenter"];
    eccentricity: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["eccentricity"];
    epoch: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["epoch"];
    inclination_deg: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["inclination_deg"];
    lifespan_years: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["lifespan_years"];
    longitude: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["longitude"];
    mean_anomaly: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["mean_anomaly"];
    mean_motion: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["mean_motion"];
    periapsis_km: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["periapsis_km"];
    period_min: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["period_min"];
    raan: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["raan"];
    reference_system: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["reference_system"];
    regime: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["regime"];
    semi_major_axis_km: ReturnTypeFromPayloadOrbitParamsSelectionRetTypes["semi_major_axis_km"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePayloadOrbitParamsSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<PayloadOrbitParams>,
        "PayloadOrbitParams"
    >;
};

export function makePayloadOrbitParamsSelectionInput(
    this: any,
): ReturnTypeFromPayloadOrbitParamsSelection {
    const that = this;
    return {
        get apoapsis_km() {
            return new SelectionWrapper(
                "apoapsis_km",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get arg_of_pericenter() {
            return new SelectionWrapper(
                "arg_of_pericenter",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get eccentricity() {
            return new SelectionWrapper(
                "eccentricity",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get epoch() {
            return new SelectionWrapper(
                "epoch",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get inclination_deg() {
            return new SelectionWrapper(
                "inclination_deg",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get lifespan_years() {
            return new SelectionWrapper(
                "lifespan_years",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get longitude() {
            return new SelectionWrapper(
                "longitude",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get mean_anomaly() {
            return new SelectionWrapper(
                "mean_anomaly",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get mean_motion() {
            return new SelectionWrapper(
                "mean_motion",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get periapsis_km() {
            return new SelectionWrapper(
                "periapsis_km",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get period_min() {
            return new SelectionWrapper(
                "period_min",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get raan() {
            return new SelectionWrapper(
                "raan",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get reference_system() {
            return new SelectionWrapper(
                "reference_system",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get regime() {
            return new SelectionWrapper(
                "regime",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get semi_major_axis_km() {
            return new SelectionWrapper(
                "semi_major_axis_km",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makePayloadOrbitParamsSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePayloadOrbitParamsSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makePayloadOrbitParamsSelectionInput.bind(that)() as any,
                "PayloadOrbitParams",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const PayloadOrbitParamsSelection = makeSLFN(
    makePayloadOrbitParamsSelectionInput,
    "PayloadOrbitParamsSelection",
    "PayloadOrbitParams",
    0,
);

type ReturnTypeFromShipArraySelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromShipArraySelection = {
    abs: ReturnTypeFromShipArraySelectionRetTypes["abs"];
    active: ReturnTypeFromShipArraySelectionRetTypes["active"];
    attempted_landings: ReturnTypeFromShipArraySelectionRetTypes["attempted_landings"];
    class: ReturnTypeFromShipArraySelectionRetTypes["class"];
    course_deg: ReturnTypeFromShipArraySelectionRetTypes["course_deg"];
    home_port: ReturnTypeFromShipArraySelectionRetTypes["home_port"];
    id: ReturnTypeFromShipArraySelectionRetTypes["id"];
    image: ReturnTypeFromShipArraySelectionRetTypes["image"];
    imo: ReturnTypeFromShipArraySelectionRetTypes["imo"];
    missions: ReturnTypeFromShipArraySelectionRetTypes["missions"];
    mmsi: ReturnTypeFromShipArraySelectionRetTypes["mmsi"];
    model: ReturnTypeFromShipArraySelectionRetTypes["model"];
    name: ReturnTypeFromShipArraySelectionRetTypes["name"];
    position: ReturnTypeFromShipArraySelectionRetTypes["position"];
    roles: ReturnTypeFromShipArraySelectionRetTypes["roles"];
    speed_kn: ReturnTypeFromShipArraySelectionRetTypes["speed_kn"];
    status: ReturnTypeFromShipArraySelectionRetTypes["status"];
    successful_landings: ReturnTypeFromShipArraySelectionRetTypes["successful_landings"];
    type: ReturnTypeFromShipArraySelectionRetTypes["type"];
    url: ReturnTypeFromShipArraySelectionRetTypes["url"];
    weight_kg: ReturnTypeFromShipArraySelectionRetTypes["weight_kg"];
    weight_lbs: ReturnTypeFromShipArraySelectionRetTypes["weight_lbs"];
    year_built: ReturnTypeFromShipArraySelectionRetTypes["year_built"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipArraySelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Ship[]>, "Ship[]">;
};

export function makeShipArraySelectionInput(
    this: any,
): ReturnTypeFromShipArraySelection {
    const that = this;
    return {
        get abs() {
            return new SelectionWrapper("abs", "Int", 0, {}, that, undefined);
        },
        get active() {
            return new SelectionWrapper(
                "active",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get attempted_landings() {
            return new SelectionWrapper(
                "attempted_landings",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get class() {
            return new SelectionWrapper("class", "Int", 0, {}, that, undefined);
        },
        get course_deg() {
            return new SelectionWrapper(
                "course_deg",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get home_port() {
            return new SelectionWrapper(
                "home_port",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        get image() {
            return new SelectionWrapper(
                "image",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get imo() {
            return new SelectionWrapper("imo", "Int", 0, {}, that, undefined);
        },
        missions: ShipMissionArraySelection.bind({
            collector: that,
            fieldName: "missions",
        }) as any,
        get mmsi() {
            return new SelectionWrapper("mmsi", "Int", 0, {}, that, undefined);
        },
        get model() {
            return new SelectionWrapper(
                "model",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        position: ShipLocationSelection.bind({
            collector: that,
            fieldName: "position",
        }) as any,
        get roles() {
            return new SelectionWrapper(
                "roles",
                "String",
                1,
                {},
                that,
                undefined,
            );
        },
        get speed_kn() {
            return new SelectionWrapper(
                "speed_kn",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get status() {
            return new SelectionWrapper(
                "status",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get successful_landings() {
            return new SelectionWrapper(
                "successful_landings",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get type() {
            return new SelectionWrapper(
                "type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get url() {
            return new SelectionWrapper(
                "url",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get weight_kg() {
            return new SelectionWrapper(
                "weight_kg",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get weight_lbs() {
            return new SelectionWrapper(
                "weight_lbs",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get year_built() {
            return new SelectionWrapper(
                "year_built",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeShipArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeShipArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeShipArraySelectionInput.bind(that)() as any,
                "Ship[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const ShipArraySelection = makeSLFN(
    makeShipArraySelectionInput,
    "ShipArraySelection",
    "Ship",
    1,
);

type ReturnTypeFromShipMissionArraySelectionRetTypes<AS_PROMISE = 0> = {
    flight: SelectionWrapperImpl<"flight", "String", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
};
type ReturnTypeFromShipMissionArraySelection = {
    flight: ReturnTypeFromShipMissionArraySelectionRetTypes["flight"];
    name: ReturnTypeFromShipMissionArraySelectionRetTypes["name"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipMissionArraySelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<ShipMission[]>,
        "ShipMission[]"
    >;
};

export function makeShipMissionArraySelectionInput(
    this: any,
): ReturnTypeFromShipMissionArraySelection {
    const that = this;
    return {
        get flight() {
            return new SelectionWrapper(
                "flight",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeShipMissionArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeShipMissionArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeShipMissionArraySelectionInput.bind(that)() as any,
                "ShipMission[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const ShipMissionArraySelection = makeSLFN(
    makeShipMissionArraySelectionInput,
    "ShipMissionArraySelection",
    "ShipMission",
    1,
);

type ReturnTypeFromShipLocationSelectionRetTypes<AS_PROMISE = 0> = {
    latitude: SelectionWrapperImpl<"latitude", "Float", 0, {}, undefined>;
    longitude: SelectionWrapperImpl<"longitude", "Float", 0, {}, undefined>;
};
type ReturnTypeFromShipLocationSelection = {
    latitude: ReturnTypeFromShipLocationSelectionRetTypes["latitude"];
    longitude: ReturnTypeFromShipLocationSelectionRetTypes["longitude"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipLocationSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<ShipLocation>, "ShipLocation">;
};

export function makeShipLocationSelectionInput(
    this: any,
): ReturnTypeFromShipLocationSelection {
    const that = this;
    return {
        get latitude() {
            return new SelectionWrapper(
                "latitude",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get longitude() {
            return new SelectionWrapper(
                "longitude",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeShipLocationSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeShipLocationSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeShipLocationSelectionInput.bind(that)() as any,
                "ShipLocation",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const ShipLocationSelection = makeSLFN(
    makeShipLocationSelectionInput,
    "ShipLocationSelection",
    "ShipLocation",
    0,
);

type ReturnTypeFromLaunchTelemetrySelectionRetTypes<AS_PROMISE = 0> = {
    flight_club: SelectionWrapperImpl<
        "flight_club",
        "String",
        0,
        {},
        undefined
    >;
};
type ReturnTypeFromLaunchTelemetrySelection = {
    flight_club: ReturnTypeFromLaunchTelemetrySelectionRetTypes["flight_club"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchTelemetrySelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<LaunchTelemetry>,
        "LaunchTelemetry"
    >;
};

export function makeLaunchTelemetrySelectionInput(
    this: any,
): ReturnTypeFromLaunchTelemetrySelection {
    const that = this;
    return {
        get flight_club() {
            return new SelectionWrapper(
                "flight_club",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchTelemetrySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchTelemetrySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLaunchTelemetrySelectionInput.bind(that)() as any,
                "LaunchTelemetry",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LaunchTelemetrySelection = makeSLFN(
    makeLaunchTelemetrySelectionInput,
    "LaunchTelemetrySelection",
    "LaunchTelemetry",
    0,
);

type ReturnTypeFromLinkSelectionRetTypes<AS_PROMISE = 0> = {
    article: SelectionWrapperImpl<"article", "String", 0, {}, undefined>;
    reddit: SelectionWrapperImpl<"reddit", "String", 0, {}, undefined>;
    wikipedia: SelectionWrapperImpl<"wikipedia", "String", 0, {}, undefined>;
};
type ReturnTypeFromLinkSelection = {
    article: ReturnTypeFromLinkSelectionRetTypes["article"];
    reddit: ReturnTypeFromLinkSelectionRetTypes["reddit"];
    wikipedia: ReturnTypeFromLinkSelectionRetTypes["wikipedia"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLinkSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Link>, "Link">;
};

export function makeLinkSelectionInput(this: any): ReturnTypeFromLinkSelection {
    const that = this;
    return {
        get article() {
            return new SelectionWrapper(
                "article",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get reddit() {
            return new SelectionWrapper(
                "reddit",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get wikipedia() {
            return new SelectionWrapper(
                "wikipedia",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLinkSelectionInput.bind(that)(),
            ) as SLWsFromSelection<ReturnType<typeof makeLinkSelectionInput>>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLinkSelectionInput.bind(that)() as any,
                "Link",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LinkSelection = makeSLFN(
    makeLinkSelectionInput,
    "LinkSelection",
    "Link",
    0,
);

type ReturnTypeFromHistoryArraySelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromHistoryArraySelection = {
    details: ReturnTypeFromHistoryArraySelectionRetTypes["details"];
    event_date_unix: ReturnTypeFromHistoryArraySelectionRetTypes["event_date_unix"];
    event_date_utc: ReturnTypeFromHistoryArraySelectionRetTypes["event_date_utc"];
    flight: ReturnTypeFromHistoryArraySelectionRetTypes["flight"];
    id: ReturnTypeFromHistoryArraySelectionRetTypes["id"];
    links: ReturnTypeFromHistoryArraySelectionRetTypes["links"];
    title: ReturnTypeFromHistoryArraySelectionRetTypes["title"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeHistoryArraySelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<History[]>, "History[]">;
};

export function makeHistoryArraySelectionInput(
    this: any,
): ReturnTypeFromHistoryArraySelection {
    const that = this;
    return {
        get details() {
            return new SelectionWrapper(
                "details",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get event_date_unix() {
            return new SelectionWrapper(
                "event_date_unix",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get event_date_utc() {
            return new SelectionWrapper(
                "event_date_utc",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        flight: LaunchSelection.bind({
            collector: that,
            fieldName: "flight",
        }) as any,
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        links: LinkSelection.bind({
            collector: that,
            fieldName: "links",
        }) as any,
        get title() {
            return new SelectionWrapper(
                "title",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeHistoryArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeHistoryArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeHistoryArraySelectionInput.bind(that)() as any,
                "History[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const HistoryArraySelection = makeSLFN(
    makeHistoryArraySelectionInput,
    "HistoryArraySelection",
    "History",
    1,
);

type ReturnTypeFromResultSelectionRetTypes<AS_PROMISE = 0> = {
    totalCount: SelectionWrapperImpl<"totalCount", "Int", 0, {}, undefined>;
};
type ReturnTypeFromResultSelection = {
    totalCount: ReturnTypeFromResultSelectionRetTypes["totalCount"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeResultSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Result>, "Result">;
};

export function makeResultSelectionInput(
    this: any,
): ReturnTypeFromResultSelection {
    const that = this;
    return {
        get totalCount() {
            return new SelectionWrapper(
                "totalCount",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeResultSelectionInput.bind(that)(),
            ) as SLWsFromSelection<ReturnType<typeof makeResultSelectionInput>>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeResultSelectionInput.bind(that)() as any,
                "Result",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const ResultSelection = makeSLFN(
    makeResultSelectionInput,
    "ResultSelection",
    "Result",
    0,
);

type ReturnTypeFromHistoriesResultSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromHistoriesResultSelection = {
    data: ReturnTypeFromHistoriesResultSelectionRetTypes["data"];
    result: ReturnTypeFromHistoriesResultSelectionRetTypes["result"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<HistoriesResult>,
        "HistoriesResult"
    >;
};

export function makeHistoriesResultSelectionInput(
    this: any,
): ReturnTypeFromHistoriesResultSelection {
    const that = this;
    return {
        data: HistoryArraySelection.bind({
            collector: that,
            fieldName: "data",
        }) as any,
        result: ResultSelection.bind({
            collector: that,
            fieldName: "result",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeHistoriesResultSelectionInput.bind(that)() as any,
                "HistoriesResult",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const HistoriesResultSelection = makeSLFN(
    makeHistoriesResultSelectionInput,
    "HistoriesResultSelection",
    "HistoriesResult",
    0,
);

type ReturnTypeFromHistorySelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromHistorySelection = {
    details: ReturnTypeFromHistorySelectionRetTypes["details"];
    event_date_unix: ReturnTypeFromHistorySelectionRetTypes["event_date_unix"];
    event_date_utc: ReturnTypeFromHistorySelectionRetTypes["event_date_utc"];
    flight: ReturnTypeFromHistorySelectionRetTypes["flight"];
    id: ReturnTypeFromHistorySelectionRetTypes["id"];
    links: ReturnTypeFromHistorySelectionRetTypes["links"];
    title: ReturnTypeFromHistorySelectionRetTypes["title"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeHistorySelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<History>, "History">;
};

export function makeHistorySelectionInput(
    this: any,
): ReturnTypeFromHistorySelection {
    const that = this;
    return {
        get details() {
            return new SelectionWrapper(
                "details",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get event_date_unix() {
            return new SelectionWrapper(
                "event_date_unix",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get event_date_utc() {
            return new SelectionWrapper(
                "event_date_utc",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        flight: LaunchSelection.bind({
            collector: that,
            fieldName: "flight",
        }) as any,
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        links: LinkSelection.bind({
            collector: that,
            fieldName: "links",
        }) as any,
        get title() {
            return new SelectionWrapper(
                "title",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeHistorySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeHistorySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeHistorySelectionInput.bind(that)() as any,
                "History",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const HistorySelection = makeSLFN(
    makeHistorySelectionInput,
    "HistorySelection",
    "History",
    0,
);

type ReturnTypeFromLocationSelectionRetTypes<AS_PROMISE = 0> = {
    latitude: SelectionWrapperImpl<"latitude", "Float", 0, {}, undefined>;
    longitude: SelectionWrapperImpl<"longitude", "Float", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    region: SelectionWrapperImpl<"region", "String", 0, {}, undefined>;
};
type ReturnTypeFromLocationSelection = {
    latitude: ReturnTypeFromLocationSelectionRetTypes["latitude"];
    longitude: ReturnTypeFromLocationSelectionRetTypes["longitude"];
    name: ReturnTypeFromLocationSelectionRetTypes["name"];
    region: ReturnTypeFromLocationSelectionRetTypes["region"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLocationSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Location>, "Location">;
};

export function makeLocationSelectionInput(
    this: any,
): ReturnTypeFromLocationSelection {
    const that = this;
    return {
        get latitude() {
            return new SelectionWrapper(
                "latitude",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get longitude() {
            return new SelectionWrapper(
                "longitude",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get region() {
            return new SelectionWrapper(
                "region",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLocationSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLocationSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLocationSelectionInput.bind(that)() as any,
                "Location",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LocationSelection = makeSLFN(
    makeLocationSelectionInput,
    "LocationSelection",
    "Location",
    0,
);

type ReturnTypeFromLandpadSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromLandpadSelection = {
    attempted_landings: ReturnTypeFromLandpadSelectionRetTypes["attempted_landings"];
    details: ReturnTypeFromLandpadSelectionRetTypes["details"];
    full_name: ReturnTypeFromLandpadSelectionRetTypes["full_name"];
    id: ReturnTypeFromLandpadSelectionRetTypes["id"];
    landing_type: ReturnTypeFromLandpadSelectionRetTypes["landing_type"];
    location: ReturnTypeFromLandpadSelectionRetTypes["location"];
    status: ReturnTypeFromLandpadSelectionRetTypes["status"];
    successful_landings: ReturnTypeFromLandpadSelectionRetTypes["successful_landings"];
    wikipedia: ReturnTypeFromLandpadSelectionRetTypes["wikipedia"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLandpadSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Landpad>, "Landpad">;
};

export function makeLandpadSelectionInput(
    this: any,
): ReturnTypeFromLandpadSelection {
    const that = this;
    return {
        get attempted_landings() {
            return new SelectionWrapper(
                "attempted_landings",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get details() {
            return new SelectionWrapper(
                "details",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get full_name() {
            return new SelectionWrapper(
                "full_name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        get landing_type() {
            return new SelectionWrapper(
                "landing_type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        location: LocationSelection.bind({
            collector: that,
            fieldName: "location",
        }) as any,
        get status() {
            return new SelectionWrapper(
                "status",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get successful_landings() {
            return new SelectionWrapper(
                "successful_landings",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get wikipedia() {
            return new SelectionWrapper(
                "wikipedia",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLandpadSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLandpadSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLandpadSelectionInput.bind(that)() as any,
                "Landpad",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LandpadSelection = makeSLFN(
    makeLandpadSelectionInput,
    "LandpadSelection",
    "Landpad",
    0,
);

type ReturnTypeFromLandpadArraySelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromLandpadArraySelection = {
    attempted_landings: ReturnTypeFromLandpadArraySelectionRetTypes["attempted_landings"];
    details: ReturnTypeFromLandpadArraySelectionRetTypes["details"];
    full_name: ReturnTypeFromLandpadArraySelectionRetTypes["full_name"];
    id: ReturnTypeFromLandpadArraySelectionRetTypes["id"];
    landing_type: ReturnTypeFromLandpadArraySelectionRetTypes["landing_type"];
    location: ReturnTypeFromLandpadArraySelectionRetTypes["location"];
    status: ReturnTypeFromLandpadArraySelectionRetTypes["status"];
    successful_landings: ReturnTypeFromLandpadArraySelectionRetTypes["successful_landings"];
    wikipedia: ReturnTypeFromLandpadArraySelectionRetTypes["wikipedia"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLandpadArraySelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Landpad[]>, "Landpad[]">;
};

export function makeLandpadArraySelectionInput(
    this: any,
): ReturnTypeFromLandpadArraySelection {
    const that = this;
    return {
        get attempted_landings() {
            return new SelectionWrapper(
                "attempted_landings",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get details() {
            return new SelectionWrapper(
                "details",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get full_name() {
            return new SelectionWrapper(
                "full_name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        get landing_type() {
            return new SelectionWrapper(
                "landing_type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        location: LocationSelection.bind({
            collector: that,
            fieldName: "location",
        }) as any,
        get status() {
            return new SelectionWrapper(
                "status",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get successful_landings() {
            return new SelectionWrapper(
                "successful_landings",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get wikipedia() {
            return new SelectionWrapper(
                "wikipedia",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLandpadArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLandpadArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLandpadArraySelectionInput.bind(that)() as any,
                "Landpad[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LandpadArraySelection = makeSLFN(
    makeLandpadArraySelectionInput,
    "LandpadArraySelection",
    "Landpad",
    1,
);

type ReturnTypeFromLaunchArraySelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromLaunchArraySelection = {
    details: ReturnTypeFromLaunchArraySelectionRetTypes["details"];
    id: ReturnTypeFromLaunchArraySelectionRetTypes["id"];
    is_tentative: ReturnTypeFromLaunchArraySelectionRetTypes["is_tentative"];
    launch_date_local: ReturnTypeFromLaunchArraySelectionRetTypes["launch_date_local"];
    launch_date_unix: ReturnTypeFromLaunchArraySelectionRetTypes["launch_date_unix"];
    launch_date_utc: ReturnTypeFromLaunchArraySelectionRetTypes["launch_date_utc"];
    launch_site: ReturnTypeFromLaunchArraySelectionRetTypes["launch_site"];
    launch_success: ReturnTypeFromLaunchArraySelectionRetTypes["launch_success"];
    launch_year: ReturnTypeFromLaunchArraySelectionRetTypes["launch_year"];
    links: ReturnTypeFromLaunchArraySelectionRetTypes["links"];
    mission_id: ReturnTypeFromLaunchArraySelectionRetTypes["mission_id"];
    mission_name: ReturnTypeFromLaunchArraySelectionRetTypes["mission_name"];
    rocket: ReturnTypeFromLaunchArraySelectionRetTypes["rocket"];
    ships: ReturnTypeFromLaunchArraySelectionRetTypes["ships"];
    static_fire_date_unix: ReturnTypeFromLaunchArraySelectionRetTypes["static_fire_date_unix"];
    static_fire_date_utc: ReturnTypeFromLaunchArraySelectionRetTypes["static_fire_date_utc"];
    telemetry: ReturnTypeFromLaunchArraySelectionRetTypes["telemetry"];
    tentative_max_precision: ReturnTypeFromLaunchArraySelectionRetTypes["tentative_max_precision"];
    upcoming: ReturnTypeFromLaunchArraySelectionRetTypes["upcoming"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchArraySelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Launch[]>, "Launch[]">;
};

export function makeLaunchArraySelectionInput(
    this: any,
): ReturnTypeFromLaunchArraySelection {
    const that = this;
    return {
        get details() {
            return new SelectionWrapper(
                "details",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        get is_tentative() {
            return new SelectionWrapper(
                "is_tentative",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get launch_date_local() {
            return new SelectionWrapper(
                "launch_date_local",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get launch_date_unix() {
            return new SelectionWrapper(
                "launch_date_unix",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get launch_date_utc() {
            return new SelectionWrapper(
                "launch_date_utc",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        launch_site: LaunchSiteSelection.bind({
            collector: that,
            fieldName: "launch_site",
        }) as any,
        get launch_success() {
            return new SelectionWrapper(
                "launch_success",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get launch_year() {
            return new SelectionWrapper(
                "launch_year",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        links: LaunchLinksSelection.bind({
            collector: that,
            fieldName: "links",
        }) as any,
        get mission_id() {
            return new SelectionWrapper(
                "mission_id",
                "String",
                1,
                {},
                that,
                undefined,
            );
        },
        get mission_name() {
            return new SelectionWrapper(
                "mission_name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        rocket: LaunchRocketSelection.bind({
            collector: that,
            fieldName: "rocket",
        }) as any,
        ships: ShipArraySelection.bind({
            collector: that,
            fieldName: "ships",
        }) as any,
        get static_fire_date_unix() {
            return new SelectionWrapper(
                "static_fire_date_unix",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get static_fire_date_utc() {
            return new SelectionWrapper(
                "static_fire_date_utc",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        telemetry: LaunchTelemetrySelection.bind({
            collector: that,
            fieldName: "telemetry",
        }) as any,
        get tentative_max_precision() {
            return new SelectionWrapper(
                "tentative_max_precision",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get upcoming() {
            return new SelectionWrapper(
                "upcoming",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLaunchArraySelectionInput.bind(that)() as any,
                "Launch[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LaunchArraySelection = makeSLFN(
    makeLaunchArraySelectionInput,
    "LaunchArraySelection",
    "Launch",
    1,
);

type ReturnTypeFromLaunchesPastResultSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromLaunchesPastResultSelection = {
    data: ReturnTypeFromLaunchesPastResultSelectionRetTypes["data"];
    result: ReturnTypeFromLaunchesPastResultSelectionRetTypes["result"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<LaunchesPastResult>,
        "LaunchesPastResult"
    >;
};

export function makeLaunchesPastResultSelectionInput(
    this: any,
): ReturnTypeFromLaunchesPastResultSelection {
    const that = this;
    return {
        data: LaunchArraySelection.bind({
            collector: that,
            fieldName: "data",
        }) as any,
        result: ResultSelection.bind({
            collector: that,
            fieldName: "result",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLaunchesPastResultSelectionInput.bind(that)() as any,
                "LaunchesPastResult",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LaunchesPastResultSelection = makeSLFN(
    makeLaunchesPastResultSelectionInput,
    "LaunchesPastResultSelection",
    "LaunchesPastResult",
    0,
);

type ReturnTypeFromRocketArraySelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromRocketArraySelection = {
    active: ReturnTypeFromRocketArraySelectionRetTypes["active"];
    boosters: ReturnTypeFromRocketArraySelectionRetTypes["boosters"];
    company: ReturnTypeFromRocketArraySelectionRetTypes["company"];
    cost_per_launch: ReturnTypeFromRocketArraySelectionRetTypes["cost_per_launch"];
    country: ReturnTypeFromRocketArraySelectionRetTypes["country"];
    description: ReturnTypeFromRocketArraySelectionRetTypes["description"];
    diameter: ReturnTypeFromRocketArraySelectionRetTypes["diameter"];
    engines: ReturnTypeFromRocketArraySelectionRetTypes["engines"];
    first_flight: ReturnTypeFromRocketArraySelectionRetTypes["first_flight"];
    first_stage: ReturnTypeFromRocketArraySelectionRetTypes["first_stage"];
    height: ReturnTypeFromRocketArraySelectionRetTypes["height"];
    id: ReturnTypeFromRocketArraySelectionRetTypes["id"];
    landing_legs: ReturnTypeFromRocketArraySelectionRetTypes["landing_legs"];
    mass: ReturnTypeFromRocketArraySelectionRetTypes["mass"];
    name: ReturnTypeFromRocketArraySelectionRetTypes["name"];
    payload_weights: ReturnTypeFromRocketArraySelectionRetTypes["payload_weights"];
    second_stage: ReturnTypeFromRocketArraySelectionRetTypes["second_stage"];
    stages: ReturnTypeFromRocketArraySelectionRetTypes["stages"];
    success_rate_pct: ReturnTypeFromRocketArraySelectionRetTypes["success_rate_pct"];
    type: ReturnTypeFromRocketArraySelectionRetTypes["type"];
    wikipedia: ReturnTypeFromRocketArraySelectionRetTypes["wikipedia"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketArraySelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Rocket[]>, "Rocket[]">;
};

export function makeRocketArraySelectionInput(
    this: any,
): ReturnTypeFromRocketArraySelection {
    const that = this;
    return {
        get active() {
            return new SelectionWrapper(
                "active",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get boosters() {
            return new SelectionWrapper(
                "boosters",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get company() {
            return new SelectionWrapper(
                "company",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get cost_per_launch() {
            return new SelectionWrapper(
                "cost_per_launch",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get country() {
            return new SelectionWrapper(
                "country",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get description() {
            return new SelectionWrapper(
                "description",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        diameter: DistanceSelection.bind({
            collector: that,
            fieldName: "diameter",
        }) as any,
        engines: RocketEnginesSelection.bind({
            collector: that,
            fieldName: "engines",
        }) as any,
        get first_flight() {
            return new SelectionWrapper(
                "first_flight",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        first_stage: RocketFirstStageSelection.bind({
            collector: that,
            fieldName: "first_stage",
        }) as any,
        height: DistanceSelection.bind({
            collector: that,
            fieldName: "height",
        }) as any,
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        landing_legs: RocketLandingLegsSelection.bind({
            collector: that,
            fieldName: "landing_legs",
        }) as any,
        mass: MassSelection.bind({ collector: that, fieldName: "mass" }) as any,
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        payload_weights: RocketPayloadWeightArraySelection.bind({
            collector: that,
            fieldName: "payload_weights",
        }) as any,
        second_stage: RocketSecondStageSelection.bind({
            collector: that,
            fieldName: "second_stage",
        }) as any,
        get stages() {
            return new SelectionWrapper(
                "stages",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get success_rate_pct() {
            return new SelectionWrapper(
                "success_rate_pct",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get type() {
            return new SelectionWrapper(
                "type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get wikipedia() {
            return new SelectionWrapper(
                "wikipedia",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeRocketArraySelectionInput.bind(that)() as any,
                "Rocket[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const RocketArraySelection = makeSLFN(
    makeRocketArraySelectionInput,
    "RocketArraySelection",
    "Rocket",
    1,
);

type ReturnTypeFromLaunchpadSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromLaunchpadSelection = {
    attempted_launches: ReturnTypeFromLaunchpadSelectionRetTypes["attempted_launches"];
    details: ReturnTypeFromLaunchpadSelectionRetTypes["details"];
    id: ReturnTypeFromLaunchpadSelectionRetTypes["id"];
    location: ReturnTypeFromLaunchpadSelectionRetTypes["location"];
    name: ReturnTypeFromLaunchpadSelectionRetTypes["name"];
    status: ReturnTypeFromLaunchpadSelectionRetTypes["status"];
    successful_launches: ReturnTypeFromLaunchpadSelectionRetTypes["successful_launches"];
    vehicles_launched: ReturnTypeFromLaunchpadSelectionRetTypes["vehicles_launched"];
    wikipedia: ReturnTypeFromLaunchpadSelectionRetTypes["wikipedia"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchpadSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Launchpad>, "Launchpad">;
};

export function makeLaunchpadSelectionInput(
    this: any,
): ReturnTypeFromLaunchpadSelection {
    const that = this;
    return {
        get attempted_launches() {
            return new SelectionWrapper(
                "attempted_launches",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get details() {
            return new SelectionWrapper(
                "details",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        location: LocationSelection.bind({
            collector: that,
            fieldName: "location",
        }) as any,
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get status() {
            return new SelectionWrapper(
                "status",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get successful_launches() {
            return new SelectionWrapper(
                "successful_launches",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        vehicles_launched: RocketArraySelection.bind({
            collector: that,
            fieldName: "vehicles_launched",
        }) as any,
        get wikipedia() {
            return new SelectionWrapper(
                "wikipedia",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchpadSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchpadSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLaunchpadSelectionInput.bind(that)() as any,
                "Launchpad",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LaunchpadSelection = makeSLFN(
    makeLaunchpadSelectionInput,
    "LaunchpadSelection",
    "Launchpad",
    0,
);

type ReturnTypeFromLaunchpadArraySelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromLaunchpadArraySelection = {
    attempted_launches: ReturnTypeFromLaunchpadArraySelectionRetTypes["attempted_launches"];
    details: ReturnTypeFromLaunchpadArraySelectionRetTypes["details"];
    id: ReturnTypeFromLaunchpadArraySelectionRetTypes["id"];
    location: ReturnTypeFromLaunchpadArraySelectionRetTypes["location"];
    name: ReturnTypeFromLaunchpadArraySelectionRetTypes["name"];
    status: ReturnTypeFromLaunchpadArraySelectionRetTypes["status"];
    successful_launches: ReturnTypeFromLaunchpadArraySelectionRetTypes["successful_launches"];
    vehicles_launched: ReturnTypeFromLaunchpadArraySelectionRetTypes["vehicles_launched"];
    wikipedia: ReturnTypeFromLaunchpadArraySelectionRetTypes["wikipedia"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchpadArraySelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Launchpad[]>, "Launchpad[]">;
};

export function makeLaunchpadArraySelectionInput(
    this: any,
): ReturnTypeFromLaunchpadArraySelection {
    const that = this;
    return {
        get attempted_launches() {
            return new SelectionWrapper(
                "attempted_launches",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get details() {
            return new SelectionWrapper(
                "details",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        location: LocationSelection.bind({
            collector: that,
            fieldName: "location",
        }) as any,
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get status() {
            return new SelectionWrapper(
                "status",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get successful_launches() {
            return new SelectionWrapper(
                "successful_launches",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        vehicles_launched: RocketArraySelection.bind({
            collector: that,
            fieldName: "vehicles_launched",
        }) as any,
        get wikipedia() {
            return new SelectionWrapper(
                "wikipedia",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchpadArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchpadArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLaunchpadArraySelectionInput.bind(that)() as any,
                "Launchpad[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LaunchpadArraySelection = makeSLFN(
    makeLaunchpadArraySelectionInput,
    "LaunchpadArraySelection",
    "Launchpad",
    1,
);

type ReturnTypeFromMissionSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromMissionSelection = {
    description: ReturnTypeFromMissionSelectionRetTypes["description"];
    id: ReturnTypeFromMissionSelectionRetTypes["id"];
    manufacturers: ReturnTypeFromMissionSelectionRetTypes["manufacturers"];
    name: ReturnTypeFromMissionSelectionRetTypes["name"];
    payloads: ReturnTypeFromMissionSelectionRetTypes["payloads"];
    twitter: ReturnTypeFromMissionSelectionRetTypes["twitter"];
    website: ReturnTypeFromMissionSelectionRetTypes["website"];
    wikipedia: ReturnTypeFromMissionSelectionRetTypes["wikipedia"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeMissionSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Mission>, "Mission">;
};

export function makeMissionSelectionInput(
    this: any,
): ReturnTypeFromMissionSelection {
    const that = this;
    return {
        get description() {
            return new SelectionWrapper(
                "description",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        get manufacturers() {
            return new SelectionWrapper(
                "manufacturers",
                "String",
                1,
                {},
                that,
                undefined,
            );
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        payloads: PayloadArraySelection.bind({
            collector: that,
            fieldName: "payloads",
        }) as any,
        get twitter() {
            return new SelectionWrapper(
                "twitter",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get website() {
            return new SelectionWrapper(
                "website",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get wikipedia() {
            return new SelectionWrapper(
                "wikipedia",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeMissionSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeMissionSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeMissionSelectionInput.bind(that)() as any,
                "Mission",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const MissionSelection = makeSLFN(
    makeMissionSelectionInput,
    "MissionSelection",
    "Mission",
    0,
);

type ReturnTypeFromMissionArraySelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromMissionArraySelection = {
    description: ReturnTypeFromMissionArraySelectionRetTypes["description"];
    id: ReturnTypeFromMissionArraySelectionRetTypes["id"];
    manufacturers: ReturnTypeFromMissionArraySelectionRetTypes["manufacturers"];
    name: ReturnTypeFromMissionArraySelectionRetTypes["name"];
    payloads: ReturnTypeFromMissionArraySelectionRetTypes["payloads"];
    twitter: ReturnTypeFromMissionArraySelectionRetTypes["twitter"];
    website: ReturnTypeFromMissionArraySelectionRetTypes["website"];
    wikipedia: ReturnTypeFromMissionArraySelectionRetTypes["wikipedia"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeMissionArraySelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Mission[]>, "Mission[]">;
};

export function makeMissionArraySelectionInput(
    this: any,
): ReturnTypeFromMissionArraySelection {
    const that = this;
    return {
        get description() {
            return new SelectionWrapper(
                "description",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        get manufacturers() {
            return new SelectionWrapper(
                "manufacturers",
                "String",
                1,
                {},
                that,
                undefined,
            );
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        payloads: PayloadArraySelection.bind({
            collector: that,
            fieldName: "payloads",
        }) as any,
        get twitter() {
            return new SelectionWrapper(
                "twitter",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get website() {
            return new SelectionWrapper(
                "website",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get wikipedia() {
            return new SelectionWrapper(
                "wikipedia",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeMissionArraySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeMissionArraySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeMissionArraySelectionInput.bind(that)() as any,
                "Mission[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const MissionArraySelection = makeSLFN(
    makeMissionArraySelectionInput,
    "MissionArraySelection",
    "Mission",
    1,
);

type ReturnTypeFromMissionResultSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromMissionResultSelection = {
    data: ReturnTypeFromMissionResultSelectionRetTypes["data"];
    result: ReturnTypeFromMissionResultSelectionRetTypes["result"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<MissionResult>,
        "MissionResult"
    >;
};

export function makeMissionResultSelectionInput(
    this: any,
): ReturnTypeFromMissionResultSelection {
    const that = this;
    return {
        data: MissionArraySelection.bind({
            collector: that,
            fieldName: "data",
        }) as any,
        result: ResultSelection.bind({
            collector: that,
            fieldName: "result",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeMissionResultSelectionInput.bind(that)() as any,
                "MissionResult",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const MissionResultSelection = makeSLFN(
    makeMissionResultSelectionInput,
    "MissionResultSelection",
    "MissionResult",
    0,
);

type ReturnTypeFromPayloadSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromPayloadSelection = {
    customers: ReturnTypeFromPayloadSelectionRetTypes["customers"];
    id: ReturnTypeFromPayloadSelectionRetTypes["id"];
    manufacturer: ReturnTypeFromPayloadSelectionRetTypes["manufacturer"];
    nationality: ReturnTypeFromPayloadSelectionRetTypes["nationality"];
    norad_id: ReturnTypeFromPayloadSelectionRetTypes["norad_id"];
    orbit: ReturnTypeFromPayloadSelectionRetTypes["orbit"];
    orbit_params: ReturnTypeFromPayloadSelectionRetTypes["orbit_params"];
    payload_mass_kg: ReturnTypeFromPayloadSelectionRetTypes["payload_mass_kg"];
    payload_mass_lbs: ReturnTypeFromPayloadSelectionRetTypes["payload_mass_lbs"];
    payload_type: ReturnTypeFromPayloadSelectionRetTypes["payload_type"];
    reused: ReturnTypeFromPayloadSelectionRetTypes["reused"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makePayloadSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Payload>, "Payload">;
};

export function makePayloadSelectionInput(
    this: any,
): ReturnTypeFromPayloadSelection {
    const that = this;
    return {
        get customers() {
            return new SelectionWrapper(
                "customers",
                "String",
                1,
                {},
                that,
                undefined,
            );
        },
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        get manufacturer() {
            return new SelectionWrapper(
                "manufacturer",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get nationality() {
            return new SelectionWrapper(
                "nationality",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get norad_id() {
            return new SelectionWrapper(
                "norad_id",
                "Int",
                1,
                {},
                that,
                undefined,
            );
        },
        get orbit() {
            return new SelectionWrapper(
                "orbit",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        orbit_params: PayloadOrbitParamsSelection.bind({
            collector: that,
            fieldName: "orbit_params",
        }) as any,
        get payload_mass_kg() {
            return new SelectionWrapper(
                "payload_mass_kg",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get payload_mass_lbs() {
            return new SelectionWrapper(
                "payload_mass_lbs",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get payload_type() {
            return new SelectionWrapper(
                "payload_type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get reused() {
            return new SelectionWrapper(
                "reused",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makePayloadSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makePayloadSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makePayloadSelectionInput.bind(that)() as any,
                "Payload",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const PayloadSelection = makeSLFN(
    makePayloadSelectionInput,
    "PayloadSelection",
    "Payload",
    0,
);

type ReturnTypeFromRoadsterSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromRoadsterSelection = {
    apoapsis_au: ReturnTypeFromRoadsterSelectionRetTypes["apoapsis_au"];
    details: ReturnTypeFromRoadsterSelectionRetTypes["details"];
    earth_distance_km: ReturnTypeFromRoadsterSelectionRetTypes["earth_distance_km"];
    earth_distance_mi: ReturnTypeFromRoadsterSelectionRetTypes["earth_distance_mi"];
    eccentricity: ReturnTypeFromRoadsterSelectionRetTypes["eccentricity"];
    epoch_jd: ReturnTypeFromRoadsterSelectionRetTypes["epoch_jd"];
    inclination: ReturnTypeFromRoadsterSelectionRetTypes["inclination"];
    launch_date_unix: ReturnTypeFromRoadsterSelectionRetTypes["launch_date_unix"];
    launch_date_utc: ReturnTypeFromRoadsterSelectionRetTypes["launch_date_utc"];
    launch_mass_kg: ReturnTypeFromRoadsterSelectionRetTypes["launch_mass_kg"];
    launch_mass_lbs: ReturnTypeFromRoadsterSelectionRetTypes["launch_mass_lbs"];
    longitude: ReturnTypeFromRoadsterSelectionRetTypes["longitude"];
    mars_distance_km: ReturnTypeFromRoadsterSelectionRetTypes["mars_distance_km"];
    mars_distance_mi: ReturnTypeFromRoadsterSelectionRetTypes["mars_distance_mi"];
    name: ReturnTypeFromRoadsterSelectionRetTypes["name"];
    norad_id: ReturnTypeFromRoadsterSelectionRetTypes["norad_id"];
    orbit_type: ReturnTypeFromRoadsterSelectionRetTypes["orbit_type"];
    periapsis_arg: ReturnTypeFromRoadsterSelectionRetTypes["periapsis_arg"];
    periapsis_au: ReturnTypeFromRoadsterSelectionRetTypes["periapsis_au"];
    period_days: ReturnTypeFromRoadsterSelectionRetTypes["period_days"];
    semi_major_axis_au: ReturnTypeFromRoadsterSelectionRetTypes["semi_major_axis_au"];
    speed_kph: ReturnTypeFromRoadsterSelectionRetTypes["speed_kph"];
    speed_mph: ReturnTypeFromRoadsterSelectionRetTypes["speed_mph"];
    wikipedia: ReturnTypeFromRoadsterSelectionRetTypes["wikipedia"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRoadsterSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Roadster>, "Roadster">;
};

export function makeRoadsterSelectionInput(
    this: any,
): ReturnTypeFromRoadsterSelection {
    const that = this;
    return {
        get apoapsis_au() {
            return new SelectionWrapper(
                "apoapsis_au",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get details() {
            return new SelectionWrapper(
                "details",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get earth_distance_km() {
            return new SelectionWrapper(
                "earth_distance_km",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get earth_distance_mi() {
            return new SelectionWrapper(
                "earth_distance_mi",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get eccentricity() {
            return new SelectionWrapper(
                "eccentricity",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get epoch_jd() {
            return new SelectionWrapper(
                "epoch_jd",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get inclination() {
            return new SelectionWrapper(
                "inclination",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get launch_date_unix() {
            return new SelectionWrapper(
                "launch_date_unix",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get launch_date_utc() {
            return new SelectionWrapper(
                "launch_date_utc",
                "Date",
                0,
                {},
                that,
                undefined,
            );
        },
        get launch_mass_kg() {
            return new SelectionWrapper(
                "launch_mass_kg",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get launch_mass_lbs() {
            return new SelectionWrapper(
                "launch_mass_lbs",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get longitude() {
            return new SelectionWrapper(
                "longitude",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get mars_distance_km() {
            return new SelectionWrapper(
                "mars_distance_km",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get mars_distance_mi() {
            return new SelectionWrapper(
                "mars_distance_mi",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get norad_id() {
            return new SelectionWrapper(
                "norad_id",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get orbit_type() {
            return new SelectionWrapper(
                "orbit_type",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get periapsis_arg() {
            return new SelectionWrapper(
                "periapsis_arg",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get periapsis_au() {
            return new SelectionWrapper(
                "periapsis_au",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get period_days() {
            return new SelectionWrapper(
                "period_days",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get semi_major_axis_au() {
            return new SelectionWrapper(
                "semi_major_axis_au",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get speed_kph() {
            return new SelectionWrapper(
                "speed_kph",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get speed_mph() {
            return new SelectionWrapper(
                "speed_mph",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get wikipedia() {
            return new SelectionWrapper(
                "wikipedia",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRoadsterSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRoadsterSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeRoadsterSelectionInput.bind(that)() as any,
                "Roadster",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const RoadsterSelection = makeSLFN(
    makeRoadsterSelectionInput,
    "RoadsterSelection",
    "Roadster",
    0,
);

type ReturnTypeFromRocketsResultSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromRocketsResultSelection = {
    data: ReturnTypeFromRocketsResultSelectionRetTypes["data"];
    result: ReturnTypeFromRocketsResultSelectionRetTypes["result"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<RocketsResult>,
        "RocketsResult"
    >;
};

export function makeRocketsResultSelectionInput(
    this: any,
): ReturnTypeFromRocketsResultSelection {
    const that = this;
    return {
        data: RocketArraySelection.bind({
            collector: that,
            fieldName: "data",
        }) as any,
        result: ResultSelection.bind({
            collector: that,
            fieldName: "result",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeRocketsResultSelectionInput.bind(that)() as any,
                "RocketsResult",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const RocketsResultSelection = makeSLFN(
    makeRocketsResultSelectionInput,
    "RocketsResultSelection",
    "RocketsResult",
    0,
);

type ReturnTypeFromShipSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromShipSelection = {
    abs: ReturnTypeFromShipSelectionRetTypes["abs"];
    active: ReturnTypeFromShipSelectionRetTypes["active"];
    attempted_landings: ReturnTypeFromShipSelectionRetTypes["attempted_landings"];
    class: ReturnTypeFromShipSelectionRetTypes["class"];
    course_deg: ReturnTypeFromShipSelectionRetTypes["course_deg"];
    home_port: ReturnTypeFromShipSelectionRetTypes["home_port"];
    id: ReturnTypeFromShipSelectionRetTypes["id"];
    image: ReturnTypeFromShipSelectionRetTypes["image"];
    imo: ReturnTypeFromShipSelectionRetTypes["imo"];
    missions: ReturnTypeFromShipSelectionRetTypes["missions"];
    mmsi: ReturnTypeFromShipSelectionRetTypes["mmsi"];
    model: ReturnTypeFromShipSelectionRetTypes["model"];
    name: ReturnTypeFromShipSelectionRetTypes["name"];
    position: ReturnTypeFromShipSelectionRetTypes["position"];
    roles: ReturnTypeFromShipSelectionRetTypes["roles"];
    speed_kn: ReturnTypeFromShipSelectionRetTypes["speed_kn"];
    status: ReturnTypeFromShipSelectionRetTypes["status"];
    successful_landings: ReturnTypeFromShipSelectionRetTypes["successful_landings"];
    type: ReturnTypeFromShipSelectionRetTypes["type"];
    url: ReturnTypeFromShipSelectionRetTypes["url"];
    weight_kg: ReturnTypeFromShipSelectionRetTypes["weight_kg"];
    weight_lbs: ReturnTypeFromShipSelectionRetTypes["weight_lbs"];
    year_built: ReturnTypeFromShipSelectionRetTypes["year_built"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Ship>, "Ship">;
};

export function makeShipSelectionInput(this: any): ReturnTypeFromShipSelection {
    const that = this;
    return {
        get abs() {
            return new SelectionWrapper("abs", "Int", 0, {}, that, undefined);
        },
        get active() {
            return new SelectionWrapper(
                "active",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get attempted_landings() {
            return new SelectionWrapper(
                "attempted_landings",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get class() {
            return new SelectionWrapper("class", "Int", 0, {}, that, undefined);
        },
        get course_deg() {
            return new SelectionWrapper(
                "course_deg",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get home_port() {
            return new SelectionWrapper(
                "home_port",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get id() {
            return new SelectionWrapper("id", "ID", 0, {}, that, undefined);
        },
        get image() {
            return new SelectionWrapper(
                "image",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get imo() {
            return new SelectionWrapper("imo", "Int", 0, {}, that, undefined);
        },
        missions: ShipMissionArraySelection.bind({
            collector: that,
            fieldName: "missions",
        }) as any,
        get mmsi() {
            return new SelectionWrapper("mmsi", "Int", 0, {}, that, undefined);
        },
        get model() {
            return new SelectionWrapper(
                "model",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        position: ShipLocationSelection.bind({
            collector: that,
            fieldName: "position",
        }) as any,
        get roles() {
            return new SelectionWrapper(
                "roles",
                "String",
                1,
                {},
                that,
                undefined,
            );
        },
        get speed_kn() {
            return new SelectionWrapper(
                "speed_kn",
                "Float",
                0,
                {},
                that,
                undefined,
            );
        },
        get status() {
            return new SelectionWrapper(
                "status",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get successful_landings() {
            return new SelectionWrapper(
                "successful_landings",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get type() {
            return new SelectionWrapper(
                "type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get url() {
            return new SelectionWrapper(
                "url",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get weight_kg() {
            return new SelectionWrapper(
                "weight_kg",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get weight_lbs() {
            return new SelectionWrapper(
                "weight_lbs",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get year_built() {
            return new SelectionWrapper(
                "year_built",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeShipSelectionInput.bind(that)(),
            ) as SLWsFromSelection<ReturnType<typeof makeShipSelectionInput>>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeShipSelectionInput.bind(that)() as any,
                "Ship",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const ShipSelection = makeSLFN(
    makeShipSelectionInput,
    "ShipSelection",
    "Ship",
    0,
);

type ReturnTypeFromShipsResultSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromShipsResultSelection = {
    data: ReturnTypeFromShipsResultSelectionRetTypes["data"];
    result: ReturnTypeFromShipsResultSelectionRetTypes["result"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $all: selectAllFunc<AllNonFuncFieldsFromType<ShipsResult>, "ShipsResult">;
};

export function makeShipsResultSelectionInput(
    this: any,
): ReturnTypeFromShipsResultSelection {
    const that = this;
    return {
        data: ShipArraySelection.bind({
            collector: that,
            fieldName: "data",
        }) as any,
        result: ResultSelection.bind({
            collector: that,
            fieldName: "result",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeShipsResultSelectionInput.bind(that)() as any,
                "ShipsResult",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const ShipsResultSelection = makeSLFN(
    makeShipsResultSelectionInput,
    "ShipsResultSelection",
    "ShipsResult",
    0,
);

type ReturnTypeFromusersNotNullArrayNotNullSelectionRetTypes<AS_PROMISE = 0> = {
    id: SelectionWrapperImpl<"id", "uuid!", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    rocket: SelectionWrapperImpl<"rocket", "String", 0, {}, undefined>;
    timestamp: SelectionWrapperImpl<
        "timestamp",
        "timestamptz!",
        0,
        {},
        undefined
    >;
    twitter: SelectionWrapperImpl<"twitter", "String", 0, {}, undefined>;
};
type ReturnTypeFromusersNotNullArrayNotNullSelection = {
    id: ReturnTypeFromusersNotNullArrayNotNullSelectionRetTypes["id"];
    name: ReturnTypeFromusersNotNullArrayNotNullSelectionRetTypes["name"];
    rocket: ReturnTypeFromusersNotNullArrayNotNullSelectionRetTypes["rocket"];
    timestamp: ReturnTypeFromusersNotNullArrayNotNullSelectionRetTypes["timestamp"];
    twitter: ReturnTypeFromusersNotNullArrayNotNullSelectionRetTypes["twitter"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<users[]>, "users[]">;
};

export function makeusersNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromusersNotNullArrayNotNullSelection {
    const that = this;
    return {
        get id() {
            return new SelectionWrapper("id", "uuid!", 0, {}, that, undefined);
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get rocket() {
            return new SelectionWrapper(
                "rocket",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get timestamp() {
            return new SelectionWrapper(
                "timestamp",
                "timestamptz!",
                0,
                {},
                that,
                undefined,
            );
        },
        get twitter() {
            return new SelectionWrapper(
                "twitter",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeusersNotNullArrayNotNullSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeusersNotNullArrayNotNullSelectionInput.bind(that)() as any,
                "users[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const usersNotNullArrayNotNullSelection = makeSLFN(
    makeusersNotNullArrayNotNullSelectionInput,
    "usersNotNullArrayNotNullSelection",
    "users",
    1,
);

type ReturnTypeFromusers_aggregate_fieldsSelectionRetTypes<AS_PROMISE = 0> = {
    count: SelectionWrapperImpl<
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
};
type ReturnTypeFromusers_aggregate_fieldsSelection = {
    count: (
        args: users_aggregate_fieldsCountArgs,
    ) => ReturnTypeFromusers_aggregate_fieldsSelectionRetTypes["count"];
    max: ReturnTypeFromusers_aggregate_fieldsSelectionRetTypes["max"];
    min: ReturnTypeFromusers_aggregate_fieldsSelectionRetTypes["min"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusers_aggregate_fieldsSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<users_aggregate_fields>,
        "users_aggregate_fields"
    >;
};

export function makeusers_aggregate_fieldsSelectionInput(
    this: any,
): ReturnTypeFromusers_aggregate_fieldsSelection {
    const that = this;
    return {
        get count() {
            return (args: users_aggregate_fieldsCountArgs) =>
                new SelectionWrapper(
                    "count",
                    "Int",
                    0,
                    {},
                    that,
                    undefined,
                    args,
                    users_aggregate_fieldsCountArgsMeta,
                );
        },
        max: users_max_fieldsSelection.bind({
            collector: that,
            fieldName: "max",
        }) as any,
        min: users_min_fieldsSelection.bind({
            collector: that,
            fieldName: "min",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeusers_aggregate_fieldsSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusers_aggregate_fieldsSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeusers_aggregate_fieldsSelectionInput.bind(that)() as any,
                "users_aggregate_fields",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const users_aggregate_fieldsSelection = makeSLFN(
    makeusers_aggregate_fieldsSelectionInput,
    "users_aggregate_fieldsSelection",
    "users_aggregate_fields",
    0,
);

type ReturnTypeFromusers_max_fieldsSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromusers_max_fieldsSelection = {
    name: ReturnTypeFromusers_max_fieldsSelectionRetTypes["name"];
    rocket: ReturnTypeFromusers_max_fieldsSelectionRetTypes["rocket"];
    timestamp: ReturnTypeFromusers_max_fieldsSelectionRetTypes["timestamp"];
    twitter: ReturnTypeFromusers_max_fieldsSelectionRetTypes["twitter"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusers_max_fieldsSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<users_max_fields>,
        "users_max_fields"
    >;
};

export function makeusers_max_fieldsSelectionInput(
    this: any,
): ReturnTypeFromusers_max_fieldsSelection {
    const that = this;
    return {
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get rocket() {
            return new SelectionWrapper(
                "rocket",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get timestamp() {
            return new SelectionWrapper(
                "timestamp",
                "timestamptz",
                0,
                {},
                that,
                undefined,
            );
        },
        get twitter() {
            return new SelectionWrapper(
                "twitter",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeusers_max_fieldsSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusers_max_fieldsSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeusers_max_fieldsSelectionInput.bind(that)() as any,
                "users_max_fields",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const users_max_fieldsSelection = makeSLFN(
    makeusers_max_fieldsSelectionInput,
    "users_max_fieldsSelection",
    "users_max_fields",
    0,
);

type ReturnTypeFromusers_min_fieldsSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromusers_min_fieldsSelection = {
    name: ReturnTypeFromusers_min_fieldsSelectionRetTypes["name"];
    rocket: ReturnTypeFromusers_min_fieldsSelectionRetTypes["rocket"];
    timestamp: ReturnTypeFromusers_min_fieldsSelectionRetTypes["timestamp"];
    twitter: ReturnTypeFromusers_min_fieldsSelectionRetTypes["twitter"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusers_min_fieldsSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<users_min_fields>,
        "users_min_fields"
    >;
};

export function makeusers_min_fieldsSelectionInput(
    this: any,
): ReturnTypeFromusers_min_fieldsSelection {
    const that = this;
    return {
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get rocket() {
            return new SelectionWrapper(
                "rocket",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get timestamp() {
            return new SelectionWrapper(
                "timestamp",
                "timestamptz",
                0,
                {},
                that,
                undefined,
            );
        },
        get twitter() {
            return new SelectionWrapper(
                "twitter",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeusers_min_fieldsSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusers_min_fieldsSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeusers_min_fieldsSelectionInput.bind(that)() as any,
                "users_min_fields",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const users_min_fieldsSelection = makeSLFN(
    makeusers_min_fieldsSelectionInput,
    "users_min_fieldsSelection",
    "users_min_fields",
    0,
);

type ReturnTypeFromusers_aggregateNotNullSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromusers_aggregateNotNullSelection = {
    aggregate: ReturnTypeFromusers_aggregateNotNullSelectionRetTypes["aggregate"];
    nodes: ReturnTypeFromusers_aggregateNotNullSelectionRetTypes["nodes"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<users_aggregate>,
        "users_aggregate"
    >;
};

export function makeusers_aggregateNotNullSelectionInput(
    this: any,
): ReturnTypeFromusers_aggregateNotNullSelection {
    const that = this;
    return {
        aggregate: users_aggregate_fieldsSelection.bind({
            collector: that,
            fieldName: "aggregate",
        }) as any,
        nodes: usersNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "nodes",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeusers_aggregateNotNullSelectionInput.bind(that)() as any,
                "users_aggregate",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const users_aggregateNotNullSelection = makeSLFN(
    makeusers_aggregateNotNullSelectionInput,
    "users_aggregateNotNullSelection",
    "users_aggregate",
    0,
);

type ReturnTypeFromusersSelectionRetTypes<AS_PROMISE = 0> = {
    id: SelectionWrapperImpl<"id", "uuid!", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
    rocket: SelectionWrapperImpl<"rocket", "String", 0, {}, undefined>;
    timestamp: SelectionWrapperImpl<
        "timestamp",
        "timestamptz!",
        0,
        {},
        undefined
    >;
    twitter: SelectionWrapperImpl<"twitter", "String", 0, {}, undefined>;
};
type ReturnTypeFromusersSelection = {
    id: ReturnTypeFromusersSelectionRetTypes["id"];
    name: ReturnTypeFromusersSelectionRetTypes["name"];
    rocket: ReturnTypeFromusersSelectionRetTypes["rocket"];
    timestamp: ReturnTypeFromusersSelectionRetTypes["timestamp"];
    twitter: ReturnTypeFromusersSelectionRetTypes["twitter"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusersSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<users>, "users">;
};

export function makeusersSelectionInput(
    this: any,
): ReturnTypeFromusersSelection {
    const that = this;
    return {
        get id() {
            return new SelectionWrapper("id", "uuid!", 0, {}, that, undefined);
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get rocket() {
            return new SelectionWrapper(
                "rocket",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get timestamp() {
            return new SelectionWrapper(
                "timestamp",
                "timestamptz!",
                0,
                {},
                that,
                undefined,
            );
        },
        get twitter() {
            return new SelectionWrapper(
                "twitter",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeusersSelectionInput.bind(that)(),
            ) as SLWsFromSelection<ReturnType<typeof makeusersSelectionInput>>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeusersSelectionInput.bind(that)() as any,
                "users",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const usersSelection = makeSLFN(
    makeusersSelectionInput,
    "usersSelection",
    "users",
    0,
);

type ReturnTypeFrom_ServiceNotNullSelectionRetTypes<AS_PROMISE = 0> = {
    sdl: SelectionWrapperImpl<"sdl", "String", 0, {}, undefined>;
};
type ReturnTypeFrom_ServiceNotNullSelection = {
    sdl: ReturnTypeFrom_ServiceNotNullSelectionRetTypes["sdl"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof make_ServiceNotNullSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<_Service>, "_Service">;
};

export function make_ServiceNotNullSelectionInput(
    this: any,
): ReturnTypeFrom_ServiceNotNullSelection {
    const that = this;
    return {
        get sdl() {
            return new SelectionWrapper(
                "sdl",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                make_ServiceNotNullSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof make_ServiceNotNullSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                make_ServiceNotNullSelectionInput.bind(that)() as any,
                "_Service",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const _ServiceNotNullSelection = makeSLFN(
    make_ServiceNotNullSelectionInput,
    "_ServiceNotNullSelection",
    "_Service",
    0,
);

type ReturnTypeFromusers_mutation_responseSelectionRetTypes<AS_PROMISE = 0> = {
    affected_rows: SelectionWrapperImpl<
        "affected_rows",
        "Int!",
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
};
type ReturnTypeFromusers_mutation_responseSelection = {
    affected_rows: ReturnTypeFromusers_mutation_responseSelectionRetTypes["affected_rows"];
    returning: ReturnTypeFromusers_mutation_responseSelectionRetTypes["returning"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeusers_mutation_responseSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<users_mutation_response>,
        "users_mutation_response"
    >;
};

export function makeusers_mutation_responseSelectionInput(
    this: any,
): ReturnTypeFromusers_mutation_responseSelection {
    const that = this;
    return {
        get affected_rows() {
            return new SelectionWrapper(
                "affected_rows",
                "Int!",
                0,
                {},
                that,
                undefined,
            );
        },
        returning: usersNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "returning",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeusers_mutation_responseSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeusers_mutation_responseSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeusers_mutation_responseSelectionInput.bind(that)() as any,
                "users_mutation_response",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const users_mutation_responseSelection = makeSLFN(
    makeusers_mutation_responseSelectionInput,
    "users_mutation_responseSelection",
    "users_mutation_response",
    0,
);

type ReturnTypeFromCapsuleMissionSelectionRetTypes<AS_PROMISE = 0> = {
    flight: SelectionWrapperImpl<"flight", "Int", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
};
type ReturnTypeFromCapsuleMissionSelection = {
    flight: ReturnTypeFromCapsuleMissionSelectionRetTypes["flight"];
    name: ReturnTypeFromCapsuleMissionSelectionRetTypes["name"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCapsuleMissionSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<CapsuleMission>,
        "CapsuleMission"
    >;
};

export function makeCapsuleMissionSelectionInput(
    this: any,
): ReturnTypeFromCapsuleMissionSelection {
    const that = this;
    return {
        get flight() {
            return new SelectionWrapper(
                "flight",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeCapsuleMissionSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCapsuleMissionSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeCapsuleMissionSelectionInput.bind(that)() as any,
                "CapsuleMission",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const CapsuleMissionSelection = makeSLFN(
    makeCapsuleMissionSelectionInput,
    "CapsuleMissionSelection",
    "CapsuleMission",
    0,
);

type ReturnTypeFromCoreMissionSelectionRetTypes<AS_PROMISE = 0> = {
    flight: SelectionWrapperImpl<"flight", "Int", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
};
type ReturnTypeFromCoreMissionSelection = {
    flight: ReturnTypeFromCoreMissionSelectionRetTypes["flight"];
    name: ReturnTypeFromCoreMissionSelectionRetTypes["name"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCoreMissionSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<CoreMission>, "CoreMission">;
};

export function makeCoreMissionSelectionInput(
    this: any,
): ReturnTypeFromCoreMissionSelection {
    const that = this;
    return {
        get flight() {
            return new SelectionWrapper(
                "flight",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeCoreMissionSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCoreMissionSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeCoreMissionSelectionInput.bind(that)() as any,
                "CoreMission",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const CoreMissionSelection = makeSLFN(
    makeCoreMissionSelectionInput,
    "CoreMissionSelection",
    "CoreMission",
    0,
);

type ReturnTypeFromDragonThrustSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromDragonThrustSelection = {
    amount: ReturnTypeFromDragonThrustSelectionRetTypes["amount"];
    fuel_1: ReturnTypeFromDragonThrustSelectionRetTypes["fuel_1"];
    fuel_2: ReturnTypeFromDragonThrustSelectionRetTypes["fuel_2"];
    pods: ReturnTypeFromDragonThrustSelectionRetTypes["pods"];
    thrust: ReturnTypeFromDragonThrustSelectionRetTypes["thrust"];
    type: ReturnTypeFromDragonThrustSelectionRetTypes["type"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeDragonThrustSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<DragonThrust>, "DragonThrust">;
};

export function makeDragonThrustSelectionInput(
    this: any,
): ReturnTypeFromDragonThrustSelection {
    const that = this;
    return {
        get amount() {
            return new SelectionWrapper(
                "amount",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get fuel_1() {
            return new SelectionWrapper(
                "fuel_1",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get fuel_2() {
            return new SelectionWrapper(
                "fuel_2",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get pods() {
            return new SelectionWrapper("pods", "Int", 0, {}, that, undefined);
        },
        thrust: ForceSelection.bind({
            collector: that,
            fieldName: "thrust",
        }) as any,
        get type() {
            return new SelectionWrapper(
                "type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeDragonThrustSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeDragonThrustSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeDragonThrustSelectionInput.bind(that)() as any,
                "DragonThrust",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const DragonThrustSelection = makeSLFN(
    makeDragonThrustSelectionInput,
    "DragonThrustSelection",
    "DragonThrust",
    0,
);

type ReturnTypeFromLaunchRocketFirstStageCoreSelectionRetTypes<AS_PROMISE = 0> =
    {
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
    };
type ReturnTypeFromLaunchRocketFirstStageCoreSelection = {
    block: ReturnTypeFromLaunchRocketFirstStageCoreSelectionRetTypes["block"];
    core: ReturnTypeFromLaunchRocketFirstStageCoreSelectionRetTypes["core"];
    flight: ReturnTypeFromLaunchRocketFirstStageCoreSelectionRetTypes["flight"];
    gridfins: ReturnTypeFromLaunchRocketFirstStageCoreSelectionRetTypes["gridfins"];
    land_success: ReturnTypeFromLaunchRocketFirstStageCoreSelectionRetTypes["land_success"];
    landing_intent: ReturnTypeFromLaunchRocketFirstStageCoreSelectionRetTypes["landing_intent"];
    landing_type: ReturnTypeFromLaunchRocketFirstStageCoreSelectionRetTypes["landing_type"];
    landing_vehicle: ReturnTypeFromLaunchRocketFirstStageCoreSelectionRetTypes["landing_vehicle"];
    legs: ReturnTypeFromLaunchRocketFirstStageCoreSelectionRetTypes["legs"];
    reused: ReturnTypeFromLaunchRocketFirstStageCoreSelectionRetTypes["reused"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLaunchRocketFirstStageCoreSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<LaunchRocketFirstStageCore>,
        "LaunchRocketFirstStageCore"
    >;
};

export function makeLaunchRocketFirstStageCoreSelectionInput(
    this: any,
): ReturnTypeFromLaunchRocketFirstStageCoreSelection {
    const that = this;
    return {
        get block() {
            return new SelectionWrapper("block", "Int", 0, {}, that, undefined);
        },
        core: CoreSelection.bind({ collector: that, fieldName: "core" }) as any,
        get flight() {
            return new SelectionWrapper(
                "flight",
                "Int",
                0,
                {},
                that,
                undefined,
            );
        },
        get gridfins() {
            return new SelectionWrapper(
                "gridfins",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get land_success() {
            return new SelectionWrapper(
                "land_success",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get landing_intent() {
            return new SelectionWrapper(
                "landing_intent",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get landing_type() {
            return new SelectionWrapper(
                "landing_type",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get landing_vehicle() {
            return new SelectionWrapper(
                "landing_vehicle",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get legs() {
            return new SelectionWrapper(
                "legs",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },
        get reused() {
            return new SelectionWrapper(
                "reused",
                "Boolean",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeLaunchRocketFirstStageCoreSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLaunchRocketFirstStageCoreSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLaunchRocketFirstStageCoreSelectionInput.bind(
                    that,
                )() as any,
                "LaunchRocketFirstStageCore",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LaunchRocketFirstStageCoreSelection = makeSLFN(
    makeLaunchRocketFirstStageCoreSelectionInput,
    "LaunchRocketFirstStageCoreSelection",
    "LaunchRocketFirstStageCore",
    0,
);

type ReturnTypeFromMutationSelectionRetTypes<AS_PROMISE = 0> = {
    delete_users: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_mutation_responseSelectionInput>,
            "users_mutation_responseSelection",
            "users_mutation_response",
            0,
            {
                $lazy: (args: MutationDelete_usersArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    insert_users: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_mutation_responseSelectionInput>,
            "users_mutation_responseSelection",
            "users_mutation_response",
            0,
            {
                $lazy: (args: MutationInsert_usersArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    update_users: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_mutation_responseSelectionInput>,
            "users_mutation_responseSelection",
            "users_mutation_response",
            0,
            {
                $lazy: (args: MutationUpdate_usersArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
};
type ReturnTypeFromMutationSelection = {
    delete_users: (
        args: MutationDelete_usersArgs,
    ) => ReturnTypeFromMutationSelectionRetTypes["delete_users"];
    insert_users: (
        args: MutationInsert_usersArgs,
    ) => ReturnTypeFromMutationSelectionRetTypes["insert_users"];
    update_users: (
        args: MutationUpdate_usersArgs,
    ) => ReturnTypeFromMutationSelectionRetTypes["update_users"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Mutation>, "Mutation">;
};

export function makeMutationSelectionInput(
    this: any,
): ReturnTypeFromMutationSelection {
    const that = this;
    return {
        delete_users: (args: MutationDelete_usersArgs) =>
            users_mutation_responseSelection.bind({
                collector: that,
                fieldName: "delete_users",
                args,
                argsMeta: MutationDelete_usersArgsMeta,
            }) as any,
        insert_users: (args: MutationInsert_usersArgs) =>
            users_mutation_responseSelection.bind({
                collector: that,
                fieldName: "insert_users",
                args,
                argsMeta: MutationInsert_usersArgsMeta,
            }) as any,
        update_users: (args: MutationUpdate_usersArgs) =>
            users_mutation_responseSelection.bind({
                collector: that,
                fieldName: "update_users",
                args,
                argsMeta: MutationUpdate_usersArgsMeta,
            }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeMutationSelectionInput.bind(that)() as any,
                "Mutation",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const MutationSelection = makeSLFN(
    makeMutationSelectionInput,
    "MutationSelection",
    "Mutation",
    0,
);

type ReturnTypeFromQuerySelectionRetTypes<AS_PROMISE = 0> = {
    capsule: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleSelectionInput>,
            "CapsuleSelection",
            "Capsule",
            0,
            {
                $lazy: (args: QueryCapsuleArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    capsules: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleArraySelectionInput>,
            "CapsuleArraySelection",
            "Capsule",
            1,
            {
                $lazy: (args: QueryCapsulesArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    capsulesPast: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleArraySelectionInput>,
            "CapsuleArraySelection",
            "Capsule",
            1,
            {
                $lazy: (args: QueryCapsulesPastArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    capsulesUpcoming: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCapsuleArraySelectionInput>,
            "CapsuleArraySelection",
            "Capsule",
            1,
            {
                $lazy: (args: QueryCapsulesUpcomingArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
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
            "$lazy",
            AS_PROMISE
        >
    >;
    core: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreSelectionInput>,
            "CoreSelection",
            "Core",
            0,
            {
                $lazy: (args: QueryCoreArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    cores: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreArraySelectionInput>,
            "CoreArraySelection",
            "Core",
            1,
            {
                $lazy: (args: QueryCoresArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    coresPast: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreArraySelectionInput>,
            "CoreArraySelection",
            "Core",
            1,
            {
                $lazy: (args: QueryCoresPastArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    coresUpcoming: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCoreArraySelectionInput>,
            "CoreArraySelection",
            "Core",
            1,
            {
                $lazy: (args: QueryCoresUpcomingArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    dragon: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonSelectionInput>,
            "DragonSelection",
            "Dragon",
            0,
            {
                $lazy: (args: QueryDragonArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    dragons: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeDragonArraySelectionInput>,
            "DragonArraySelection",
            "Dragon",
            1,
            {
                $lazy: (args: QueryDragonsArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    histories: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeHistoryArraySelectionInput>,
            "HistoryArraySelection",
            "History",
            1,
            {
                $lazy: (args: QueryHistoriesArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    historiesResult: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeHistoriesResultSelectionInput>,
            "HistoriesResultSelection",
            "HistoriesResult",
            0,
            {
                $lazy: (args: QueryHistoriesResultArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    history: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeHistorySelectionInput>,
            "HistorySelection",
            "History",
            0,
            {
                $lazy: (args: QueryHistoryArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    landpad: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLandpadSelectionInput>,
            "LandpadSelection",
            "Landpad",
            0,
            {
                $lazy: (args: QueryLandpadArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    landpads: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLandpadArraySelectionInput>,
            "LandpadArraySelection",
            "Landpad",
            1,
            {
                $lazy: (args: QueryLandpadsArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    launch: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSelectionInput>,
            "LaunchSelection",
            "Launch",
            0,
            {
                $lazy: (args: QueryLaunchArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    launchLatest: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSelectionInput>,
            "LaunchSelection",
            "Launch",
            0,
            {
                $lazy: (args: QueryLaunchLatestArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    launchNext: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchSelectionInput>,
            "LaunchSelection",
            "Launch",
            0,
            {
                $lazy: (args: QueryLaunchNextArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    launches: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchArraySelectionInput>,
            "LaunchArraySelection",
            "Launch",
            1,
            {
                $lazy: (args: QueryLaunchesArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    launchesPast: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchArraySelectionInput>,
            "LaunchArraySelection",
            "Launch",
            1,
            {
                $lazy: (args: QueryLaunchesPastArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    launchesPastResult: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchesPastResultSelectionInput>,
            "LaunchesPastResultSelection",
            "LaunchesPastResult",
            0,
            {
                $lazy: (args: QueryLaunchesPastResultArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    launchesUpcoming: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchArraySelectionInput>,
            "LaunchArraySelection",
            "Launch",
            1,
            {
                $lazy: (args: QueryLaunchesUpcomingArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    launchpad: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchpadSelectionInput>,
            "LaunchpadSelection",
            "Launchpad",
            0,
            {
                $lazy: (args: QueryLaunchpadArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    launchpads: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLaunchpadArraySelectionInput>,
            "LaunchpadArraySelection",
            "Launchpad",
            1,
            {
                $lazy: (args: QueryLaunchpadsArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    mission: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMissionSelectionInput>,
            "MissionSelection",
            "Mission",
            0,
            {
                $lazy: (args: QueryMissionArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    missions: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMissionArraySelectionInput>,
            "MissionArraySelection",
            "Mission",
            1,
            {
                $lazy: (args: QueryMissionsArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    missionsResult: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeMissionResultSelectionInput>,
            "MissionResultSelection",
            "MissionResult",
            0,
            {
                $lazy: (args: QueryMissionsResultArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    payload: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadSelectionInput>,
            "PayloadSelection",
            "Payload",
            0,
            {
                $lazy: (args: QueryPayloadArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    payloads: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makePayloadArraySelectionInput>,
            "PayloadArraySelection",
            "Payload",
            1,
            {
                $lazy: (args: QueryPayloadsArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
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
            "$lazy",
            AS_PROMISE
        >
    >;
    rocket: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketSelectionInput>,
            "RocketSelection",
            "Rocket",
            0,
            {
                $lazy: (args: QueryRocketArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    rockets: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketArraySelectionInput>,
            "RocketArraySelection",
            "Rocket",
            1,
            {
                $lazy: (args: QueryRocketsArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    rocketsResult: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeRocketsResultSelectionInput>,
            "RocketsResultSelection",
            "RocketsResult",
            0,
            {
                $lazy: (args: QueryRocketsResultArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    ship: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipSelectionInput>,
            "ShipSelection",
            "Ship",
            0,
            {
                $lazy: (args: QueryShipArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    ships: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipArraySelectionInput>,
            "ShipArraySelection",
            "Ship",
            1,
            {
                $lazy: (args: QueryShipsArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    shipsResult: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeShipsResultSelectionInput>,
            "ShipsResultSelection",
            "ShipsResult",
            0,
            {
                $lazy: (args: QueryShipsResultArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    users: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>,
            "usersNotNullArrayNotNullSelection",
            "users",
            1,
            {
                $lazy: (args: QueryUsersArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    users_aggregate: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_aggregateNotNullSelectionInput>,
            "users_aggregateNotNullSelection",
            "users_aggregate",
            0,
            {
                $lazy: (args: QueryUsers_aggregateArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    users_by_pk: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersSelectionInput>,
            "usersSelection",
            "users",
            0,
            {
                $lazy: (args: QueryUsers_by_pkArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
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
            "$lazy",
            AS_PROMISE
        >
    >;
};
type ReturnTypeFromQuerySelection = {
    capsule: (
        args: QueryCapsuleArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["capsule"];
    capsules: (
        args: QueryCapsulesArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["capsules"];
    capsulesPast: (
        args: QueryCapsulesPastArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["capsulesPast"];
    capsulesUpcoming: (
        args: QueryCapsulesUpcomingArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["capsulesUpcoming"];
    company: ReturnTypeFromQuerySelectionRetTypes["company"];
    core: (args: QueryCoreArgs) => ReturnTypeFromQuerySelectionRetTypes["core"];
    cores: (
        args: QueryCoresArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["cores"];
    coresPast: (
        args: QueryCoresPastArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["coresPast"];
    coresUpcoming: (
        args: QueryCoresUpcomingArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["coresUpcoming"];
    dragon: (
        args: QueryDragonArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["dragon"];
    dragons: (
        args: QueryDragonsArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["dragons"];
    histories: (
        args: QueryHistoriesArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["histories"];
    historiesResult: (
        args: QueryHistoriesResultArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["historiesResult"];
    history: (
        args: QueryHistoryArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["history"];
    landpad: (
        args: QueryLandpadArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["landpad"];
    landpads: (
        args: QueryLandpadsArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["landpads"];
    launch: (
        args: QueryLaunchArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["launch"];
    launchLatest: (
        args: QueryLaunchLatestArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["launchLatest"];
    launchNext: (
        args: QueryLaunchNextArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["launchNext"];
    launches: (
        args: QueryLaunchesArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["launches"];
    launchesPast: (
        args: QueryLaunchesPastArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["launchesPast"];
    launchesPastResult: (
        args: QueryLaunchesPastResultArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["launchesPastResult"];
    launchesUpcoming: (
        args: QueryLaunchesUpcomingArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["launchesUpcoming"];
    launchpad: (
        args: QueryLaunchpadArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["launchpad"];
    launchpads: (
        args: QueryLaunchpadsArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["launchpads"];
    mission: (
        args: QueryMissionArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["mission"];
    missions: (
        args: QueryMissionsArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["missions"];
    missionsResult: (
        args: QueryMissionsResultArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["missionsResult"];
    payload: (
        args: QueryPayloadArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["payload"];
    payloads: (
        args: QueryPayloadsArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["payloads"];
    roadster: ReturnTypeFromQuerySelectionRetTypes["roadster"];
    rocket: (
        args: QueryRocketArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["rocket"];
    rockets: (
        args: QueryRocketsArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["rockets"];
    rocketsResult: (
        args: QueryRocketsResultArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["rocketsResult"];
    ship: (args: QueryShipArgs) => ReturnTypeFromQuerySelectionRetTypes["ship"];
    ships: (
        args: QueryShipsArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["ships"];
    shipsResult: (
        args: QueryShipsResultArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["shipsResult"];
    users: (
        args: QueryUsersArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["users"];
    users_aggregate: (
        args: QueryUsers_aggregateArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["users_aggregate"];
    users_by_pk: (
        args: QueryUsers_by_pkArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["users_by_pk"];
    _service: ReturnTypeFromQuerySelectionRetTypes["_service"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Query>, "Query">;
};

export function makeQuerySelectionInput(
    this: any,
): ReturnTypeFromQuerySelection {
    const that = this;
    return {
        capsule: (args: QueryCapsuleArgs) =>
            CapsuleSelection.bind({
                collector: that,
                fieldName: "capsule",
                args,
                argsMeta: QueryCapsuleArgsMeta,
            }) as any,
        capsules: (args: QueryCapsulesArgs) =>
            CapsuleArraySelection.bind({
                collector: that,
                fieldName: "capsules",
                args,
                argsMeta: QueryCapsulesArgsMeta,
            }) as any,
        capsulesPast: (args: QueryCapsulesPastArgs) =>
            CapsuleArraySelection.bind({
                collector: that,
                fieldName: "capsulesPast",
                args,
                argsMeta: QueryCapsulesPastArgsMeta,
            }) as any,
        capsulesUpcoming: (args: QueryCapsulesUpcomingArgs) =>
            CapsuleArraySelection.bind({
                collector: that,
                fieldName: "capsulesUpcoming",
                args,
                argsMeta: QueryCapsulesUpcomingArgsMeta,
            }) as any,
        company: InfoSelection.bind({
            collector: that,
            fieldName: "company",
        }) as any,
        core: (args: QueryCoreArgs) =>
            CoreSelection.bind({
                collector: that,
                fieldName: "core",
                args,
                argsMeta: QueryCoreArgsMeta,
            }) as any,
        cores: (args: QueryCoresArgs) =>
            CoreArraySelection.bind({
                collector: that,
                fieldName: "cores",
                args,
                argsMeta: QueryCoresArgsMeta,
            }) as any,
        coresPast: (args: QueryCoresPastArgs) =>
            CoreArraySelection.bind({
                collector: that,
                fieldName: "coresPast",
                args,
                argsMeta: QueryCoresPastArgsMeta,
            }) as any,
        coresUpcoming: (args: QueryCoresUpcomingArgs) =>
            CoreArraySelection.bind({
                collector: that,
                fieldName: "coresUpcoming",
                args,
                argsMeta: QueryCoresUpcomingArgsMeta,
            }) as any,
        dragon: (args: QueryDragonArgs) =>
            DragonSelection.bind({
                collector: that,
                fieldName: "dragon",
                args,
                argsMeta: QueryDragonArgsMeta,
            }) as any,
        dragons: (args: QueryDragonsArgs) =>
            DragonArraySelection.bind({
                collector: that,
                fieldName: "dragons",
                args,
                argsMeta: QueryDragonsArgsMeta,
            }) as any,
        histories: (args: QueryHistoriesArgs) =>
            HistoryArraySelection.bind({
                collector: that,
                fieldName: "histories",
                args,
                argsMeta: QueryHistoriesArgsMeta,
            }) as any,
        historiesResult: (args: QueryHistoriesResultArgs) =>
            HistoriesResultSelection.bind({
                collector: that,
                fieldName: "historiesResult",
                args,
                argsMeta: QueryHistoriesResultArgsMeta,
            }) as any,
        history: (args: QueryHistoryArgs) =>
            HistorySelection.bind({
                collector: that,
                fieldName: "history",
                args,
                argsMeta: QueryHistoryArgsMeta,
            }) as any,
        landpad: (args: QueryLandpadArgs) =>
            LandpadSelection.bind({
                collector: that,
                fieldName: "landpad",
                args,
                argsMeta: QueryLandpadArgsMeta,
            }) as any,
        landpads: (args: QueryLandpadsArgs) =>
            LandpadArraySelection.bind({
                collector: that,
                fieldName: "landpads",
                args,
                argsMeta: QueryLandpadsArgsMeta,
            }) as any,
        launch: (args: QueryLaunchArgs) =>
            LaunchSelection.bind({
                collector: that,
                fieldName: "launch",
                args,
                argsMeta: QueryLaunchArgsMeta,
            }) as any,
        launchLatest: (args: QueryLaunchLatestArgs) =>
            LaunchSelection.bind({
                collector: that,
                fieldName: "launchLatest",
                args,
                argsMeta: QueryLaunchLatestArgsMeta,
            }) as any,
        launchNext: (args: QueryLaunchNextArgs) =>
            LaunchSelection.bind({
                collector: that,
                fieldName: "launchNext",
                args,
                argsMeta: QueryLaunchNextArgsMeta,
            }) as any,
        launches: (args: QueryLaunchesArgs) =>
            LaunchArraySelection.bind({
                collector: that,
                fieldName: "launches",
                args,
                argsMeta: QueryLaunchesArgsMeta,
            }) as any,
        launchesPast: (args: QueryLaunchesPastArgs) =>
            LaunchArraySelection.bind({
                collector: that,
                fieldName: "launchesPast",
                args,
                argsMeta: QueryLaunchesPastArgsMeta,
            }) as any,
        launchesPastResult: (args: QueryLaunchesPastResultArgs) =>
            LaunchesPastResultSelection.bind({
                collector: that,
                fieldName: "launchesPastResult",
                args,
                argsMeta: QueryLaunchesPastResultArgsMeta,
            }) as any,
        launchesUpcoming: (args: QueryLaunchesUpcomingArgs) =>
            LaunchArraySelection.bind({
                collector: that,
                fieldName: "launchesUpcoming",
                args,
                argsMeta: QueryLaunchesUpcomingArgsMeta,
            }) as any,
        launchpad: (args: QueryLaunchpadArgs) =>
            LaunchpadSelection.bind({
                collector: that,
                fieldName: "launchpad",
                args,
                argsMeta: QueryLaunchpadArgsMeta,
            }) as any,
        launchpads: (args: QueryLaunchpadsArgs) =>
            LaunchpadArraySelection.bind({
                collector: that,
                fieldName: "launchpads",
                args,
                argsMeta: QueryLaunchpadsArgsMeta,
            }) as any,
        mission: (args: QueryMissionArgs) =>
            MissionSelection.bind({
                collector: that,
                fieldName: "mission",
                args,
                argsMeta: QueryMissionArgsMeta,
            }) as any,
        missions: (args: QueryMissionsArgs) =>
            MissionArraySelection.bind({
                collector: that,
                fieldName: "missions",
                args,
                argsMeta: QueryMissionsArgsMeta,
            }) as any,
        missionsResult: (args: QueryMissionsResultArgs) =>
            MissionResultSelection.bind({
                collector: that,
                fieldName: "missionsResult",
                args,
                argsMeta: QueryMissionsResultArgsMeta,
            }) as any,
        payload: (args: QueryPayloadArgs) =>
            PayloadSelection.bind({
                collector: that,
                fieldName: "payload",
                args,
                argsMeta: QueryPayloadArgsMeta,
            }) as any,
        payloads: (args: QueryPayloadsArgs) =>
            PayloadArraySelection.bind({
                collector: that,
                fieldName: "payloads",
                args,
                argsMeta: QueryPayloadsArgsMeta,
            }) as any,
        roadster: RoadsterSelection.bind({
            collector: that,
            fieldName: "roadster",
        }) as any,
        rocket: (args: QueryRocketArgs) =>
            RocketSelection.bind({
                collector: that,
                fieldName: "rocket",
                args,
                argsMeta: QueryRocketArgsMeta,
            }) as any,
        rockets: (args: QueryRocketsArgs) =>
            RocketArraySelection.bind({
                collector: that,
                fieldName: "rockets",
                args,
                argsMeta: QueryRocketsArgsMeta,
            }) as any,
        rocketsResult: (args: QueryRocketsResultArgs) =>
            RocketsResultSelection.bind({
                collector: that,
                fieldName: "rocketsResult",
                args,
                argsMeta: QueryRocketsResultArgsMeta,
            }) as any,
        ship: (args: QueryShipArgs) =>
            ShipSelection.bind({
                collector: that,
                fieldName: "ship",
                args,
                argsMeta: QueryShipArgsMeta,
            }) as any,
        ships: (args: QueryShipsArgs) =>
            ShipArraySelection.bind({
                collector: that,
                fieldName: "ships",
                args,
                argsMeta: QueryShipsArgsMeta,
            }) as any,
        shipsResult: (args: QueryShipsResultArgs) =>
            ShipsResultSelection.bind({
                collector: that,
                fieldName: "shipsResult",
                args,
                argsMeta: QueryShipsResultArgsMeta,
            }) as any,
        users: (args: QueryUsersArgs) =>
            usersNotNullArrayNotNullSelection.bind({
                collector: that,
                fieldName: "users",
                args,
                argsMeta: QueryUsersArgsMeta,
            }) as any,
        users_aggregate: (args: QueryUsers_aggregateArgs) =>
            users_aggregateNotNullSelection.bind({
                collector: that,
                fieldName: "users_aggregate",
                args,
                argsMeta: QueryUsers_aggregateArgsMeta,
            }) as any,
        users_by_pk: (args: QueryUsers_by_pkArgs) =>
            usersSelection.bind({
                collector: that,
                fieldName: "users_by_pk",
                args,
                argsMeta: QueryUsers_by_pkArgsMeta,
            }) as any,
        _service: _ServiceNotNullSelection.bind({
            collector: that,
            fieldName: "_service",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeQuerySelectionInput.bind(that)() as any,
                "Query",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const QuerySelection = makeSLFN(
    makeQuerySelectionInput,
    "QuerySelection",
    "Query",
    0,
);

type ReturnTypeFromRocketPayloadWeightSelectionRetTypes<AS_PROMISE = 0> = {
    id: SelectionWrapperImpl<"id", "String", 0, {}, undefined>;
    kg: SelectionWrapperImpl<"kg", "Int", 0, {}, undefined>;
    lb: SelectionWrapperImpl<"lb", "Int", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
};
type ReturnTypeFromRocketPayloadWeightSelection = {
    id: ReturnTypeFromRocketPayloadWeightSelectionRetTypes["id"];
    kg: ReturnTypeFromRocketPayloadWeightSelectionRetTypes["kg"];
    lb: ReturnTypeFromRocketPayloadWeightSelectionRetTypes["lb"];
    name: ReturnTypeFromRocketPayloadWeightSelectionRetTypes["name"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeRocketPayloadWeightSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<RocketPayloadWeight>,
        "RocketPayloadWeight"
    >;
};

export function makeRocketPayloadWeightSelectionInput(
    this: any,
): ReturnTypeFromRocketPayloadWeightSelection {
    const that = this;
    return {
        get id() {
            return new SelectionWrapper("id", "String", 0, {}, that, undefined);
        },
        get kg() {
            return new SelectionWrapper("kg", "Int", 0, {}, that, undefined);
        },
        get lb() {
            return new SelectionWrapper("lb", "Int", 0, {}, that, undefined);
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeRocketPayloadWeightSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeRocketPayloadWeightSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeRocketPayloadWeightSelectionInput.bind(that)() as any,
                "RocketPayloadWeight",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const RocketPayloadWeightSelection = makeSLFN(
    makeRocketPayloadWeightSelectionInput,
    "RocketPayloadWeightSelection",
    "RocketPayloadWeight",
    0,
);

type ReturnTypeFromShipMissionSelectionRetTypes<AS_PROMISE = 0> = {
    flight: SelectionWrapperImpl<"flight", "String", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String", 0, {}, undefined>;
};
type ReturnTypeFromShipMissionSelection = {
    flight: ReturnTypeFromShipMissionSelectionRetTypes["flight"];
    name: ReturnTypeFromShipMissionSelectionRetTypes["name"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeShipMissionSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<ShipMission>, "ShipMission">;
};

export function makeShipMissionSelectionInput(
    this: any,
): ReturnTypeFromShipMissionSelection {
    const that = this;
    return {
        get flight() {
            return new SelectionWrapper(
                "flight",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get name() {
            return new SelectionWrapper(
                "name",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                makeShipMissionSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeShipMissionSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeShipMissionSelectionInput.bind(that)() as any,
                "ShipMission",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const ShipMissionSelection = makeSLFN(
    makeShipMissionSelectionInput,
    "ShipMissionSelection",
    "ShipMission",
    0,
);

type ReturnTypeFromSubscriptionSelectionRetTypes<AS_PROMISE = 0> = {
    users: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersNotNullArrayNotNullSelectionInput>,
            "usersNotNullArrayNotNullSelection",
            "users",
            1,
            {
                $lazy: (args: SubscriptionUsersArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE,
            1
        >
    >;
    users_aggregate: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusers_aggregateNotNullSelectionInput>,
            "users_aggregateNotNullSelection",
            "users_aggregate",
            0,
            {
                $lazy: (args: SubscriptionUsers_aggregateArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE,
            1
        >
    >;
    users_by_pk: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeusersSelectionInput>,
            "usersSelection",
            "users",
            0,
            {
                $lazy: (args: SubscriptionUsers_by_pkArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE,
            1
        >
    >;
};
type ReturnTypeFromSubscriptionSelection = {
    users: (
        args: SubscriptionUsersArgs,
    ) => ReturnTypeFromSubscriptionSelectionRetTypes["users"];
    users_aggregate: (
        args: SubscriptionUsers_aggregateArgs,
    ) => ReturnTypeFromSubscriptionSelectionRetTypes["users_aggregate"];
    users_by_pk: (
        args: SubscriptionUsers_by_pkArgs,
    ) => ReturnTypeFromSubscriptionSelectionRetTypes["users_by_pk"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Subscription>, "Subscription">;
};

export function makeSubscriptionSelectionInput(
    this: any,
): ReturnTypeFromSubscriptionSelection {
    const that = this;
    return {
        users: (args: SubscriptionUsersArgs) =>
            usersNotNullArrayNotNullSelection.bind({
                collector: that,
                fieldName: "users",
                args,
                argsMeta: SubscriptionUsersArgsMeta,
            }) as any,
        users_aggregate: (args: SubscriptionUsers_aggregateArgs) =>
            users_aggregateNotNullSelection.bind({
                collector: that,
                fieldName: "users_aggregate",
                args,
                argsMeta: SubscriptionUsers_aggregateArgsMeta,
            }) as any,
        users_by_pk: (args: SubscriptionUsers_by_pkArgs) =>
            usersSelection.bind({
                collector: that,
                fieldName: "users_by_pk",
                args,
                argsMeta: SubscriptionUsers_by_pkArgsMeta,
            }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeSubscriptionSelectionInput.bind(that)() as any,
                "Subscription",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const SubscriptionSelection = makeSLFN(
    makeSubscriptionSelectionInput,
    "SubscriptionSelection",
    "Subscription",
    0,
);

type ReturnTypeFromusers_aggregateSelectionRetTypes<AS_PROMISE = 0> = {
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
};
type ReturnTypeFromusers_aggregateSelection = {
    aggregate: ReturnTypeFromusers_aggregateSelectionRetTypes["aggregate"];
    nodes: ReturnTypeFromusers_aggregateSelectionRetTypes["nodes"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<users_aggregate>,
        "users_aggregate"
    >;
};

export function makeusers_aggregateSelectionInput(
    this: any,
): ReturnTypeFromusers_aggregateSelection {
    const that = this;
    return {
        aggregate: users_aggregate_fieldsSelection.bind({
            collector: that,
            fieldName: "aggregate",
        }) as any,
        nodes: usersNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "nodes",
        }) as any,

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeusers_aggregateSelectionInput.bind(that)() as any,
                "users_aggregate",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const users_aggregateSelection = makeSLFN(
    makeusers_aggregateSelectionInput,
    "users_aggregateSelection",
    "users_aggregate",
    0,
);

type ReturnTypeFrom_ServiceSelectionRetTypes<AS_PROMISE = 0> = {
    sdl: SelectionWrapperImpl<"sdl", "String", 0, {}, undefined>;
};
type ReturnTypeFrom_ServiceSelection = {
    sdl: ReturnTypeFrom_ServiceSelectionRetTypes["sdl"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof make_ServiceSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<_Service>, "_Service">;
};

export function make_ServiceSelectionInput(
    this: any,
): ReturnTypeFrom_ServiceSelection {
    const that = this;
    return {
        get sdl() {
            return new SelectionWrapper(
                "sdl",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },

        $fragment: <F extends (this: any, ...args: any[]) => any>(f: F) =>
            f.bind({
                collector: that,
                fieldName: "",
                isFragment: f.name,
            }) as (
                ...args: ArgumentsTypeFromFragment<F>
            ) => ReturnTypeFromFragment<F>,

        $scalars: () =>
            selectScalars(
                make_ServiceSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof make_ServiceSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                make_ServiceSelectionInput.bind(that)() as any,
                "_Service",
                opts as any,
                collector,
            ) as any,
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
        Query: QuerySelection.bind({
            collector: this,
            isRootType: "Query",
        }),
        Mutation: MutationSelection.bind({
            collector: this,
            isRootType: "Mutation",
        }),
        Subscription: SubscriptionSelection.bind({
            collector: this,
            isRootType: "Subscription",
        }),

        $directives,
    } as const;
}

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

    const resultProxy = new Proxy(
        {},
        {
            get(_t, _prop) {
                const rAtProp = result[_prop as keyof T];
                if (typeof rAtProp === "function") {
                    return rAtProp;
                }
                const promise = new Promise((resolve, reject) => {
                    root.execute()
                        .catch(reject)
                        .then(() => {
                            resolve(rAtProp);
                        });
                });
                if (String(_prop) === "then") {
                    return promise.then.bind(promise);
                }
                return promise;
            },
        },
    ) as any;

    return resultProxy as finalReturnTypeBasedOnIfHasLazyPromises & {
        auth: (
            auth: FnOrPromisOrPrimitive,
        ) => finalReturnTypeBasedOnIfHasLazyPromises;
    };
}

const __init__ = (options: {
    headers?: { [key: string]: string };
    fetcher?: (
        input: string | URL | globalThis.Request,
        init?: RequestInit,
    ) => Promise<Response>;
    sseFetchTransform?: (
        input: string | URL | globalThis.Request,
        init?: RequestInit,
    ) => Promise<[string | URL | globalThis.Request, RequestInit | undefined]>;
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
    if (options.headers) {
        RootOperation[OPTIONS].headers = {
            ...RootOperation[OPTIONS].headers,
            ...options.headers,
        };
    }
    if (options.fetcher) {
        RootOperation[OPTIONS].fetcher = options.fetcher;
    }
    if (options.sseFetchTransform) {
        RootOperation[OPTIONS].sseFetchTransform = options.sseFetchTransform;
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

const _makeOperationShortcut = <
    O extends "Query" | "Mutation" | "Subscription",
>(
    operation: O,
    field: Exclude<
        typeof operation extends "Query"
            ? keyof ReturnTypeFromQuerySelection
            : typeof operation extends "Mutation"
              ? keyof ReturnTypeFromMutationSelection
              : keyof ReturnTypeFromSubscriptionSelection,
        "$fragment" | "$scalars" | "$all"
    >,
) => {
    const root = new OperationSelectionCollector(
        undefined,
        undefined,
        new RootOperation(),
    );
    const rootRef = { ref: root };

    let fieldFn:
        | ReturnTypeFromQuerySelection[Exclude<
              keyof ReturnTypeFromQuerySelection,
              "$fragment" | "$scalars" | "$all"
          >]
        | ReturnTypeFromMutationSelection[Exclude<
              keyof ReturnTypeFromMutationSelection,
              "$fragment" | "$scalars" | "$all"
          >]
        | ReturnTypeFromSubscriptionSelection[Exclude<
              keyof ReturnTypeFromSubscriptionSelection,
              "$fragment" | "$scalars" | "$all"
          >];

    if (operation === "Query") {
        fieldFn =
            makeQuerySelectionInput.bind(rootRef)()[
                field as Exclude<
                    keyof ReturnTypeFromQuerySelection,
                    "$fragment" | "$scalars" | "$all"
                >
            ];
    } else if (operation === "Mutation") {
        fieldFn =
            makeMutationSelectionInput.bind(rootRef)()[
                field as Exclude<
                    keyof ReturnTypeFromMutationSelection,
                    "$fragment" | "$scalars" | "$all"
                >
            ];
    } else {
        fieldFn =
            makeSubscriptionSelectionInput.bind(rootRef)()[
                field as Exclude<
                    keyof ReturnTypeFromSubscriptionSelection,
                    "$fragment" | "$scalars" | "$all"
                >
            ];
    }

    if (typeof fieldFn === "function") {
        const makeSubSelectionFn =
            (
                opFnArgs?: Exclude<
                    Parameters<Extract<typeof fieldFn, (args: any) => any>>[0],
                    (args: any) => any
                >,
            ) =>
            (opFnSelectionCb?: (selection: unknown) => unknown) => {
                let fieldSLFN:
                    | ((
                          s: typeof opFnSelectionCb,
                      ) => SelectionWrapperImpl<
                          typeof field,
                          string,
                          number,
                          any,
                          typeof opFnArgs
                      >)
                    | SelectionWrapperImpl<
                          typeof field,
                          string,
                          number,
                          any,
                          typeof opFnArgs
                      >;
                if (opFnArgs === undefined) {
                    fieldSLFN = fieldFn as Extract<
                        typeof fieldFn,
                        () => SelectionWrapperImpl<
                            typeof field,
                            string,
                            number,
                            any,
                            typeof opFnArgs
                        >
                    >;
                } else {
                    fieldSLFN = (
                        fieldFn as unknown as (
                            args: typeof opFnArgs,
                        ) =>
                            | ((
                                  s: typeof opFnSelectionCb,
                              ) => SelectionWrapperImpl<
                                  typeof field,
                                  string,
                                  number,
                                  any,
                                  typeof opFnArgs
                              >)
                            | SelectionWrapperImpl<
                                  typeof field,
                                  string,
                                  number,
                                  any,
                                  typeof opFnArgs
                              >
                    )(opFnArgs);
                }

                let fieldSlw: SelectionWrapperImpl<
                    typeof field,
                    string,
                    number,
                    any,
                    typeof opFnArgs
                >;
                if (typeof fieldSLFN === "function") {
                    fieldSlw = (
                        fieldSLFN as (
                            s: typeof opFnSelectionCb,
                        ) => SelectionWrapperImpl<
                            typeof field,
                            string,
                            number,
                            any,
                            typeof opFnArgs
                        >
                    )(opFnSelectionCb);
                } else {
                    fieldSlw = fieldSLFN;
                }

                const opSlw = new SelectionWrapper(
                    undefined,
                    undefined,
                    undefined,
                    { [field]: fieldSlw },
                    new OperationSelectionCollector(
                        operation + "Selection",
                        root,
                    ),
                    root,
                );
                fieldSlw[ROOT_OP_COLLECTOR] = rootRef;
                fieldSlw[SLW_PARENT_SLW] = opSlw;
                opSlw[SLW_IS_ROOT_TYPE] = operation;
                opSlw[SLW_PARENT_COLLECTOR] = opSlw[SLW_COLLECTOR];
                // access the keys of the proxy object, to register operations
                Object.keys({ [field]: 0 }).forEach(
                    (key) => (opSlw as any)[key as any],
                );
                const rootSlw = new SelectionWrapper(
                    undefined,
                    undefined,
                    undefined,
                    opSlw,
                    root,
                );
                opSlw[ROOT_OP_COLLECTOR] = rootRef;
                // access the keys of the proxy object, to register operations
                Object.keys({ [field]: 0 }).forEach(
                    (key) => (rootSlw as any)[key as any],
                );

                const resultProxy = new Proxy(
                    {},
                    {
                        get(_t, _prop) {
                            if (String(_prop) === "$lazy") {
                                return (fieldSlw as any)["$lazy"].bind({
                                    parentSlw: opSlw,
                                    key: field,
                                });
                            } else {
                                const result = new Promise(
                                    (resolve, reject) => {
                                        root.execute()
                                            .catch(reject)
                                            .then((_data) => {
                                                const d = _data[field];

                                                if (Symbol.asyncIterator in d) {
                                                    return resolve(
                                                        fieldSlw as any,
                                                    );
                                                }

                                                const slw = (rootSlw as any)[
                                                    field
                                                ] as any;
                                                if (
                                                    typeof d === "object" &&
                                                    d &&
                                                    field in d
                                                ) {
                                                    const retval = d[field];
                                                    if (
                                                        retval === undefined ||
                                                        retval === null
                                                    ) {
                                                        return resolve(retval);
                                                    }
                                                    const ret =
                                                        typeof retval !==
                                                        "object"
                                                            ? slw
                                                            : proxify(
                                                                  retval,
                                                                  slw,
                                                              );
                                                    return resolve(ret);
                                                }
                                                return resolve(slw);
                                            });
                                    },
                                );
                                if (String(_prop) === "then") {
                                    return result.then.bind(result);
                                }
                                return result;
                            }
                        },
                    },
                ) as any;

                return resultProxy;
            };

        // if the fieldFn is the SLFN subselection function without an (args) => .. wrapper
        if (fieldFn.name.startsWith("bound ")) {
            return makeSubSelectionFn();
        }
        return (
            opFnArgs: Exclude<
                Parameters<Extract<typeof fieldFn, (args: any) => any>>[0],
                (args: any) => any
            >,
        ) => {
            const inner = (
                fieldFn as unknown as (
                    args: typeof opFnArgs,
                ) =>
                    | ((
                          s: unknown,
                      ) => SelectionWrapperImpl<
                          typeof field,
                          string,
                          number,
                          any,
                          typeof opFnArgs
                      >)
                    | SelectionWrapperImpl<
                          typeof field,
                          string,
                          number,
                          any,
                          typeof opFnArgs
                      >
            )(opFnArgs);

            if (typeof inner === "function") {
                return makeSubSelectionFn(opFnArgs);
            }

            return makeSubSelectionFn(opFnArgs)();
        };
    } else {
        const fieldSlw = fieldFn as SelectionWrapperImpl<any, any, any>;
        const opSlw = new SelectionWrapper(
            undefined,
            undefined,
            undefined,
            { [field]: fieldSlw },
            new OperationSelectionCollector(operation + "Selection", root),
            root,
        );
        fieldSlw[ROOT_OP_COLLECTOR] = rootRef;
        opSlw[SLW_IS_ROOT_TYPE] = operation;
        opSlw[SLW_PARENT_COLLECTOR] = opSlw[SLW_COLLECTOR];
        opSlw[SLW_PARENT_SLW] = opSlw;
        // access the keys of the proxy object, to register operations
        Object.keys({ [field]: 0 }).forEach(
            (key) => (opSlw as any)[key as any],
        );
        const rootSlw = new SelectionWrapper(
            undefined,
            undefined,
            undefined,
            opSlw,
            root,
        );
        opSlw[ROOT_OP_COLLECTOR] = rootRef;
        // access the keys of the proxy object, to register operations
        Object.keys({ [field]: 0 }).forEach(
            (key) => (rootSlw as any)[key as any],
        );

        const resultProxy = new Proxy(
            {},
            {
                get(_t, _prop) {
                    if (String(_prop) === "$lazy") {
                        return (fieldSlw as any)["$lazy"].bind({
                            parentSlw: opSlw,
                            key: field,
                        });
                    } else {
                        const result = new Promise((resolve, reject) => {
                            root.execute()
                                .catch(reject)
                                .then((_data) => {
                                    const d = _data[field];

                                    if (Symbol.asyncIterator in d) {
                                        return resolve(fieldSlw as any);
                                    }

                                    const slw = (rootSlw as any)[field] as any;
                                    if (
                                        typeof d === "object" &&
                                        d &&
                                        field in d
                                    ) {
                                        const retval = d[field];
                                        if (
                                            retval === undefined ||
                                            retval === null
                                        ) {
                                            return resolve(retval);
                                        }
                                        const ret =
                                            typeof retval !== "object"
                                                ? slw
                                                : proxify(retval, slw);
                                        return resolve(ret);
                                    }
                                    return resolve(slw);
                                });
                        });
                        if (String(_prop) === "then") {
                            return result.then.bind(result);
                        }
                        return result;
                    }
                },
            },
        ) as any;

        return resultProxy;
    }
};

Object.defineProperty(__client__, "query", {
    enumerable: false,
    get() {
        return new Proxy(
            {},
            {
                get(
                    target,
                    op: Exclude<
                        keyof ReturnTypeFromQuerySelection,
                        "$fragment" | "$scalars" | "$all"
                    >,
                ) {
                    return _makeOperationShortcut("Query", op);
                },
            },
        );
    },
});

Object.defineProperty(__client__, "mutation", {
    enumerable: false,
    get() {
        return new Proxy(
            {},
            {
                get(
                    target,
                    op: Exclude<
                        keyof ReturnTypeFromMutationSelection,
                        "$fragment" | "$scalars" | "$all"
                    >,
                ) {
                    return _makeOperationShortcut("Mutation", op);
                },
            },
        );
    },
});

Object.defineProperty(__client__, "subscription", {
    enumerable: false,
    get() {
        return new Proxy(
            {},
            {
                get(
                    target,
                    op: Exclude<
                        keyof ReturnTypeFromSubscriptionSelection,
                        "$fragment" | "$scalars" | "$all"
                    >,
                ) {
                    return _makeOperationShortcut("Subscription", op);
                },
            },
        );
    },
});

export default __client__ as typeof __client__ & {
    init: typeof __init__;
} & {
    query: {
        [field in Exclude<
            keyof ReturnType<typeof makeQuerySelectionInput>,
            "$fragment" | "$scalars" | "$all"
        >]: ReturnType<
            typeof makeQuerySelectionInput
        >[field] extends SelectionWrapperImpl<
            infer FN,
            infer TTNP,
            infer TTAD,
            infer VT,
            infer AT
        >
            ? Promise<ToTArrayWithDepth<SLW_TPN_ToType<TTNP>, TTAD>> & {
                  $lazy: () => Promise<
                      Promise<ToTArrayWithDepth<SLW_TPN_ToType<TTNP>, TTAD>>
                  >;
              }
            : ReturnType<typeof makeQuerySelectionInput>[field] extends (
                    args: infer A,
                ) => (selection: any) => any
              ? (args: A) => ReturnTypeFromQuerySelectionRetTypes<1>[field]
              : ReturnType<typeof makeQuerySelectionInput>[field] extends (
                      args: infer _A,
                  ) => SelectionWrapperImpl<
                      infer _FN,
                      infer _TTNP,
                      infer _TTAD,
                      infer _VT,
                      infer _AT
                  >
                ? (args: _A) => Promise<
                      ToTArrayWithDepth<SLW_TPN_ToType<_TTNP>, _TTAD>
                  > & {
                      $lazy: (
                          args: _A,
                      ) => Promise<
                          Promise<
                              ToTArrayWithDepth<SLW_TPN_ToType<_TTNP>, _TTAD>
                          >
                      >;
                  }
                : ReturnTypeFromQuerySelectionRetTypes<1>[field];
    };
    mutation: {
        [field in Exclude<
            keyof ReturnType<typeof makeMutationSelectionInput>,
            "$fragment" | "$scalars" | "$all"
        >]: ReturnType<
            typeof makeMutationSelectionInput
        >[field] extends SelectionWrapperImpl<
            infer FN,
            infer TTNP,
            infer TTAD,
            infer VT,
            infer AT
        >
            ? Promise<ToTArrayWithDepth<SLW_TPN_ToType<TTNP>, TTAD>> & {
                  $lazy: () => Promise<
                      Promise<ToTArrayWithDepth<SLW_TPN_ToType<TTNP>, TTAD>>
                  >;
              }
            : ReturnType<typeof makeMutationSelectionInput>[field] extends (
                    args: infer A,
                ) => (selection: any) => any
              ? (args: A) => ReturnTypeFromMutationSelectionRetTypes<1>[field]
              : ReturnType<typeof makeMutationSelectionInput>[field] extends (
                      args: infer _A,
                  ) => SelectionWrapperImpl<
                      infer _FN,
                      infer _TTNP,
                      infer _TTAD,
                      infer _VT,
                      infer _AT
                  >
                ? (args: _A) => Promise<
                      ToTArrayWithDepth<SLW_TPN_ToType<_TTNP>, _TTAD>
                  > & {
                      $lazy: (
                          args: _A,
                      ) => Promise<
                          Promise<
                              ToTArrayWithDepth<SLW_TPN_ToType<_TTNP>, _TTAD>
                          >
                      >;
                  }
                : ReturnTypeFromMutationSelectionRetTypes<1>[field];
    };
    subscription: {
        [field in Exclude<
            keyof ReturnType<typeof makeSubscriptionSelectionInput>,
            "$fragment" | "$scalars" | "$all"
        >]: ReturnType<
            typeof makeSubscriptionSelectionInput
        >[field] extends SelectionWrapperImpl<
            infer FN,
            infer TTNP,
            infer TTAD,
            infer VT,
            infer AT
        >
            ? AsyncIterable<ToTArrayWithDepth<SLW_TPN_ToType<TTNP>, TTAD>> & {
                  $lazy: () => Promise<
                      AsyncIterable<
                          ToTArrayWithDepth<SLW_TPN_ToType<TTNP>, TTAD>
                      >
                  >;
              }
            : ReturnType<typeof makeSubscriptionSelectionInput>[field] extends (
                    args: infer A,
                ) => (selection: any) => any
              ? (
                    args: A,
                ) => ReturnTypeFromSubscriptionSelectionRetTypes<1>[field]
              : ReturnType<
                      typeof makeSubscriptionSelectionInput
                  >[field] extends (
                      args: infer _A,
                  ) => SelectionWrapperImpl<
                      infer _FN,
                      infer _TTNP,
                      infer _TTAD,
                      infer _VT,
                      infer _AT
                  >
                ? (args: _A) => AsyncIterable<
                      ToTArrayWithDepth<SLW_TPN_ToType<_TTNP>, _TTAD>
                  > & {
                      $lazy: (
                          args: _A,
                      ) => Promise<
                          AsyncIterable<
                              ToTArrayWithDepth<SLW_TPN_ToType<_TTNP>, _TTAD>
                          >
                      >;
                  }
                : ReturnTypeFromSubscriptionSelectionRetTypes<1>[field];
    };
};
