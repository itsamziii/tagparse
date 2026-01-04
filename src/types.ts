import type { Position } from "./lib/Errors.js";

export type Awaitable<T> = Promise<T> | T;

export type LexerOptions = {
    tagEnd?: string;
    tagStart?: string;
};

/**
 * Built-in token types.
 */
export type BuiltinTokenType =
    | "Colon"
    | "Literal"
    | "Pipe"
    | "Space"
    | "TagEnd"
    | "TagStart";

/**
 * Token type - either a built-in type or a custom string type
 */
export type TokenType = BuiltinTokenType | (string & {});

/**
 * Token type constants for convenience
 */
export const TokenType = {
    TagStart: "TagStart" as const,
    TagEnd: "TagEnd" as const,
    Colon: "Colon" as const,
    Pipe: "Pipe" as const,
    Space: "Space" as const,
    Literal: "Literal" as const,
} as const;

export type Token = {
    position?: Position;
    type: TokenType;
    value: string;
};

export type ReadonlyToken = Readonly<Token>;

/**
 * Sync token generator type
 */
export type TokenGenerator = Generator<ReadonlyToken>;

/**
 * Function parser callback - sync version (v2)
 */
export type TFunctionParserFn = (
    funcName: string,
    args: ArgumentNode[],
) => unknown;

export type TFunctionParserAsyncFn = (
    funcName: string,
    args: ArgumentNode[],
) => Awaitable<unknown>;

/**
 * Variable parser callback - sync version (v2)
 */
export type TVariableParserFn = (variable: string) => unknown;

export type TVariableParserAsyncFn = (variable: string) => Awaitable<unknown>;

export type ParserOptions = {
    /**
     * When true, calls functionParser/variableParser to evaluate tags.
     * Requires functionParser and variableParser to be provided.
     */
    evaluateTags?: boolean;
    functionParser?: TFunctionParserFn;
    lexerOptions?: LexerOptions;
    /**
     * @deprecated Use `evaluateTags` instead
     */
    parseTags?: boolean;
    strict?: boolean;
    variableParser?: TVariableParserFn;
};

export type ParserAsyncOptions = Omit<
    ParserOptions,
    "functionParser" | "variableParser"
> & {
    functionParser?: TFunctionParserAsyncFn;
    variableParser?: TVariableParserAsyncFn;
};

/**
 * Built-in node types.
 */
export type BuiltinNodeType = "Argument" | "Function" | "Text" | "Variable";

/**
 * Node type - either a built-in type or a custom string type
 */
export type NodeType = BuiltinNodeType | (string & {});

/**
 * Node type constants for convenience
 */
export const NodeType = {
    Argument: "Argument" as const,
    Function: "Function" as const,
    Text: "Text" as const,
    Variable: "Variable" as const,
} as const;

export type ArgumentNode = {
    finalValue?: string;
    nodes: Node[];
    type: typeof NodeType.Argument;
};

export type FunctionNode = {
    args: ArgumentNode[];
    name: string;
    type: typeof NodeType.Function;
    value?: unknown;
};

export type TextNode = {
    type: typeof NodeType.Text;
    value: string;
};

export type VariableNode = {
    raw: string;
    type: typeof NodeType.Variable;
    value?: unknown;
};

/**
 * Base node type - union of all built-in node types.
 * Custom nodes should extend this pattern.
 */
export type Node = ArgumentNode | FunctionNode | TextNode | VariableNode;

export type ParseResult = FunctionNode | TextNode | VariableNode;
