import {
    TokenType,
    NodeType,
    type ReadonlyToken,
    type TokenGenerator,
    type ArgumentNode,
    type Node,
    type ParserOptions,
} from "../../types.js";
import { ParserError, StrictModeError } from "../Errors.js";
import { Lexer } from "../Lexer.js";
import { FunctionTagParser } from "./TagParsers/FunctionTagParser.js";
import { VariableTagParser } from "./TagParsers/VariableTagParser.js";

export class Parser {
    public readonly input: TokenGenerator;

    private readonly lexer: Lexer;

    private nodes: Node[] = [];

    private stack: ReadonlyToken[] = [];

    private readonly parseTags: boolean = false;

    /**
     * Strict mode rules:
     * - No empty tags allowed, i.e. "\{\}" will throw an error
     * - No spaces within function tag names or variable tags i.e. "\{ pick:\}" " "\{pi ck:\}" "\{pick :\}" "\{test . var\}" will all throw errors
     * - All tags are expected to end, reaching end of input before the end of tag will throw an error
     * - All tags should start with tagStart , i.e. "\{" by default, and end with "\}" by default.
     * - You are expected to supply atleast one argument to function tags, strict mode prevents you from supplying function tags without any arguments.
     */
    private readonly strict: boolean = false;

    private readonly functionParser?: FunctionTagParser;

    private readonly variableParser?: VariableTagParser;

    public constructor(input: string, options?: ParserOptions) {
        this.lexer = new Lexer(input, options?.lexerOptions ?? {});
        this.input = this.lexer[Symbol.asyncIterator]();

        this.parseTags = Boolean(options?.parseTags);
        this.strict = Boolean(options?.strict);

        if (this.parseTags) {
            if (
                typeof options?.functionParser !== "function" ||
                typeof options?.variableParser !== "function"
            ) {
                throw new ParserError(
                    "Function and variable parser functions must be provided when `parseTags` is enabled",
                );
            }

            this.functionParser = new FunctionTagParser(options.functionParser);
            this.variableParser = new VariableTagParser(options.variableParser);
        }
    }

    public async parse(): Promise<Node[]> {
        let buffer = "";

        for await (const token of this.input) {
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
        if (this.nodes.at(-1)?.type === NodeType.Text) {
            this.nodes.at(-1)!.value += value;
        } else {
            this.nodes.push({ type: NodeType.Text, value });
        }
    }

    private async parseTag(): Promise<Node> {
        let nameToken; let nextToken;

        if (this.strict) {
            nameToken = await this.nextToken();
            if (nameToken.type === TokenType.Space) {
                throw new StrictModeError(
                    "Tags cannot contain spaces. Disable strict mode to automatically skip spaces in tags.",
                );
            }

            if (nameToken.type !== TokenType.Literal) {
                throw new StrictModeError(
                    "Tags must start with a literal character and not be empty.",
                );
            }

            nextToken = await this.nextToken();

            if (nextToken.type === TokenType.Space) {
                throw new StrictModeError(
                    "Tags cannot contain spaces. Disable strict mode to automatically skip spaces in tags.",
                );
            }
        } else {
            nameToken = await this.skip(TokenType.Space);
            nextToken = await this.skip(TokenType.Space);
        }

        const name = nameToken.value;

        switch (nextToken.type) {
            case TokenType.TagEnd: {
                if (name === "") {
                    if (this.strict) {
                        throw new StrictModeError(
                            "Empty tags are not allowed.",
                        );
                    }

                    return { type: NodeType.Text, value: "" };
                }

                return this.parseTags
                    ? // We can safely assert that `this.variableParser` is defined if `this.parseTags` is true
                      this.variableParser!.parse(name)
                    : { type: NodeType.Variable, raw: name };
            }

            case TokenType.Colon: {
                const args = await this.parseFunctionArguments();
                if (args.length === 0 && this.strict) {
                        throw new StrictModeError(
                            "Expected at least one argument for the tag payload.",
                        );
                    }
                    // Honestly idk what to do here, so I'm just gonna let the function node have no args

                return this.parseTags
                    ? // We can safely assert that `this.functionParser` is defined if `this.parseTags` is true
                      this.functionParser!.parse(name, args)
                    : { type: NodeType.Function, name, args };
            }

            default: {
                if (this.strict) {
                    throw new StrictModeError(
                        "Unexpected token encountered within tag. Either esscape it or set `strict` to false to ignore it.",
                    );
                }

                return {
                    type: NodeType.Text,
                    value: `${this.lexer.tagStart}${name}${nextToken.value}`,
                };
            }
        }
    }

    private async parseFunctionArguments(): Promise<ArgumentNode[]> {
        const args: ArgumentNode[] = [];

        while (true) {
            const arg = await this.parseArgument();
            if (!arg) {
                break;
            }

            if (this.parseTags) {
                arg.finalValue = arg.nodes.reduce(
                    (acc, arg) => acc + arg.value,
                    "",
                );
            }

            args.push(arg);
        }

        // Remove the tagEnd token from the stack
        this.stack.pop();

        return args;
    }

    private async parseArgument(): Promise<ArgumentNode | null> {
        const argNodes: Node[] = [];
        let buffer = "";

        while (true) {
            const token = await this.nextToken();
            const escaped = buffer.length && buffer.at(-1) === "\\";

            if (token.type === TokenType.Pipe) {
                if (escaped) {
                    buffer = buffer.slice(0, -1) + token.value;
                    continue;
                }

                break;
            } else if (token.type === TokenType.TagEnd) {
                if (escaped) {
                    buffer = buffer.slice(0, -1) + token.value;
                    continue;
                }

                this.stack.push(token);
                break;
            } else if (token.type === TokenType.TagStart) {
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
            }
        }

        if (buffer.length) {
            argNodes.push({ type: NodeType.Text, value: buffer });
        }

        return argNodes.length
            ? { type: NodeType.Argument, nodes: argNodes }
            : null;
    }

    private async nextToken(): Promise<ReadonlyToken> {
        if (this.stack.length) {
            return this.stack.pop() as ReadonlyToken;
        }

        const { done, value } = await this.input.next();

        if (done || !value) {
            if (this.strict) {
                throw new ParserError("Unexpected end of input");
            }

            return { type: TokenType.Literal, value: "" };
        }

        return value;
    }

    private async skip(omitType: TokenType): Promise<ReadonlyToken> {
        let token: ReadonlyToken;

        do {
            token = await this.nextToken();
        } while (token.type === omitType);

        return token;
    }
}
