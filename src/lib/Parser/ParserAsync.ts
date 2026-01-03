import {
    TokenType,
    NodeType,
    type ReadonlyToken,
    type TokenGenerator,
    type ArgumentNode,
    type Node,
    type ParserAsyncOptions,
    type LexerOptions,
    type TFunctionParserAsyncFn,
    type TVariableParserAsyncFn,
} from "../../types.js";
import { TagParseError, StrictModeError, type Position } from "../Errors.js";
import { Lexer } from "../Lexer.js";

type ParsedArgument = {
    arg: ArgumentNode | null;
    raw: string;
    endedWithTagEnd: boolean;
    endedWithEof: boolean;
};

/**
 * Async parser that mirrors Parser but awaits evaluation hooks.
 */
export class ParserAsync {
    private input!: TokenGenerator;
    private lexer!: Lexer;
    private nodes: Node[] = [];
    private stack: ReadonlyToken[] = [];
    private reachedEof = false;
    private currentPosition: Position = { line: 1, column: 1, offset: 0 };
    private readonly evaluateTags: boolean = false;
    private readonly strict: boolean = false;
    private readonly functionParser: TFunctionParserAsyncFn;
    private readonly variableParser: TVariableParserAsyncFn;
    private readonly lexerOptions: LexerOptions = {};

    public constructor(options?: ParserAsyncOptions) {
        this.evaluateTags = Boolean(options?.evaluateTags ?? options?.parseTags);
        this.strict = Boolean(options?.strict);
        this.lexerOptions = options?.lexerOptions ?? {};

        // Provide safe fallbacks so async evaluation is optional.
        this.functionParser =
            options?.functionParser ??
            (async () => {
                return "";
            });
        this.variableParser =
            options?.variableParser ??
            (async (name: string) => {
                return name;
            });
    }

    /**
     * Parse input string and return AST nodes (async evaluation supported).
     */
    public async parseAsync(input: string): Promise<Node[]> {
        this.nodes = [];
        this.stack = [];
        this.reachedEof = false;
        this.currentPosition = { line: 1, column: 1, offset: 0 };
        this.resetIterator(input);

        let buffer = "";

        for (const token of this.input) {
            this.currentPosition = token.position ?? this.currentPosition;

            if (token.type === TokenType.TagStart) {
                if (buffer.length) {
                    if (buffer.at(-1) === "\\") {
                        buffer = buffer.slice(0, -1) + token.value;
                        continue;
                    }

                    this.pushTextNode(buffer);
                    buffer = "";
                }

                const parsedTag = await this.parseTag();
                if (parsedTag.type === NodeType.Text) {
                    this.pushTextNode(parsedTag.value);
                } else {
                    this.nodes.push(parsedTag);
                }
            } else {
                buffer += token.value;
            }
        }

        if (buffer.length) {
            this.pushTextNode(buffer);
        }

        return this.nodes;
    }

    private pushTextNode(value: string): void {
        const lastNode = this.nodes.at(-1);
        if (lastNode?.type === NodeType.Text) {
            lastNode.value += value;
        } else {
            this.nodes.push({ type: NodeType.Text, value });
        }
    }

    private async parseTag(): Promise<Node> {
        let nameToken: ReadonlyToken;
        let nextToken: ReadonlyToken;

        if (this.strict) {
            nameToken = this.nextToken();
            if (nameToken.type === TokenType.Space) {
                throw new StrictModeError(
                    "Tags cannot contain spaces. Escape them or disable strict mode.",
                    nameToken.position,
                );
            }

            if (nameToken.type !== TokenType.Literal) {
                throw new StrictModeError(
                    "Tags must start with a literal character and not be empty.",
                    nameToken.position,
                );
            }

            nextToken = this.nextToken();

            if (nextToken.type === TokenType.Space) {
                throw new StrictModeError(
                    "Tags cannot contain spaces. Escape them or disable strict mode.",
                    nextToken.position,
                );
            }
        } else {
            nameToken = this.skip(TokenType.Space);
            nextToken = this.skip(TokenType.Space);
        }

        const name = nameToken.value;

        switch (nextToken.type) {
            case TokenType.TagEnd: {
                if (name === "") {
                    if (this.strict) {
                        throw new StrictModeError(
                            "Empty tags are not allowed.",
                            nextToken.position,
                        );
                    }

                    return { type: NodeType.Text, value: "" };
                }

                if (!this.evaluateTags) {
                    return { type: NodeType.Variable, raw: name };
                }

                const value = await this.variableParser(name);
                return {
                    type: NodeType.Variable,
                    raw: name,
                    value,
                };
            }

            case TokenType.Colon: {
                const { args, closed, raw } = await this.parseFunctionArguments();
                if (!closed) {
                    return {
                        type: NodeType.Text,
                        value: `${this.lexer.tagStart}${name}:${raw}`,
                    };
                }

                if (args.length === 0 && this.strict) {
                    throw new StrictModeError(
                        "Expected at least one argument for the tag payload.",
                        nextToken.position,
                    );
                }

                if (!this.evaluateTags) {
                    return { type: NodeType.Function, name, args };
                }

                const value = await this.functionParser(name, args);
                return {
                    type: NodeType.Function,
                    name,
                    args,
                    value,
                };
            }

            default: {
                if (this.strict) {
                    throw new StrictModeError(
                        "Unexpected token encountered within tag. Escape it or disable strict mode.",
                        nextToken.position,
                    );
                }

                return {
                    type: NodeType.Text,
                    value: `${this.lexer.tagStart}${name}${nextToken.value}`,
                };
            }
        }
    }

