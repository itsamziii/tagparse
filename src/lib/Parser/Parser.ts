import {
    TokenType,
    NodeType,
    type ReadonlyToken,
    type TokenGenerator,
    type ArgumentNode,
    type Node,
    type ParserOptions,
    type LexerOptions,
    type ParseResult,
} from "../../types.js";
import { TagParseError, StrictModeError, type Position } from "../Errors.js";
import { Lexer } from "../Lexer.js";
import { FunctionTagParser } from "./TagParsers/FunctionTagParser.js";
import { VariableTagParser } from "./TagParsers/VariableTagParser.js";

export class Parser {
    private input!: TokenGenerator;

    private lexer!: Lexer;

    private nodes: ParseResult[] = [];

    private stack: ReadonlyToken[] = [];

    private reachedEof: boolean = false;

    private currentPosition: Position = { line: 1, column: 1, offset: 0 };

    private readonly evaluateTags: boolean = false;

    /**
     * Strict mode rules:
     * - No empty tags allowed, i.e. "\{\}" will throw an error
     * - No spaces within function tag names or variable tags
     * - All tags are expected to end, reaching end of input before the end of tag will throw an error
     * - All tags should start with tagStart (default "\{") and end with "\}"
     * - You are expected to supply at least one argument to function tags
     */
    private readonly strict: boolean = false;

    private readonly functionParser?: FunctionTagParser;

    private readonly variableParser?: VariableTagParser;

    private readonly lexerOptions: LexerOptions = {};

    public constructor(options?: ParserOptions) {
        // Support both evaluateTags (new) and parseTags (deprecated)
        this.evaluateTags = Boolean(
            options?.evaluateTags ?? options?.parseTags,
        );
        this.strict = Boolean(options?.strict);
        this.lexerOptions = options?.lexerOptions ?? {};

        if (this.evaluateTags) {
            if (
                typeof options?.functionParser !== "function" ||
                typeof options?.variableParser !== "function"
            ) {
                throw new TagParseError(
                    "Function and variable parser functions must be provided when `evaluateTags` is enabled",
                );
            }

            this.functionParser = new FunctionTagParser(options.functionParser);
            this.variableParser = new VariableTagParser(options.variableParser);
        }
    }

    /**
     * Parse input string and return AST nodes.
     * Sync in v2.
     */
    public parse(input: string): ParseResult[] {
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
                    // Check if the last character is an escape character
                    if (buffer.at(-1) === "\\") {
                        buffer = buffer.slice(0, -1) + token.value;
                        continue;
                    }

                    this.pushTextNode(buffer);
                    buffer = "";
                }

                const parsedTag = this.parseTag();
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

    private parseTag(): ParseResult {
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

        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
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

                return this.evaluateTags
                    ? this.variableParser!.parse(name)
                    : { type: NodeType.Variable, raw: name };
            }

            case TokenType.Colon: {
                const { args, closed, raw } = this.parseFunctionArguments();
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

                return this.evaluateTags
                    ? this.functionParser!.parse(name, args)
                    : { type: NodeType.Function, name, args };
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

    private parseFunctionArguments(): {
        args: ArgumentNode[];
        closed: boolean;
        raw: string;
    } {
        const args: ArgumentNode[] = [];
        let closed = false;
        let raw = "";

        while (true) {
            const part = this.parseArgument();
            if (!part) {
                break;
            }

            raw += part.raw;

            if (part.arg) {
                if (this.evaluateTags) {
                    part.arg.finalValue = part.arg.nodes.reduce((acc, node) => {
                        if (!("value" in node)) {
                            return acc;
                        }

                        const value = node.value;
                        if (
                            typeof value === "string" ||
                            typeof value === "number" ||
                            typeof value === "boolean"
                        ) {
                            return acc + String(value);
                        }

                        return acc;
                    }, "");
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
            // Remove the tagEnd token from the stack
            this.stack.pop();
        }

        return { args, closed, raw };
    }

    private parseArgument(): {
        arg: ArgumentNode | null;
        endedWithEof: boolean;
        endedWithTagEnd: boolean;
        raw: string;
    } | null {
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
                if (escaped) {
                    raw += token.value;
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

                const parsed = this.parseTag();
                argNodes.push(parsed);
                raw += this.serializeParsedNodeToRaw(parsed);
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

    private serializeNodesToRaw(nodes: Node[]): string {
        return nodes
            .map((node) => {
                switch (node.type) {
                    case NodeType.Text:
                        return node.value;
                    case NodeType.Variable:
                        return `${this.lexer.tagStart}${node.raw}${this.lexer.tagEnd}`;
                    case NodeType.Function:
                        return `${this.lexer.tagStart}${node.name}:${node.args
                            .map((arg) => this.serializeNodesToRaw(arg.nodes))
                            .join("|")}${this.lexer.tagEnd}`;
                    default:
                        return "";
                }
            })
            .join("");
    }

    private serializeParsedNodeToRaw(node: ParseResult): string {
        return this.serializeNodesToRaw([node as Node]);
    }
}
