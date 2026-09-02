import type { GenContext } from "./context.ts";

const RESOURCES = [
    "Item",
    "Book",
    "User",
    "Pet",
    "Order",
    "Widget",
    "Asset",
    "Ticket",
    "Event",
    "Post",
    "Device",
    "Invoice",
    "Task",
    "Note",
] as const;

const PING_PATHS = ["/ping", "/health", "/status", "/ready"] as const;

export function pickResource(ctx: GenContext, used: Set<string>): string {
    const left = RESOURCES.filter((r) => !used.has(r));
    const pool = left.length ? left : RESOURCES.slice();
    return ctx.rng.pick(pool);
}

export function resourcePath(name: string, dotted = false): string {
    const base = name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    if (dotted) return `/${base}s`;
    return `/${base.toLowerCase()}s`;
}

export function camel(verb: string, name: string): string {
    return verb + name;
}

export function pickPingPath(ctx: GenContext, dotted: boolean): string {
    if (dotted) return ctx.rng.pick(["/health-check", "/v1.0/ping", "/readyz"]);
    return ctx.rng.pick([...PING_PATHS]);
}

export function uniqueOperationId(ctx: GenContext, base: string): string {
    let id = ctx.codegenSafeIds ? base.replace(/[^A-Za-z0-9_]/g, "_") : base;
    if (!id) id = "op";
    if (!ctx.operationIds.has(id)) {
        ctx.operationIds.add(id);
        return id;
    }
    let n = 2;
    while (ctx.operationIds.has(`${id}_${n}`)) n++;
    const next = `${id}_${n}`;
    ctx.operationIds.add(next);
    return next;
}

export function sanitizeComponentKey(name: string): string {
    const s = name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    return s.length ? s : "X";
}

const PROP_NAMES = ["id", "name", "title", "status", "count", "active", "label", "code", "value", "notes"] as const;

export function pickPropName(ctx: GenContext, used: Set<string>): string {
    const left = PROP_NAMES.filter((p) => !used.has(p));
    if (left.length) return ctx.rng.pick(left);
    return `field${used.size + 1}`;
}
