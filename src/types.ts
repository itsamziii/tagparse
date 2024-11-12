export type LexerOptions = {
    tagEnd?: string;
    tagStart?: string;
};

export const enum TokenType {
    TagStart,
    TagEnd,
    Colon,
    Pipe,
    Space,
    Literal,
}

export type Token = {
    type: TokenType;
    value: string;
};

export type ReadonlyToken = Readonly<Token>;

export type TokenGenerator = AsyncGenerator<ReadonlyToken>;

export type TFunctionParserFn = (
    funcName: string,
    args: ArgumentNode[],
) => Promise<string>;

export type TVariableParserFn = (variable: string) => Promise<string>;

export type ParserOptions = {
    functionParser?: TFunctionParserFn;
    lexerOptions?: LexerOptions;
    parseTags?: boolean;
    strict?: boolean;
    variableParser?: TVariableParserFn;
};

export const enum NodeType {
    Argument,
    Function,
    Text,
    Variable,
}

export type ArgumentNode = {
    finalValue?: string;
    nodes: Node[];
    type: NodeType.Argument;
};

export type FunctionNode = {
    args: ArgumentNode[];
    name: string;
    type: NodeType.Function;
    value?: string;
};

export type TextNode = {
    type: NodeType.Text;
    value: string;
};

export type VariableNode = {
    raw: string;
    type: NodeType.Variable;
    value?: string;
};

export type Node = FunctionNode | TextNode | VariableNode;
