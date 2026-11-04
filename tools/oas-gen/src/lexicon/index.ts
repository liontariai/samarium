import { RESERVED_HEADER_NAMES } from "../dialects/index.ts";
import type { GenContext } from "../gen/context.ts";
import {
    COOKIE_NAMES,
    DESCRIPTIONS,
    HEADER_NAMES,
    NESTED_SEGMENTS,
    PATH_PARAMS,
    PING_PATHS,
    PING_PATHS_DOTTED,
    PROPERTIES,
    QUERY_PARAMS,
    RESOURCES,
    VERBS,
    type NamedHint,
} from "./banks.ts";

const CODEGEN_SAFE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESOURCE_SAFE = /^[A-Z][A-Za-z0-9_]*$/;

function filterSafe<T extends string>(items: readonly T[], ok: (s: string) => boolean, requireSafe: boolean): T[] {
    if (!requireSafe) return items.slice() as T[];
    const next = items.filter((x) => ok(x));
    return (next.length ? next : items.slice()) as T[];
}

function pickUnused(ctx: GenContext, pool: string[], used: Set<string>): string {
    const left = pool.filter((x) => !used.has(x));
    const source = left.length ? left : pool;
    const picked = ctx.rng.pick(source);
    used.add(picked);
    return picked;
}

export function pickResource(ctx: GenContext, used: Set<string>): string {
    if (ctx.rng.bool(0.08)) {
        const n = `Model${ctx.rng.int(1, 999)}`;
        if (!used.has(n)) {
            used.add(n);
            return n;
        }
    }
    const pool = filterSafe(RESOURCES, (s) => RESOURCE_SAFE.test(s), ctx.codegenSafeIds);
    return pickUnused(ctx, pool, used);
}

export function pickProperty(ctx: GenContext, used: Set<string>): NamedHint {
    if (ctx.rng.bool(0.1)) {
        const name = `field${used.size + 1}`;
        used.add(name);
        return { name, type: ctx.rng.pick(["string", "integer", "boolean"]) };
    }
    const pool = ctx.codegenSafeIds ? PROPERTIES.filter((p) => CODEGEN_SAFE.test(p.name)) : PROPERTIES;
    const left = pool.filter((p) => !used.has(p.name));
    const source = left.length ? left : pool;
    const picked = ctx.rng.pick(source);
    used.add(picked.name);
    return picked;
}

export function pickQuery(ctx: GenContext, used: Set<string>): NamedHint {
    if (ctx.rng.bool(0.1)) {
        const name = `q${used.size + 1}`;
        used.add(name);
        return { name, type: ctx.rng.pick(["string", "integer", "boolean"]) };
    }
    const pool = ctx.codegenSafeIds ? QUERY_PARAMS.filter((p) => CODEGEN_SAFE.test(p.name)) : QUERY_PARAMS;
    const left = pool.filter((p) => !used.has(p.name));
    const source = left.length ? left : pool;
    const picked = ctx.rng.pick(source);
    used.add(picked.name);
    return picked;
}

export function pickPathParam(ctx: GenContext, used: Set<string>): string {
    const pool = filterSafe(PATH_PARAMS, (s) => CODEGEN_SAFE.test(s), ctx.codegenSafeIds);
    return pickUnused(ctx, pool, used);
}

export function pickHeader(ctx: GenContext, used: Set<string>): string {
    const pool = HEADER_NAMES.filter((h) => !RESERVED_HEADER_NAMES.has(h.toLowerCase()));
    return pickUnused(ctx, [...pool], used);
}

export function pickCookie(ctx: GenContext, used: Set<string>): string {
    const pool = filterSafe(COOKIE_NAMES, (s) => CODEGEN_SAFE.test(s), ctx.codegenSafeIds);
    return pickUnused(ctx, pool, used);
}

export function pickVerb(ctx: GenContext): string {
    return ctx.rng.pick([...VERBS]);
}

export function pickNestedSegment(ctx: GenContext, used: Set<string>): string {
    return pickUnused(ctx, [...NESTED_SEGMENTS], used);
}

export function pickDescription(ctx: GenContext): string {
    return ctx.rng.pick([...DESCRIPTIONS]);
}

export function pickPingPath(ctx: GenContext, dotted: boolean): string {
    return dotted ? ctx.rng.pick([...PING_PATHS_DOTTED]) : ctx.rng.pick([...PING_PATHS]);
}

export function kebab(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
}

export function pluralize(segment: string): string {
    if (segment.endsWith("s")) return segment;
    if (/[^aeiou]y$/i.test(segment)) return `${segment.slice(0, -1)}ies`;
    return `${segment}s`;
}

export function resourcePath(name: string, dotted = false): string {
    const base = kebab(name);
    if (dotted) return `/${base}-list`;
    return `/${pluralize(base)}`;
}

export function camel(verb: string, name: string): string {
    return verb + name;
}
