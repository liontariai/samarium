import { createHash } from "node:crypto";

export function hashText(text: string): string {
    return createHash("sha256").update(text).digest("hex").slice(0, 16);
}
