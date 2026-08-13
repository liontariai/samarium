import {
    OperationSelectionCollector,
    SelectionWrapper,
    ROOT_OP_COLLECTOR,
    RootOperation,
} from "@/openapi/flavors/default/wrapper";

export const rootSLWFactory = <T extends object, ROPN extends (...args: any) => any>(
    ropfn: ROPN,
    s: (sl: ReturnType<ROPN>) => T,
) => {
    const root = new OperationSelectionCollector(undefined, undefined, new RootOperation());
    const rootRef = { ref: root };

    const selection = ropfn.bind(rootRef)();

    const r = s(selection);

    // root SelectionWrapper with no parent, linking everything to the RootOperation
    const _result = new SelectionWrapper(undefined, undefined, undefined, r, root, undefined);
    // for now add this manually to keep the tests valid, need to reevaluate if this is as it should be
    _result[ROOT_OP_COLLECTOR] = rootRef;

    // access the keys of the proxy object, to register operations
    Object.keys(r).forEach((key) => (_result as unknown as T)[key as keyof T]);

    return _result;
};
