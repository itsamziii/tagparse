import type { LexerOptions, Position, Span, Token } from "../../types.js";
import { TokenKind } from "../../types.js";
import { Stream } from "./Stream.js";

const DEFAULT_TAG_START = "{";
const DEFAULT_TAG_END = "}";
const DEFAULT_ESCAPE = "\\";

function requiredCodePoint(value: string): number {
    const cp = value.codePointAt(0);
    if (cp === undefined) {
        throw new Error("Expected non-empty string for code point extraction");
    }
    return cp;
}

/**
 * Tokenizes an input string into a flat token stream.
 *
 * Differences from v1:
 *   - O(n) instead of O(n²) (index-based stream).
 *   - Escape character (\) suppresses the next delimiter at the lexer level,
 *     not after the fact in the parser. So `\{` always becomes a literal "{".
 *   - Multi-char delimiters via prefix match on the Stream, not buffer postfix.
 */
export class Lexer implements Iterable<Token> {
    public readonly tagStart: string;
    public readonly tagEnd: string;
    public readonly escapeChar: string;

    private readonly tagStartCps: readonly number[];
    private readonly tagEndCps: readonly number[];
    private readonly escapeCp: number;

    public constructor(
        private readonly input: string,
        options: LexerOptions = {},
    ) {
        this.tagStart = options.tagStart ?? DEFAULT_TAG_START;
        this.tagEnd = options.tagEnd ?? DEFAULT_TAG_END;
        this.escapeChar = options.escapeChar ?? DEFAULT_ESCAPE;

        if (this.tagStart.length === 0)
            throw new Error("tagStart cannot be empty");
        if (this.tagEnd.length === 0) throw new Error("tagEnd cannot be empty");
        if (this.escapeChar.length !== 1)
            throw new Error("escapeChar must be exactly one character");

        this.tagStartCps = [...this.tagStart].map((c) => requiredCodePoint(c));
        this.tagEndCps = [...this.tagEnd].map((c) => requiredCodePoint(c));
        this.escapeCp = requiredCodePoint(this.escapeChar);
    }

    public *[Symbol.iterator](): IterableIterator<Token> {
        const stream = new Stream(this.input);
        let tagDepth = 0; // supports nested tags

        while (!stream.eof()) {
            const start = stream.position;
            const cp = stream.peek();

            // Escape: copy next code point literally as text, regardless of context.
            if (cp === this.escapeCp) {
                stream.advance(); // consume escape
                if (stream.eof()) {
                    // Trailing escape — emit it as text.
                    yield textToken(this.escapeChar, start, stream.position);
                    break;
                }
                const escapedStart = stream.position;
                const escaped = stream.advance();
                yield textToken(
                    String.fromCodePoint(escaped),
                    escapedStart,
                    stream.position,
                );
                continue;
            }

            // Multi-character delimiter detection.
            if (stream.matches(this.tagStartCps)) {
                const value = stream.advanceN(this.tagStartCps.length);
                yield {
                    kind: TokenKind.TagStart,
                    value,
                    span: spanOf(start, stream.position),
                };
                tagDepth++;
                continue;
            }

            if (tagDepth > 0 && stream.matches(this.tagEndCps)) {
                const value = stream.advanceN(this.tagEndCps.length);
                yield {
                    kind: TokenKind.TagEnd,
                    value,
                    span: spanOf(start, stream.position),
                };
                tagDepth--;
                continue;
            }

            // Inside a tag: colon/pipe are structural.
            if (tagDepth > 0) {
                if (cp === 0x3a /* : */) {
                    stream.advance();
                    yield {
                        kind: TokenKind.Colon,
                        value: ":",
                        span: spanOf(start, stream.position),
                    };
                    continue;
                }
                if (cp === 0x7c /* | */) {
                    stream.advance();
                    yield {
                        kind: TokenKind.Pipe,
                        value: "|",
                        span: spanOf(start, stream.position),
                    };
                    continue;
                }
            }

            // Plain text run — collect until we hit something special.
            const runStart = stream.position;
            let run = "";
            while (!stream.eof()) {
                const c = stream.peek();
                if (c === this.escapeCp) break;
                if (stream.matches(this.tagStartCps)) break;
                if (tagDepth > 0) {
                    if (stream.matches(this.tagEndCps)) break;
                    if (c === 0x3a /* : */ || c === 0x7c /* | */) break;
                }
                stream.advance();
                run += String.fromCodePoint(c);
            }
            if (run.length > 0) {
                yield textToken(run, runStart, stream.position);
            }
        }

        yield {
            kind: TokenKind.EOF,
            value: "",
            span: { start: stream.position, end: stream.position },
        };
    }
}

function textToken(value: string, start: Position, end: Position): Token {
    return { kind: TokenKind.Text, value, span: { start, end } };
}

function spanOf(start: Position, end: Position): Span {
    return { start, end };
}
