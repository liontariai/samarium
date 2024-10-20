import {
    OperationSelectionCollector,
    SelectionWrapper,
    SLW_IS_ROOT_TYPE,
    SLW_IS_ON_TYPE_FRAGMENT,
    SLW_IS_FRAGMENT,
    RootOperation,
    SelectionWrapperImpl,
    ROOT_OP_COLLECTOR,
} from "@/lib/codegen/graphql/flavors/default/wrapper";
import type { SelectionFnParent, SLFN } from "./types";

export const makeSLFN = <
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

export const selectScalars = <S>(selection: Record<string, any>) =>
    Object.fromEntries(
        Object.entries(selection).filter(
            ([k, v]) => v instanceof SelectionWrapperImpl,
        ),
    ) as S;

export const rootSLWFactory = <
    T extends object,
    ROPN extends (...args: any) => any,
>(
    ropfn: ROPN,
    s: (sl: ReturnType<ROPN>) => T,
) => {
    const root = new OperationSelectionCollector(
        undefined,
        undefined,
        new RootOperation(),
    );
    const rootRef = { ref: root };

    const selection = ropfn.bind(rootRef)();

    const r = s(selection);

    // root SelectionWrapper with no parent, linking everything to the RootOperation
    const _result = new SelectionWrapper(
        undefined,
        undefined,
        undefined,
        r,
        root,
        undefined,
    );
    // for now add this manually to keep the tests valid, need to reevaluate if this is as it should be
    _result[ROOT_OP_COLLECTOR] = rootRef;

    // access the keys of the proxy object, to register operations
    Object.keys(r).forEach((key) => (_result as unknown as T)[key as keyof T]);

    return _result;
};
