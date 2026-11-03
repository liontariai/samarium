/**
 * Compile-time check: no-arg SSE ops are the selection function itself
 * (GraphQL style: q.books(sel), not q.books()(sel)). The selected result is
 * AsyncIterable.
 */
import type * as events from "./examples/events.generated";

type OnEvent = ReturnType<typeof events._makeRootOperationInput>["onEvent"];
type AfterSelection = OnEvent extends (s: infer _S) => infer R ? R : never;

type IsAsyncIterable<T> = T extends AsyncIterable<any> ? true : false;
type Expect<T extends true> = T;

type _OnEventIsSelectionFn = Expect<OnEvent extends (s: any) => any ? true : false>;
type _ResultIsAsyncIterable = Expect<IsAsyncIterable<AfterSelection>>;
type _OnEventIsNotZeroArgOnly = Expect<
    OnEvent extends () => any ? (OnEvent extends (s: any) => any ? true : false) : true
>;

export type _Asserts = [_OnEventIsSelectionFn, _ResultIsAsyncIterable, _OnEventIsNotZeroArgOnly];
