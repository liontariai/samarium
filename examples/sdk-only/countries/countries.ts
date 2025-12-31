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
            )("https://countries.trevorblades.com/graphql", {
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
            "https://countries.trevorblades.com/graphql",
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

export type Directive_includeArgs = {
    /** Included when true. */
    if: boolean;
};
export type Directive_skipArgs = {
    /** Skipped when true. */
    if: boolean;
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

export type Continent = {
    code: string;
    countries: Country[];
    name: string;
};

export type Country = {
    awsRegion: string;
    capital?: string;
    code: string;
    continent: Continent;
    currencies: Array<string>;
    currency?: string;
    emoji: string;
    emojiU: string;
    languages: Language[];
    name: (args?: CountryNameArgs) => string;
    native: string;
    phone: string;
    phones: Array<string>;
    states: State[];
    subdivisions: Subdivision[];
};

export type Language = {
    code: string;
    countries: Country[];
    name: string;
    native: string;
    rtl: boolean;
};

export type State = {
    code?: string;
    country: Country;
    name: string;
};

export type Subdivision = {
    code: string;
    emoji?: string;
    name: string;
};

export type Query = {
    continent: (args: QueryContinentArgs) => Continent;
    continents: (args?: QueryContinentsArgs) => Continent[];
    countries: (args?: QueryCountriesArgs) => Country[];
    country: (args: QueryCountryArgs) => Country;
    language: (args: QueryLanguageArgs) => Language;
    languages: (args?: QueryLanguagesArgs) => Language[];
};

export interface EnumTypesMapped {}

type ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes<AS_PROMISE = 0> =
    {
        awsRegion: SelectionWrapperImpl<
            "awsRegion",
            "String!",
            0,
            {},
            undefined
        >;
        capital: SelectionWrapperImpl<"capital", "String", 0, {}, undefined>;
        code: SelectionWrapperImpl<"code", "ID!", 0, {}, undefined>;
        continent: ReturnType<
            SLFN<
                {},
                ReturnType<typeof makeContinentNotNullSelectionInput>,
                "ContinentNotNullSelection",
                "Continent",
                0
            >
        >;
        currencies: SelectionWrapperImpl<
            "currencies",
            "String!",
            1,
            {},
            undefined
        >;
        currency: SelectionWrapperImpl<"currency", "String", 0, {}, undefined>;
        emoji: SelectionWrapperImpl<"emoji", "String!", 0, {}, undefined>;
        emojiU: SelectionWrapperImpl<"emojiU", "String!", 0, {}, undefined>;
        languages: ReturnType<
            SLFN<
                {},
                ReturnType<
                    typeof makeLanguageNotNullArrayNotNullSelectionInput
                >,
                "LanguageNotNullArrayNotNullSelection",
                "Language",
                1
            >
        >;
        name: SelectionWrapperImpl<"name", "String!", 0, {}, CountryNameArgs>;
        native: SelectionWrapperImpl<"native", "String!", 0, {}, undefined>;
        phone: SelectionWrapperImpl<"phone", "String!", 0, {}, undefined>;
        phones: SelectionWrapperImpl<"phones", "String!", 1, {}, undefined>;
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
                ReturnType<
                    typeof makeSubdivisionNotNullArrayNotNullSelectionInput
                >,
                "SubdivisionNotNullArrayNotNullSelection",
                "Subdivision",
                1
            >
        >;
    };
type ReturnTypeFromCountryNotNullArrayNotNullSelection = {
    awsRegion: ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["awsRegion"];
    capital: ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["capital"];
    code: ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["code"];
    continent: ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["continent"];
    currencies: ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["currencies"];
    currency: ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["currency"];
    emoji: ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["emoji"];
    emojiU: ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["emojiU"];
    languages: ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["languages"];
    name: (
        args: CountryNameArgs,
    ) => ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["name"];
    native: ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["native"];
    phone: ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["phone"];
    phones: ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["phones"];
    states: ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["states"];
    subdivisions: ReturnTypeFromCountryNotNullArrayNotNullSelectionRetTypes["subdivisions"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCountryNotNullArrayNotNullSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Country[]>, "Country[]">;
};

export function makeCountryNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromCountryNotNullArrayNotNullSelection {
    const that = this;
    return {
        get awsRegion() {
            return new SelectionWrapper(
                "awsRegion",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get capital() {
            return new SelectionWrapper(
                "capital",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get code() {
            return new SelectionWrapper("code", "ID!", 0, {}, that, undefined);
        },
        continent: ContinentNotNullSelection.bind({
            collector: that,
            fieldName: "continent",
        }) as any,
        get currencies() {
            return new SelectionWrapper(
                "currencies",
                "String!",
                1,
                {},
                that,
                undefined,
            );
        },
        get currency() {
            return new SelectionWrapper(
                "currency",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get emoji() {
            return new SelectionWrapper(
                "emoji",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get emojiU() {
            return new SelectionWrapper(
                "emojiU",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        languages: LanguageNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "languages",
        }) as any,
        get name() {
            return (args: CountryNameArgs) =>
                new SelectionWrapper(
                    "name",
                    "String!",
                    0,
                    {},
                    that,
                    undefined,
                    args,
                    CountryNameArgsMeta,
                );
        },
        get native() {
            return new SelectionWrapper(
                "native",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get phone() {
            return new SelectionWrapper(
                "phone",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get phones() {
            return new SelectionWrapper("phones", "String!", 1, {}, that);
        },
        states: StateNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "states",
        }) as any,
        subdivisions: SubdivisionNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "subdivisions",
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
                makeCountryNotNullArrayNotNullSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCountryNotNullArrayNotNullSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeCountryNotNullArrayNotNullSelectionInput.bind(
                    that,
                )() as any,
                "Country[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const CountryNotNullArrayNotNullSelection = makeSLFN(
    makeCountryNotNullArrayNotNullSelectionInput,
    "CountryNotNullArrayNotNullSelection",
    "Country",
    1,
);

type ReturnTypeFromContinentNotNullSelectionRetTypes<AS_PROMISE = 0> = {
    code: SelectionWrapperImpl<"code", "ID!", 0, {}, undefined>;
    countries: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountryNotNullArrayNotNullSelectionInput>,
            "CountryNotNullArrayNotNullSelection",
            "Country",
            1
        >
    >;
    name: SelectionWrapperImpl<"name", "String!", 0, {}, undefined>;
};
type ReturnTypeFromContinentNotNullSelection = {
    code: ReturnTypeFromContinentNotNullSelectionRetTypes["code"];
    countries: ReturnTypeFromContinentNotNullSelectionRetTypes["countries"];
    name: ReturnTypeFromContinentNotNullSelectionRetTypes["name"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeContinentNotNullSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Continent>, "Continent">;
};

export function makeContinentNotNullSelectionInput(
    this: any,
): ReturnTypeFromContinentNotNullSelection {
    const that = this;
    return {
        get code() {
            return new SelectionWrapper("code", "ID!", 0, {}, that, undefined);
        },
        countries: CountryNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "countries",
        }) as any,
        get name() {
            return new SelectionWrapper(
                "name",
                "String!",
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
                makeContinentNotNullSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeContinentNotNullSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeContinentNotNullSelectionInput.bind(that)() as any,
                "Continent",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const ContinentNotNullSelection = makeSLFN(
    makeContinentNotNullSelectionInput,
    "ContinentNotNullSelection",
    "Continent",
    0,
);

type ReturnTypeFromLanguageNotNullArrayNotNullSelectionRetTypes<
    AS_PROMISE = 0,
> = {
    code: SelectionWrapperImpl<"code", "ID!", 0, {}, undefined>;
    countries: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountryNotNullArrayNotNullSelectionInput>,
            "CountryNotNullArrayNotNullSelection",
            "Country",
            1
        >
    >;
    name: SelectionWrapperImpl<"name", "String!", 0, {}, undefined>;
    native: SelectionWrapperImpl<"native", "String!", 0, {}, undefined>;
    rtl: SelectionWrapperImpl<"rtl", "Boolean!", 0, {}, undefined>;
};
type ReturnTypeFromLanguageNotNullArrayNotNullSelection = {
    code: ReturnTypeFromLanguageNotNullArrayNotNullSelectionRetTypes["code"];
    countries: ReturnTypeFromLanguageNotNullArrayNotNullSelectionRetTypes["countries"];
    name: ReturnTypeFromLanguageNotNullArrayNotNullSelectionRetTypes["name"];
    native: ReturnTypeFromLanguageNotNullArrayNotNullSelectionRetTypes["native"];
    rtl: ReturnTypeFromLanguageNotNullArrayNotNullSelectionRetTypes["rtl"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLanguageNotNullArrayNotNullSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Language[]>, "Language[]">;
};

export function makeLanguageNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromLanguageNotNullArrayNotNullSelection {
    const that = this;
    return {
        get code() {
            return new SelectionWrapper("code", "ID!", 0, {}, that, undefined);
        },
        countries: CountryNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "countries",
        }) as any,
        get name() {
            return new SelectionWrapper(
                "name",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get native() {
            return new SelectionWrapper(
                "native",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get rtl() {
            return new SelectionWrapper(
                "rtl",
                "Boolean!",
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
                makeLanguageNotNullArrayNotNullSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLanguageNotNullArrayNotNullSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLanguageNotNullArrayNotNullSelectionInput.bind(
                    that,
                )() as any,
                "Language[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LanguageNotNullArrayNotNullSelection = makeSLFN(
    makeLanguageNotNullArrayNotNullSelectionInput,
    "LanguageNotNullArrayNotNullSelection",
    "Language",
    1,
);

type ReturnTypeFromStateNotNullArrayNotNullSelectionRetTypes<AS_PROMISE = 0> = {
    code: SelectionWrapperImpl<"code", "String", 0, {}, undefined>;
    country: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountryNotNullSelectionInput>,
            "CountryNotNullSelection",
            "Country",
            0
        >
    >;
    name: SelectionWrapperImpl<"name", "String!", 0, {}, undefined>;
};
type ReturnTypeFromStateNotNullArrayNotNullSelection = {
    code: ReturnTypeFromStateNotNullArrayNotNullSelectionRetTypes["code"];
    country: ReturnTypeFromStateNotNullArrayNotNullSelectionRetTypes["country"];
    name: ReturnTypeFromStateNotNullArrayNotNullSelectionRetTypes["name"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStateNotNullArrayNotNullSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<State[]>, "State[]">;
};

export function makeStateNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromStateNotNullArrayNotNullSelection {
    const that = this;
    return {
        get code() {
            return new SelectionWrapper(
                "code",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        country: CountryNotNullSelection.bind({
            collector: that,
            fieldName: "country",
        }) as any,
        get name() {
            return new SelectionWrapper(
                "name",
                "String!",
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
                makeStateNotNullArrayNotNullSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeStateNotNullArrayNotNullSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeStateNotNullArrayNotNullSelectionInput.bind(that)() as any,
                "State[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const StateNotNullArrayNotNullSelection = makeSLFN(
    makeStateNotNullArrayNotNullSelectionInput,
    "StateNotNullArrayNotNullSelection",
    "State",
    1,
);

type ReturnTypeFromCountryNotNullSelectionRetTypes<AS_PROMISE = 0> = {
    awsRegion: SelectionWrapperImpl<"awsRegion", "String!", 0, {}, undefined>;
    capital: SelectionWrapperImpl<"capital", "String", 0, {}, undefined>;
    code: SelectionWrapperImpl<"code", "ID!", 0, {}, undefined>;
    continent: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContinentNotNullSelectionInput>,
            "ContinentNotNullSelection",
            "Continent",
            0
        >
    >;
    currencies: SelectionWrapperImpl<"currencies", "String!", 1, {}, undefined>;
    currency: SelectionWrapperImpl<"currency", "String", 0, {}, undefined>;
    emoji: SelectionWrapperImpl<"emoji", "String!", 0, {}, undefined>;
    emojiU: SelectionWrapperImpl<"emojiU", "String!", 0, {}, undefined>;
    languages: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLanguageNotNullArrayNotNullSelectionInput>,
            "LanguageNotNullArrayNotNullSelection",
            "Language",
            1
        >
    >;
    name: SelectionWrapperImpl<"name", "String!", 0, {}, CountryNameArgs>;
    native: SelectionWrapperImpl<"native", "String!", 0, {}, undefined>;
    phone: SelectionWrapperImpl<"phone", "String!", 0, {}, undefined>;
    phones: SelectionWrapperImpl<"phones", "String!", 1, {}, undefined>;
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
};
type ReturnTypeFromCountryNotNullSelection = {
    awsRegion: ReturnTypeFromCountryNotNullSelectionRetTypes["awsRegion"];
    capital: ReturnTypeFromCountryNotNullSelectionRetTypes["capital"];
    code: ReturnTypeFromCountryNotNullSelectionRetTypes["code"];
    continent: ReturnTypeFromCountryNotNullSelectionRetTypes["continent"];
    currencies: ReturnTypeFromCountryNotNullSelectionRetTypes["currencies"];
    currency: ReturnTypeFromCountryNotNullSelectionRetTypes["currency"];
    emoji: ReturnTypeFromCountryNotNullSelectionRetTypes["emoji"];
    emojiU: ReturnTypeFromCountryNotNullSelectionRetTypes["emojiU"];
    languages: ReturnTypeFromCountryNotNullSelectionRetTypes["languages"];
    name: (
        args: CountryNameArgs,
    ) => ReturnTypeFromCountryNotNullSelectionRetTypes["name"];
    native: ReturnTypeFromCountryNotNullSelectionRetTypes["native"];
    phone: ReturnTypeFromCountryNotNullSelectionRetTypes["phone"];
    phones: ReturnTypeFromCountryNotNullSelectionRetTypes["phones"];
    states: ReturnTypeFromCountryNotNullSelectionRetTypes["states"];
    subdivisions: ReturnTypeFromCountryNotNullSelectionRetTypes["subdivisions"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCountryNotNullSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Country>, "Country">;
};

export function makeCountryNotNullSelectionInput(
    this: any,
): ReturnTypeFromCountryNotNullSelection {
    const that = this;
    return {
        get awsRegion() {
            return new SelectionWrapper(
                "awsRegion",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get capital() {
            return new SelectionWrapper(
                "capital",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get code() {
            return new SelectionWrapper("code", "ID!", 0, {}, that, undefined);
        },
        continent: ContinentNotNullSelection.bind({
            collector: that,
            fieldName: "continent",
        }) as any,
        get currencies() {
            return new SelectionWrapper(
                "currencies",
                "String!",
                1,
                {},
                that,
                undefined,
            );
        },
        get currency() {
            return new SelectionWrapper(
                "currency",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get emoji() {
            return new SelectionWrapper(
                "emoji",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get emojiU() {
            return new SelectionWrapper(
                "emojiU",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        languages: LanguageNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "languages",
        }) as any,
        get name() {
            return (args: CountryNameArgs) =>
                new SelectionWrapper(
                    "name",
                    "String!",
                    0,
                    {},
                    that,
                    undefined,
                    args,
                    CountryNameArgsMeta,
                );
        },
        get native() {
            return new SelectionWrapper(
                "native",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get phone() {
            return new SelectionWrapper(
                "phone",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get phones() {
            return new SelectionWrapper(
                "phones",
                "String!",
                1,
                {},
                that,
                undefined,
            );
        },
        states: StateNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "states",
        }) as any,
        subdivisions: SubdivisionNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "subdivisions",
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
                makeCountryNotNullSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCountryNotNullSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeCountryNotNullSelectionInput.bind(that)() as any,
                "Country",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const CountryNotNullSelection = makeSLFN(
    makeCountryNotNullSelectionInput,
    "CountryNotNullSelection",
    "Country",
    0,
);

type ReturnTypeFromSubdivisionNotNullArrayNotNullSelectionRetTypes<
    AS_PROMISE = 0,
> = {
    code: SelectionWrapperImpl<"code", "ID!", 0, {}, undefined>;
    emoji: SelectionWrapperImpl<"emoji", "String", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String!", 0, {}, undefined>;
};
type ReturnTypeFromSubdivisionNotNullArrayNotNullSelection = {
    code: ReturnTypeFromSubdivisionNotNullArrayNotNullSelectionRetTypes["code"];
    emoji: ReturnTypeFromSubdivisionNotNullArrayNotNullSelectionRetTypes["emoji"];
    name: ReturnTypeFromSubdivisionNotNullArrayNotNullSelectionRetTypes["name"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSubdivisionNotNullArrayNotNullSelectionInput>
    >;

    $all: selectAllFunc<
        AllNonFuncFieldsFromType<Subdivision[]>,
        "Subdivision[]"
    >;
};

export function makeSubdivisionNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromSubdivisionNotNullArrayNotNullSelection {
    const that = this;
    return {
        get code() {
            return new SelectionWrapper("code", "ID!", 0, {}, that, undefined);
        },
        get emoji() {
            return new SelectionWrapper(
                "emoji",
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
                "String!",
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
                makeSubdivisionNotNullArrayNotNullSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<
                    typeof makeSubdivisionNotNullArrayNotNullSelectionInput
                >
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeSubdivisionNotNullArrayNotNullSelectionInput.bind(
                    that,
                )() as any,
                "Subdivision[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const SubdivisionNotNullArrayNotNullSelection = makeSLFN(
    makeSubdivisionNotNullArrayNotNullSelectionInput,
    "SubdivisionNotNullArrayNotNullSelection",
    "Subdivision",
    1,
);

type ReturnTypeFromContinentSelectionRetTypes<AS_PROMISE = 0> = {
    code: SelectionWrapperImpl<"code", "ID!", 0, {}, undefined>;
    countries: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountryNotNullArrayNotNullSelectionInput>,
            "CountryNotNullArrayNotNullSelection",
            "Country",
            1
        >
    >;
    name: SelectionWrapperImpl<"name", "String!", 0, {}, undefined>;
};
type ReturnTypeFromContinentSelection = {
    code: ReturnTypeFromContinentSelectionRetTypes["code"];
    countries: ReturnTypeFromContinentSelectionRetTypes["countries"];
    name: ReturnTypeFromContinentSelectionRetTypes["name"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeContinentSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Continent>, "Continent">;
};

export function makeContinentSelectionInput(
    this: any,
): ReturnTypeFromContinentSelection {
    const that = this;
    return {
        get code() {
            return new SelectionWrapper("code", "ID!", 0, {}, that, undefined);
        },
        countries: CountryNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "countries",
        }) as any,
        get name() {
            return new SelectionWrapper(
                "name",
                "String!",
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
                makeContinentSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeContinentSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeContinentSelectionInput.bind(that)() as any,
                "Continent",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const ContinentSelection = makeSLFN(
    makeContinentSelectionInput,
    "ContinentSelection",
    "Continent",
    0,
);

type ReturnTypeFromContinentNotNullArrayNotNullSelectionRetTypes<
    AS_PROMISE = 0,
> = {
    code: SelectionWrapperImpl<"code", "ID!", 0, {}, undefined>;
    countries: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountryNotNullArrayNotNullSelectionInput>,
            "CountryNotNullArrayNotNullSelection",
            "Country",
            1
        >
    >;
    name: SelectionWrapperImpl<"name", "String!", 0, {}, undefined>;
};
type ReturnTypeFromContinentNotNullArrayNotNullSelection = {
    code: ReturnTypeFromContinentNotNullArrayNotNullSelectionRetTypes["code"];
    countries: ReturnTypeFromContinentNotNullArrayNotNullSelectionRetTypes["countries"];
    name: ReturnTypeFromContinentNotNullArrayNotNullSelectionRetTypes["name"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeContinentNotNullArrayNotNullSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Continent[]>, "Continent[]">;
};

export function makeContinentNotNullArrayNotNullSelectionInput(
    this: any,
): ReturnTypeFromContinentNotNullArrayNotNullSelection {
    const that = this;
    return {
        get code() {
            return new SelectionWrapper("code", "ID!", 0, {}, that, undefined);
        },
        countries: CountryNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "countries",
        }) as any,
        get name() {
            return new SelectionWrapper(
                "name",
                "String!",
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
                makeContinentNotNullArrayNotNullSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<
                    typeof makeContinentNotNullArrayNotNullSelectionInput
                >
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeContinentNotNullArrayNotNullSelectionInput.bind(
                    that,
                )() as any,
                "Continent[]",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const ContinentNotNullArrayNotNullSelection = makeSLFN(
    makeContinentNotNullArrayNotNullSelectionInput,
    "ContinentNotNullArrayNotNullSelection",
    "Continent",
    1,
);

type ReturnTypeFromCountrySelectionRetTypes<AS_PROMISE = 0> = {
    awsRegion: SelectionWrapperImpl<"awsRegion", "String!", 0, {}, undefined>;
    capital: SelectionWrapperImpl<"capital", "String", 0, {}, undefined>;
    code: SelectionWrapperImpl<"code", "ID!", 0, {}, undefined>;
    continent: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContinentNotNullSelectionInput>,
            "ContinentNotNullSelection",
            "Continent",
            0
        >
    >;
    currencies: SelectionWrapperImpl<"currencies", "String!", 1, {}, undefined>;
    currency: SelectionWrapperImpl<"currency", "String", 0, {}, undefined>;
    emoji: SelectionWrapperImpl<"emoji", "String!", 0, {}, undefined>;
    emojiU: SelectionWrapperImpl<"emojiU", "String!", 0, {}, undefined>;
    languages: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLanguageNotNullArrayNotNullSelectionInput>,
            "LanguageNotNullArrayNotNullSelection",
            "Language",
            1
        >
    >;
    name: SelectionWrapperImpl<"name", "String!", 0, {}, CountryNameArgs>;
    native: SelectionWrapperImpl<"native", "String!", 0, {}, undefined>;
    phone: SelectionWrapperImpl<"phone", "String!", 0, {}, undefined>;
    phones: SelectionWrapperImpl<"phones", "String!", 1, {}, undefined>;
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
};
type ReturnTypeFromCountrySelection = {
    awsRegion: ReturnTypeFromCountrySelectionRetTypes["awsRegion"];
    capital: ReturnTypeFromCountrySelectionRetTypes["capital"];
    code: ReturnTypeFromCountrySelectionRetTypes["code"];
    continent: ReturnTypeFromCountrySelectionRetTypes["continent"];
    currencies: ReturnTypeFromCountrySelectionRetTypes["currencies"];
    currency: ReturnTypeFromCountrySelectionRetTypes["currency"];
    emoji: ReturnTypeFromCountrySelectionRetTypes["emoji"];
    emojiU: ReturnTypeFromCountrySelectionRetTypes["emojiU"];
    languages: ReturnTypeFromCountrySelectionRetTypes["languages"];
    name: (
        args: CountryNameArgs,
    ) => ReturnTypeFromCountrySelectionRetTypes["name"];
    native: ReturnTypeFromCountrySelectionRetTypes["native"];
    phone: ReturnTypeFromCountrySelectionRetTypes["phone"];
    phones: ReturnTypeFromCountrySelectionRetTypes["phones"];
    states: ReturnTypeFromCountrySelectionRetTypes["states"];
    subdivisions: ReturnTypeFromCountrySelectionRetTypes["subdivisions"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeCountrySelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Country>, "Country">;
};

export function makeCountrySelectionInput(
    this: any,
): ReturnTypeFromCountrySelection {
    const that = this;
    return {
        get awsRegion() {
            return new SelectionWrapper(
                "awsRegion",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get capital() {
            return new SelectionWrapper(
                "capital",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get code() {
            return new SelectionWrapper("code", "ID!", 0, {}, that, undefined);
        },
        continent: ContinentNotNullSelection.bind({
            collector: that,
            fieldName: "continent",
        }) as any,
        get currencies() {
            return new SelectionWrapper(
                "currencies",
                "String!",
                1,
                {},
                that,
                undefined,
            );
        },
        get currency() {
            return new SelectionWrapper(
                "currency",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        get emoji() {
            return new SelectionWrapper(
                "emoji",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get emojiU() {
            return new SelectionWrapper(
                "emojiU",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        languages: LanguageNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "languages",
        }) as any,
        get name() {
            return (args: CountryNameArgs) =>
                new SelectionWrapper(
                    "name",
                    "String!",
                    0,
                    {},
                    that,
                    undefined,
                    args,
                    CountryNameArgsMeta,
                );
        },
        get native() {
            return new SelectionWrapper(
                "native",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get phone() {
            return new SelectionWrapper(
                "phone",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get phones() {
            return new SelectionWrapper(
                "phones",
                "String!",
                1,
                {},
                that,
                undefined,
            );
        },
        states: StateNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "states",
        }) as any,
        subdivisions: SubdivisionNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "subdivisions",
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
                makeCountrySelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeCountrySelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeCountrySelectionInput.bind(that)() as any,
                "Country",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const CountrySelection = makeSLFN(
    makeCountrySelectionInput,
    "CountrySelection",
    "Country",
    0,
);

type ReturnTypeFromLanguageSelectionRetTypes<AS_PROMISE = 0> = {
    code: SelectionWrapperImpl<"code", "ID!", 0, {}, undefined>;
    countries: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountryNotNullArrayNotNullSelectionInput>,
            "CountryNotNullArrayNotNullSelection",
            "Country",
            1
        >
    >;
    name: SelectionWrapperImpl<"name", "String!", 0, {}, undefined>;
    native: SelectionWrapperImpl<"native", "String!", 0, {}, undefined>;
    rtl: SelectionWrapperImpl<"rtl", "Boolean!", 0, {}, undefined>;
};
type ReturnTypeFromLanguageSelection = {
    code: ReturnTypeFromLanguageSelectionRetTypes["code"];
    countries: ReturnTypeFromLanguageSelectionRetTypes["countries"];
    name: ReturnTypeFromLanguageSelectionRetTypes["name"];
    native: ReturnTypeFromLanguageSelectionRetTypes["native"];
    rtl: ReturnTypeFromLanguageSelectionRetTypes["rtl"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeLanguageSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Language>, "Language">;
};

export function makeLanguageSelectionInput(
    this: any,
): ReturnTypeFromLanguageSelection {
    const that = this;
    return {
        get code() {
            return new SelectionWrapper("code", "ID!", 0, {}, that, undefined);
        },
        countries: CountryNotNullArrayNotNullSelection.bind({
            collector: that,
            fieldName: "countries",
        }) as any,
        get name() {
            return new SelectionWrapper(
                "name",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get native() {
            return new SelectionWrapper(
                "native",
                "String!",
                0,
                {},
                that,
                undefined,
            );
        },
        get rtl() {
            return new SelectionWrapper(
                "rtl",
                "Boolean!",
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
                makeLanguageSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeLanguageSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeLanguageSelectionInput.bind(that)() as any,
                "Language",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const LanguageSelection = makeSLFN(
    makeLanguageSelectionInput,
    "LanguageSelection",
    "Language",
    0,
);

type ReturnTypeFromQuerySelectionRetTypes<AS_PROMISE = 0> = {
    continent: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContinentSelectionInput>,
            "ContinentSelection",
            "Continent",
            0,
            {
                $lazy: (args: QueryContinentArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    continents: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeContinentNotNullArrayNotNullSelectionInput>,
            "ContinentNotNullArrayNotNullSelection",
            "Continent",
            1,
            {
                $lazy: (args: QueryContinentsArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    countries: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountryNotNullArrayNotNullSelectionInput>,
            "CountryNotNullArrayNotNullSelection",
            "Country",
            1,
            {
                $lazy: (args: QueryCountriesArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    country: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountrySelectionInput>,
            "CountrySelection",
            "Country",
            0,
            {
                $lazy: (args: QueryCountryArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    language: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLanguageSelectionInput>,
            "LanguageSelection",
            "Language",
            0,
            {
                $lazy: (args: QueryLanguageArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
    languages: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeLanguageNotNullArrayNotNullSelectionInput>,
            "LanguageNotNullArrayNotNullSelection",
            "Language",
            1,
            {
                $lazy: (args: QueryLanguagesArgs) => Promise<"T">;
            },
            "$lazy",
            AS_PROMISE
        >
    >;
};
type ReturnTypeFromQuerySelection = {
    continent: (
        args: QueryContinentArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["continent"];
    continents: (
        args: QueryContinentsArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["continents"];
    countries: (
        args: QueryCountriesArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["countries"];
    country: (
        args: QueryCountryArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["country"];
    language: (
        args: QueryLanguageArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["language"];
    languages: (
        args: QueryLanguagesArgs,
    ) => ReturnTypeFromQuerySelectionRetTypes["languages"];
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
        continent: (args: QueryContinentArgs) =>
            ContinentSelection.bind({
                collector: that,
                fieldName: "continent",
                args,
                argsMeta: QueryContinentArgsMeta,
            }) as any,
        continents: (args: QueryContinentsArgs) =>
            ContinentNotNullArrayNotNullSelection.bind({
                collector: that,
                fieldName: "continents",
                args,
                argsMeta: QueryContinentsArgsMeta,
            }) as any,
        countries: (args: QueryCountriesArgs) =>
            CountryNotNullArrayNotNullSelection.bind({
                collector: that,
                fieldName: "countries",
                args,
                argsMeta: QueryCountriesArgsMeta,
            }) as any,
        country: (args: QueryCountryArgs) =>
            CountrySelection.bind({
                collector: that,
                fieldName: "country",
                args,
                argsMeta: QueryCountryArgsMeta,
            }) as any,
        language: (args: QueryLanguageArgs) =>
            LanguageSelection.bind({
                collector: that,
                fieldName: "language",
                args,
                argsMeta: QueryLanguageArgsMeta,
            }) as any,
        languages: (args: QueryLanguagesArgs) =>
            LanguageNotNullArrayNotNullSelection.bind({
                collector: that,
                fieldName: "languages",
                args,
                argsMeta: QueryLanguagesArgsMeta,
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

type ReturnTypeFromStateSelectionRetTypes<AS_PROMISE = 0> = {
    code: SelectionWrapperImpl<"code", "String", 0, {}, undefined>;
    country: ReturnType<
        SLFN<
            {},
            ReturnType<typeof makeCountryNotNullSelectionInput>,
            "CountryNotNullSelection",
            "Country",
            0
        >
    >;
    name: SelectionWrapperImpl<"name", "String!", 0, {}, undefined>;
};
type ReturnTypeFromStateSelection = {
    code: ReturnTypeFromStateSelectionRetTypes["code"];
    country: ReturnTypeFromStateSelectionRetTypes["country"];
    name: ReturnTypeFromStateSelectionRetTypes["name"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeStateSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<State>, "State">;
};

export function makeStateSelectionInput(
    this: any,
): ReturnTypeFromStateSelection {
    const that = this;
    return {
        get code() {
            return new SelectionWrapper(
                "code",
                "String",
                0,
                {},
                that,
                undefined,
            );
        },
        country: CountryNotNullSelection.bind({
            collector: that,
            fieldName: "country",
        }) as any,
        get name() {
            return new SelectionWrapper(
                "name",
                "String!",
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
                makeStateSelectionInput.bind(that)(),
            ) as SLWsFromSelection<ReturnType<typeof makeStateSelectionInput>>,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeStateSelectionInput.bind(that)() as any,
                "State",
                opts as any,
                collector,
            ) as any,
    } as const;
}
export const StateSelection = makeSLFN(
    makeStateSelectionInput,
    "StateSelection",
    "State",
    0,
);

type ReturnTypeFromSubdivisionSelectionRetTypes<AS_PROMISE = 0> = {
    code: SelectionWrapperImpl<"code", "ID!", 0, {}, undefined>;
    emoji: SelectionWrapperImpl<"emoji", "String", 0, {}, undefined>;
    name: SelectionWrapperImpl<"name", "String!", 0, {}, undefined>;
};
type ReturnTypeFromSubdivisionSelection = {
    code: ReturnTypeFromSubdivisionSelectionRetTypes["code"];
    emoji: ReturnTypeFromSubdivisionSelectionRetTypes["emoji"];
    name: ReturnTypeFromSubdivisionSelectionRetTypes["name"];
} & {
    $fragment: <F extends (this: any, ...args: any[]) => any>(
        f: F,
    ) => (...args: ArgumentsTypeFromFragment<F>) => ReturnTypeFromFragment<F>;

    $scalars: () => SLWsFromSelection<
        ReturnType<typeof makeSubdivisionSelectionInput>
    >;

    $all: selectAllFunc<AllNonFuncFieldsFromType<Subdivision>, "Subdivision">;
};

export function makeSubdivisionSelectionInput(
    this: any,
): ReturnTypeFromSubdivisionSelection {
    const that = this;
    return {
        get code() {
            return new SelectionWrapper("code", "ID!", 0, {}, that, undefined);
        },
        get emoji() {
            return new SelectionWrapper(
                "emoji",
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
                "String!",
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
                makeSubdivisionSelectionInput.bind(that)(),
            ) as SLWsFromSelection<
                ReturnType<typeof makeSubdivisionSelectionInput>
            >,

        $all: (opts?: any, collector = undefined) =>
            selectAll(
                makeSubdivisionSelectionInput.bind(that)() as any,
                "Subdivision",
                opts as any,
                collector,
            ) as any,
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
        Query: QuerySelection.bind({
            collector: this,
            isRootType: "Query",
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

const _makeOperationShortcut = <O extends "Query">(
    operation: O,
    field: Exclude<
        keyof ReturnTypeFromQuerySelection,
        "$fragment" | "$scalars" | "$all"
    >,
) => {
    const root = new OperationSelectionCollector(
        undefined,
        undefined,
        new RootOperation(),
    );
    const rootRef = { ref: root };

    let fieldFn: ReturnTypeFromQuerySelection[Exclude<
        keyof ReturnTypeFromQuerySelection,
        "$fragment" | "$scalars" | "$all"
    >];

    fieldFn =
        makeQuerySelectionInput.bind(rootRef)()[
            field as Exclude<
                keyof ReturnTypeFromQuerySelection,
                "$fragment" | "$scalars" | "$all"
            >
        ];

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
};
