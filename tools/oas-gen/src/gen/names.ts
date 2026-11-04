import type { GenContext } from "./context.ts";

export { camel, resourcePath, pickPingPath } from "../lexicon/index.ts";

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
