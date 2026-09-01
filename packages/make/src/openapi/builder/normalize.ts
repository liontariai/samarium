const TYPEDEF_RE = /@typedef\s*{(.*)}/;
const TYPE_RE = /@type\s*{(.*)}/;

export function parseTypescriptTypeFromDescription(description: string | undefined): string | undefined {
    if (!description) return undefined;
    const typedef = description.match(TYPEDEF_RE)?.[1];
    if (typedef) return typedef.trim();
    const atType = description.match(TYPE_RE)?.[1];
    if (atType) return atType.trim();
    return undefined;
}