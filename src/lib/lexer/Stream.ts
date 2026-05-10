import type { Position } from "../../types.js";

/**
 * Code-point-aware character stream with O(1) advancement.
 *
 * Stores code points in a Array number[] ,
 * indexed by a pointer rather than mutating the array. This fixes
 * the O(n²) behaviour of the v1 stream which used Array.shift().
 */
export class Stream {
    private readonly codePoints: number[];
    private index = 0;
    private line = 1;
    private column = 1;

    public constructor(input: string) {
        // Array.from with iterator splits surrogate pairs into single code points,
        // so emoji and astral characters count as one column each.
        this.codePoints = new Array<number>(input.length);
        let written = 0;
        for (const ch of input) {
            const cp = ch.codePointAt(0);
            if (cp === undefined) continue;
            this.codePoints[written++] = cp;
        }
        // Trim if we over-allocated (string.length counts code units).
        if (written !== this.codePoints.length) {
            this.codePoints.length = written;
        }
    }

    public get length(): number {
        return this.codePoints.length;
    }

    public get position(): Position {
        return { line: this.line, column: this.column, offset: this.index };
    }

    /** Look at the current code point without consuming. -1 at EOF. */
    public peek(offset = 0): number {
        const i = this.index + offset;
        const cp = this.codePoints[i];
        return cp ?? -1;
    }

    /**
     * Look ahead and check whether the next `chars` match exactly (by code point).
     * Used for multi-character delimiter detection — replaces the v1 buffer-postfix dance.
     */
    public matches(chars: readonly number[]): boolean {
        if (this.index + chars.length > this.codePoints.length) return false;
        for (let i = 0; i < chars.length; i++) {
            if (this.codePoints[this.index + i] !== chars[i]) return false;
        }
        return true;
    }

    /** Consume one code point and return it. Returns -1 at EOF. */
    public advance(): number {
        if (this.index >= this.codePoints.length) return -1;
        const cp = this.codePoints[this.index];
        if (cp === undefined) return -1;
        this.index++;
        if (cp === 0x0a /* \n */) {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        return cp;
    }

    /** Consume `n` code points and return them as a string. */
    public advanceN(n: number): string {
        let out = "";
        for (let i = 0; i < n; i++) {
            const cp = this.advance();
            if (cp === -1) break;
            out += String.fromCodePoint(cp);
        }
        return out;
    }

    public eof(): boolean {
        return this.index >= this.codePoints.length;
    }
}
