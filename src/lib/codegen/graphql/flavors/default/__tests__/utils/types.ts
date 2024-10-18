import {
    SelectionWrapperImpl,
    type OperationSelectionCollector,
    type OperationSelectionCollectorRef,
} from "@/lib/codegen/graphql/flavors/default/wrapper";

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

export type SelectionFnParent =
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

export type CleanupNever<A> = Omit<A, keyof A> & {
    [K in keyof A as A[K] extends never ? never : K]: A[K];
};
export type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};

export type SLWsFromSelection<
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
export type ReturnTypeFromFragment<T> = T extends (
    this: any,
    ...args: any[]
) => infer R
    ? R
    : never;
export type ArgumentsTypeFromFragment<T> = T extends (
    this: any,
    ...args: infer A
) => any
    ? A
    : never;

export type ReplaceReturnType<T, R> = T extends (...a: any) => any
    ? (
          ...a: Parameters<T>
      ) => ReturnType<T> extends Promise<any> ? Promise<R> : R
    : never;
export type SLW_TPN_ToType<TNP> = TNP extends keyof ScalarTypeMapWithCustom
    ? ScalarTypeMapWithCustom[TNP]
    : TNP extends keyof ScalarTypeMapDefault
      ? ScalarTypeMapDefault[TNP]
      : never;
export type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ...0[]];
export type ToTArrayWithDepth<T, D extends number> = D extends 0
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
