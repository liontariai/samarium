/**
 * Compile-time check: user augmentation of ScalarTypeMapWithCustom.JToken
 * must replace the generated `any` default (not intersect with it).
 */
import type { JToken } from "./examples/custom-scalars.generated";

declare module "./examples/custom-scalars.generated" {
    interface ScalarTypeMapWithCustom {
        JToken: { myCustomField: string };
    }
}

type IsAny<T> = 0 extends 1 & T ? true : false;
type Expect<T extends true> = T;

type _JTokenIsNotAny = Expect<IsAny<JToken> extends true ? false : true>;
type _JTokenIsUserType = Expect<JToken extends { myCustomField: string } ? true : false>;
type _UserTypeIsJToken = Expect<{ myCustomField: string } extends JToken ? true : false>;

export type _Asserts = [_JTokenIsNotAny, _JTokenIsUserType, _UserTypeIsJToken];