    private async parseFunctionArguments(): Promise<{
        args: ArgumentNode[];
        closed: boolean;
        raw: string;
    }> {
        const args: ArgumentNode[] = [];
        let closed = false;
        let raw = "";

        while (true) {
            const part = await this.parseArgument();
            if (!part) break;

            raw += part.raw;

            if (part.arg) {
                if (this.evaluateTags) {
                    part.arg.finalValue = await this.resolveNodesToString(
                        part.arg.nodes,
                    );
                }
                args.push(part.arg);
            }

            if (part.endedWithTagEnd) {
                closed = true;
                break;
            }

            if (part.endedWithEof) {
                break;
            }
        }

        if (closed) {
            this.stack.pop();
        }

        return { args, closed, raw };
    }

    private async parseArgument(): Promise<ParsedArgument | null> {
        const argNodes: Node[] = [];
        let buffer = "";
        let raw = "";
        let endedWithTagEnd = false;
        let endedWithEof = false;

        while (true) {
            const token = this.nextToken();
            const escaped = buffer.length > 0 && buffer.at(-1) === "\\";

            if (token.type === TokenType.Pipe) {
                raw += token.value;
                if (escaped) {
                    buffer = buffer.slice(0, -1) + token.value;
                    continue;
                }
                break;
            } else if (token.type === TokenType.TagEnd) {
                raw += token.value;
                if (escaped) {
                    buffer = buffer.slice(0, -1) + token.value;
                    continue;
                }

                this.stack.push(token);
                endedWithTagEnd = true;
                break;
            } else if (token.type === TokenType.TagStart) {
                raw += token.value;
                if (escaped) {
                    buffer = buffer.slice(0, -1) + token.value;
                    continue;
                }

                if (buffer.length) {
                    argNodes.push({
                        type: NodeType.Text,
                        value: buffer,
                    });
                    buffer = "";
                }

                const parsed = await this.parseTag();
                argNodes.push(parsed);
            } else {
                buffer += token.value;
                raw += token.value;

                if (token.type === TokenType.Literal && token.value === "") {
                    endedWithEof = this.reachedEof;
                    if (endedWithEof) {
                        break;
                    }
                }
            }
        }

        if (buffer.length) {
            argNodes.push({ type: NodeType.Text, value: buffer });
        }

        return {
            arg: argNodes.length
                ? { type: NodeType.Argument, nodes: argNodes }
                : null,
            raw,
            endedWithTagEnd,
            endedWithEof,
        };
    }

    private nextToken(): ReadonlyToken {
        if (this.stack.length) {
            return this.stack.pop() as ReadonlyToken;
        }

        const { done, value } = this.input.next();

        if (done || !value) {
            this.reachedEof = true;
            if (this.strict) {
                throw new TagParseError(
                    "Unexpected end of input",
                    this.currentPosition,
                );
            }

            return { type: TokenType.Literal, value: "" };
        }

        this.reachedEof = false;
        this.currentPosition = value.position ?? this.currentPosition;
        return value;
    }

    private skip(omitType: TokenType): ReadonlyToken {
        let token: ReadonlyToken;
        do {
            token = this.nextToken();
        } while (token.type === omitType);
        return token;
    }

    private resetIterator(source: string): void {
        this.lexer = new Lexer(source, this.lexerOptions);
        this.input = this.lexer[Symbol.iterator]();
    }

    private async resolveNodesToString(nodes: Node[]): Promise<string> {
        let result = "";
        for (const node of nodes) {
            if ("value" in node) {
                const maybeValue = (node as { value?: unknown }).value;
                result += String(maybeValue ?? "");
            }
        }
        return result;
    }
}
