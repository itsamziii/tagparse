import {
    TokenType,
    type LexerOptions,
    type Token,
    type TokenGenerator,
} from "../types.js";
import { getCharPoint } from "../utils.js";
import type { Position } from "./Errors.js";
import { Stream } from "./Stream.js";

export class Lexer {
    private tokens: Token[] = [];

    private buffer: string = "";

    private bufferStartPosition: Position | null = null;

    public readonly tagStart: string;

    public readonly tagEnd: string;

    private readonly tagStartChars: string[];

    private readonly tagEndChars: string[];

    private readonly stream: Stream;

    public constructor(input: string, { tagEnd, tagStart }: LexerOptions = {}) {
        this.stream = new Stream(input);
        this.tagStart = tagStart?.length ? tagStart : "{";
        this.tagEnd = tagEnd?.length ? tagEnd : "}";
        this.tagStartChars = Array.from(this.tagStart);
        this.tagEndChars = Array.from(this.tagEnd);
    }

    /**
     * Sync iterator for tokenization
     */
    public *[Symbol.iterator](): TokenGenerator {
        while (this.stream.next()) {
            const peekedChar = this.stream.peek();
            const char =
                peekedChar === -1 ? "" : String.fromCodePoint(peekedChar);
            const position = this.stream.getPosition();

            // Track buffer start position
            if (this.buffer.length === 0) {
                this.bufferStartPosition = position;
            }

            switch (peekedChar) {
                case getCharPoint(this.tagStartChars.at(-1) as string): {
                    yield* this.handleTagStart(char, position);
                    break;
                }

                case getCharPoint(":"): {
                    yield* this.addToken({
                        type: TokenType.Colon,
                        value: ":",
                        position,
                    });
                    break;
                }

                case getCharPoint("|"): {
                    yield* this.addToken({
                        type: TokenType.Pipe,
                        value: "|",
                        position,
                    });
                    break;
                }

                case getCharPoint(this.tagEndChars.at(-1) as string): {
                    yield* this.handleTagEnd(char, position);
                    break;
                }

                case getCharPoint(" "): {
                    yield* this.addToken({
                        type: TokenType.Space,
                        value: " ",
                        position,
                    });
                    break;
                }

                default: {
                    if (this.buffer.length === 0) {
                        this.bufferStartPosition = position;
                    }
                    this.buffer += char;
                }
            }
        }

        yield* this.flush();
    }

    private *handleTagStart(char: string, position: Position): TokenGenerator {
        const tagStartLength = this.tagStartChars.length;
        if (tagStartLength > 1) {
            const leftOutTagStart = this.tagStartChars.slice(0, -1).join("");
            if (this.buffer.endsWith(leftOutTagStart)) {
                this.buffer = this.buffer.slice(0, -leftOutTagStart.length);
                yield* this.addToken({
                    type: TokenType.TagStart,
                    value: this.tagStart,
                    position: {
                        ...position,
                        column: position.column - leftOutTagStart.length,
                        offset: position.offset - leftOutTagStart.length,
                    },
                });
            } else {
                if (this.buffer.length === 0) {
                    this.bufferStartPosition = position;
                }
                this.buffer += char;
            }
        } else {
            yield* this.addToken({
                type: TokenType.TagStart,
                value: this.tagStart,
                position,
            });
        }
    }

    private *handleTagEnd(char: string, position: Position): TokenGenerator {
        const tagEndLength = this.tagEndChars.length;
        if (tagEndLength > 1) {
            const leftOutTagEnd = this.tagEndChars.slice(0, -1).join("");
            if (this.buffer.endsWith(leftOutTagEnd)) {
                this.buffer = this.buffer.slice(0, -leftOutTagEnd.length);
                yield* this.addToken({
                    type: TokenType.TagEnd,
                    value: this.tagEnd,
                    position: {
                        ...position,
                        column: position.column - leftOutTagEnd.length,
                        offset: position.offset - leftOutTagEnd.length,
                    },
                });
            } else {
                if (this.buffer.length === 0) {
                    this.bufferStartPosition = position;
                }
                this.buffer += char;
            }
        } else {
            yield* this.addToken({
                type: TokenType.TagEnd,
                value: this.tagEnd,
                position,
            });
        }
    }

    private *addToken(token: Token): TokenGenerator {
        yield* this.flush();
        this.tokens.push(token);
        yield token;
    }

    private *flush(): TokenGenerator {
        if (this.buffer.length) {
            const token: Token = {
                type: TokenType.Literal,
                value: this.buffer,
                position: this.bufferStartPosition ?? undefined,
            };

            this.tokens.push(token);
            this.buffer = "";
            this.bufferStartPosition = null;
            yield token;
        }
    }

    /**
     * Get the current position in the stream
     */
    public getPosition(): Position {
        return this.stream.getPosition();
    }
}
