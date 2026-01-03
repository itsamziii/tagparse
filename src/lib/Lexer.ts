import {
    TokenType,
    type LexerOptions,
    type Token,
    type TokenGenerator,
} from "../types.js";
import { getCharPoint } from "../utils.js";
import { Stream } from "./Stream.js";

export class Lexer {
    private tokens: Token[] = [];

    private buffer: string = "";

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

    public async *[Symbol.asyncIterator](): TokenGenerator {
        while (await this.stream.next()) {
            const peekedChar = this.stream.peek();
            const char =
                peekedChar === -1 ? "" : String.fromCodePoint(peekedChar);

            switch (peekedChar) {
                case getCharPoint(
                    this.tagStartChars.at(-1) as string,
                ): {
                    yield* this.handleTagStart(char);
                    break;
                }

                case getCharPoint(":"): {
                    yield* this.addToken({
                        type: TokenType.Colon,
                        value: ":",
                    });

                    break;
                }

                case getCharPoint("|"): {
                    yield* this.addToken({
                        type: TokenType.Pipe,
                        value: "|",
                    });
                    break;
                }

                case getCharPoint(
                    this.tagEndChars.at(-1) as string,
                ): {
                    yield* this.handleTagEnd(char);
                    break;
                }

                case getCharPoint(" "): {
                    yield* this.addToken({
                        type: TokenType.Space,
                        value: " ",
                    });
                    break;
                }

                default: {
                    this.buffer += char;
                }
            }
        }

        yield* this.flush();
    }

    private async *handleTagStart(char: string): TokenGenerator {
        const tagStartLength = this.tagStartChars.length;
        if (tagStartLength > 1) {
            const leftOutTagStart = this.tagStartChars
                .slice(0, -1)
                .join("");
            if (this.buffer.endsWith(leftOutTagStart)) {
                this.buffer = this.buffer.slice(0, -leftOutTagStart.length);
                yield* this.addToken({
                    type: TokenType.TagStart,
                    value: this.tagStart,
                });
            } else {
                this.buffer += char;
            }
        } else {
            yield* this.addToken({
                type: TokenType.TagStart,
                value: this.tagStart,
            });
        }
    }

    private async *handleTagEnd(char: string): TokenGenerator {
        const tagEndLength = this.tagEndChars.length;
        if (tagEndLength > 1) {
            const leftOutTagEnd = this.tagEndChars.slice(0, -1).join("");
            if (this.buffer.endsWith(leftOutTagEnd)) {
                this.buffer = this.buffer.slice(0, -leftOutTagEnd.length);
                yield* this.addToken({
                    type: TokenType.TagEnd,
                    value: this.tagEnd,
                });
            } else {
                this.buffer += char;
            }
        } else {
            yield* this.addToken({
                type: TokenType.TagEnd,
                value: this.tagEnd,
            });
        }
    }

    private async *addToken(token: Token): TokenGenerator {
        yield* this.flush();
        this.tokens.push(token);
        yield token;
    }

    private async *flush(): TokenGenerator {
        if (this.buffer.length) {
            const token: Token = {
                type: TokenType.Literal,
                value: this.buffer,
            };

            this.tokens.push(token);
            this.buffer = "";
            yield token;
        }
    }
}
