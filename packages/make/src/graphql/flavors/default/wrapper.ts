const Proxy = globalThis.Proxy;
Proxy.prototype = {};

type FnOrPromisOrPrimitive =
    | (() => string | { [key: string]: string } | undefined)
    | (() => Promise<string | { [key: string]: string } | undefined>)
    | string
    | { [key: string]: string };
export const _ = Symbol("_") as any;
export const OPTIONS = Symbol("OPTIONS");
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
            )("http://localhost:4000/graphql", {
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
            const response = await fetch(url, {
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
            "[ENDPOINT]",
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

        return slw;
    }

    readonly [SLW_UID] = this.generateUniqueId();
    [ROOT_OP_COLLECTOR]?: OperationSelectionCollectorRef;
    [SLW_PARENT_COLLECTOR]?: OperationSelectionCollector;
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
            (() => {
                const getCache = (
                    t: SelectionWrapperImpl<
                        fieldName,
                        typeNamePure,
                        typeArrDepth,
                        valueT,
                        argsT
                    >,
                ) => t[ROOT_OP_COLLECTOR]!.ref.cache;

                const getResultDataForTarget = (
                    t: SelectionWrapperImpl<
                        fieldName,
                        typeNamePure,
                        typeArrDepth,
                        valueT,
                        argsT
                    >,
                    overrideOpPath?: string,
                ): valueT | undefined => {
                    const cache = getCache(t);

                    const path = overrideOpPath ?? t[SLW_OP_PATH] ?? "";
                    if (cache.data.has(path) && !t[SLW_NEEDS_CLONE])
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

                    cache.data.set(path, data);
                    return data;
                };

                return {
                    // implement ProxyHandler methods
                    ownKeys() {
                        return Reflect.ownKeys(value ?? {});
                    },
                    getOwnPropertyDescriptor(target, prop) {
                        return Reflect.getOwnPropertyDescriptor(
                            value ?? {},
                            prop,
                        );
                    },
                    has(target, prop) {
                        if (prop === Symbol.for("nodejs.util.inspect.custom"))
                            return true;
                        if (prop === Symbol.iterator && typeArrDepth) {
                            const dataArr = getResultDataForTarget(target);
                            if (Array.isArray(dataArr)) return true;
                            if (dataArr === undefined || dataArr === null)
                                return false;
                        }

                        return Reflect.has(value ?? {}, prop);
                    },
                    set(target, p, newValue, receiver) {
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

                                const resultProxy = new Proxy(
                                    {},
                                    {
                                        get(_t, _prop) {
                                            const result = new Promise(
                                                (resolve, reject) => {
                                                    newRootOpCollectorRef.ref
                                                        .execute()
                                                        .catch(reject)
                                                        .then(() => {
                                                            resolve(newThat);
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
                            prop === SLW_SETTER_DATA_OVERRIDE
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
                                ) as AsyncGenerator<valueT, any, any>;

                                return function () {
                                    return {
                                        next() {
                                            return asyncGen
                                                .next()
                                                .then((val) => {
                                                    return {
                                                        done: val.done,
                                                        value: target[
                                                            SLW_CLONE
                                                        ]({
                                                            SLW_OP_PATH:
                                                                asyncGenRootPath,
                                                            OP_RESULT_DATA:
                                                                val.value,

                                                            // this is only for subscriptions
                                                            SLW_NEEDS_CLONE: true,
                                                        }),
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
                                        return elm;
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
                                                target[SLW_CLONE]({
                                                    SLW_OP_PATH:
                                                        target[SLW_OP_PATH] +
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
                                const dataArr = getResultDataForTarget(slw) as
                                    | unknown[]
                                    | undefined
                                    | null;
                                if (dataArr === undefined) return undefined;
                                if (dataArr === null) return null;
                                if (!dataArr?.length) {
                                    return [];
                                }
                            } else if (slw instanceof SelectionWrapperImpl) {
                                const data = getResultDataForTarget(slw) as
                                    | unknown
                                    | undefined
                                    | null;
                                if (data === undefined) return undefined;
                                if (data === null) return null;
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
