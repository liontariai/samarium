import type { GenContext } from "../gen/context.ts";
import {
    ARG_NAMES,
    CUSTOM_SCALARS,
    DESCRIPTIONS,
    ENUM_NAMES,
    ENUM_VALUES,
    FIELD_NAMES,
    INPUT_NAMES,
    INTERFACE_NAMES,
    TS_RESERVED,
    TYPE_NAMES,
    UNION_NAMES,
} from "./banks.ts";

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isSafeId(name: string, codegenSafe: boolean): boolean {
    if (!NAME_RE.test(name)) return false;
    if (!codegenSafe) return true;
    return !TS_RESERVED.has(name);
}

function pickUnused(ctx: GenContext, pool: readonly string[], used: Set<string>): string {
    const filtered = pool.filter((n) => isSafeId(n, ctx.codegenSafeIds));
    const source = filtered.length ? filtered : pool.slice();
    const left = source.filter((x) => !used.has(x));
    const pickFrom = left.length ? left : source;
    const picked = ctx.rng.pick(pickFrom);
    used.add(picked);
    return picked;
}

export function pickTypeName(ctx: GenContext, used: Set<string>, suffix = ""): string {
    if (ctx.rng.bool(0.08)) {
        const n = `Type${ctx.rng.int(1, 999)}${suffix}`;
        if (!used.has(n) && isSafeId(n, ctx.codegenSafeIds)) {
            used.add(n);
            return n;
        }
    }
    const base = pickUnused(ctx, TYPE_NAMES, used);
    return suffix ? `${base}${suffix}` : base;
}

export function pickFieldName(ctx: GenContext, used: Set<string>): string {
    if (ctx.rng.bool(0.1)) {
        const n = `field${used.size + 1}`;
        used.add(n);
        return n;
    }
    return pickUnused(ctx, FIELD_NAMES, used);
}

export function pickArgName(ctx: GenContext, used: Set<string>): string {
    return pickUnused(ctx, ARG_NAMES, used);
}

export function pickEnumName(ctx: GenContext, used: Set<string>): string {
    return pickUnused(ctx, ENUM_NAMES, used);
}

export function pickEnumValue(ctx: GenContext, used: Set<string>): string {
    return pickUnused(ctx, ENUM_VALUES, used);
}

export function pickInputName(ctx: GenContext, used: Set<string>): string {
    if (ctx.rng.bool(0.3)) {
        const n = `${pickTypeName(ctx, new Set(), "")}Input`;
        if (!used.has(n)) {
            used.add(n);
            return n;
        }
    }
    return pickUnused(ctx, INPUT_NAMES, used);
}

export function pickInterfaceName(ctx: GenContext, used: Set<string>): string {
    return pickUnused(ctx, INTERFACE_NAMES, used);
}

export function pickUnionName(ctx: GenContext, used: Set<string>): string {
    return pickUnused(ctx, UNION_NAMES, used);
}

export function pickCustomScalar(ctx: GenContext, used: Set<string>): string {
    return pickUnused(ctx, CUSTOM_SCALARS, used);
}

export function pickDescription(ctx: GenContext): string {
    return ctx.rng.pick(DESCRIPTIONS);
}
