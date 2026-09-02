/** Mulberry32 PRNG. Deterministic given a 32-bit seed. */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class Rng {
    private readonly nextFloat: () => number;

    constructor(seed: number) {
        this.nextFloat = mulberry32(seed);
    }

    /** Uniform in [0, 1). */
    next(): number {
        return this.nextFloat();
    }

    bool(p = 0.5): boolean {
        return this.next() < p;
    }

    /** Inclusive integer range. */
    int(min: number, max: number): number {
        if (max < min) return min;
        return min + Math.floor(this.next() * (max - min + 1));
    }

    pick<T>(items: readonly T[]): T {
        if (items.length === 0) {
            throw new Error("Rng.pick: empty array");
        }
        return items[this.int(0, items.length - 1)]!;
    }

    maybePick<T>(items: readonly T[]): T | undefined {
        if (items.length === 0) return undefined;
        return this.pick(items);
    }

    shuffle<T>(items: readonly T[]): T[] {
        const out = items.slice();
        for (let i = out.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            const tmp = out[i]!;
            out[i] = out[j]!;
            out[j] = tmp;
        }
        return out;
    }

    /** Sample k distinct items (or all if k >= length). */
    sample<T>(items: readonly T[], k: number): T[] {
        return this.shuffle(items).slice(0, Math.max(0, Math.min(k, items.length)));
    }
}
