import type { Position } from "./Errors.js";

/**
 * Character stream with position tracking for parsing.
 * Handles Unicode code points correctly (not UTF-16 code units).
 */
export class Stream {
    /**
     * Stores code points (not UTF-16 code units) to correctly support
     * multi-byte characters such as emoji or non-Latin scripts.
     */
    private readonly buffer: number[];

    /**
     * Current code point (-1 if no current character)
     */
    private currentCodePoint: number = -1;

    /**
     * Current line number (1-based)
     */
    private line: number = 1;

    /**
     * Current column number (1-based)
     */
    private column: number = 1;

    /**
     * Character offset from start (0-based)
     */
    private offset: number = 0;

    /**
     * Whether we've started consuming characters
     */
    private started: boolean = false;

    public constructor(str: string) {
        this.buffer = Array.from(str, (char) => char.codePointAt(0)!);
    }

    /**
     * Returns the current code point being processed.
     * Returns -1 if no character is available.
     */
    public peek(): number {
        return this.currentCodePoint;
    }

    /**
     * Returns the current position in the stream.
     */
    public getPosition(): Position {
        return {
            line: this.line,
            column: this.column,
            offset: this.offset,
        };
    }

    /**
     * Advances to the next character in the stream.
     *
     * @returns true if a character was consumed, false if at end of input
     */
    public next(): boolean {
        if (this.buffer.length === 0) {
            this.currentCodePoint = -1;
            return false;
        }

        // Update position based on the previous character (if any)
        if (this.started && this.currentCodePoint !== -1) {
            this.offset++;
            if (this.currentCodePoint === 0x0a) {
                // newline
                this.line++;
                this.column = 1;
            } else {
                this.column++;
            }
        }

        this.started = true;
        this.currentCodePoint = this.buffer.shift()!;
        return true;
    }

    /**
     * Returns true if the stream has more characters.
     */
    public hasMore(): boolean {
        return this.buffer.length > 0;
    }

    /**
     * Returns the total length of the original input.
     */
    public get length(): number {
        return (
            this.offset +
            this.buffer.length +
            (this.currentCodePoint === -1 ? 0 : 1)
        );
    }
}
