/**
 * Position in source input (1-based line/column, 0-based offset).
 */
export interface Position {
    line: number;
    column: number;
    offset: number;
}

/**
 * Span covering a range in source input.
 */
export interface Span {
    start: Position;
    end: Position;
}

export const TokenKind = {
    Text: "Text",
    TagStart: "TagStart",
    TagEnd: "TagEnd",
    Colon: "Colon",
    Pipe: "Pipe",
    Escape: "Escape",
    EOF: "EOF",
} as const;

export type TokenKind = (typeof TokenKind)[keyof typeof TokenKind];

export interface Token {
    readonly kind: TokenKind;
    readonly value: string;
    readonly span: Span;
}

export const NodeKind = {
    Text: "Text",
    Variable: "Variable",
    Tag: "Tag",
    Argument: "Argument",
} as const;

export type NodeKind = (typeof NodeKind)[keyof typeof NodeKind];

export interface TextNode {
    readonly kind: typeof NodeKind.Text;
    readonly value: string;
    readonly span: Span;
}

export interface VariableNode {
    readonly kind: typeof NodeKind.Variable;
    readonly name: string;
    readonly span: Span;
}

export interface ArgumentNode {
    readonly kind: typeof NodeKind.Argument;
    readonly nodes: readonly TemplateNode[];
    readonly span: Span;
}

/**
 * A "tag" with a name and pipe-separated arguments.
 * e.g. {if:cond|then|else}, {upper:hello}, {each:items|<li>{it}</li>}
 *
 * Variables and tags share the {name} grammar but split on `:`.
 * Variables = no args. Tags = name + args.
 */
export interface TagNode {
    readonly kind: typeof NodeKind.Tag;
    readonly name: string;
    readonly args: readonly ArgumentNode[];
    readonly span: Span;
}

export type TemplateNode = TextNode | VariableNode | TagNode;

/**
 * Compiled template — parse result you render against data.
 */
export interface CompiledTemplate {
    readonly nodes: readonly TemplateNode[];
    readonly source: string;
}

export interface ParseDiagnostic {
    readonly severity: "error" | "warning";
    readonly message: string;
    readonly span: Span;
    readonly hint?: string;
}

export interface ParseResult {
    readonly template: CompiledTemplate;
    readonly diagnostics: readonly ParseDiagnostic[];
}

export interface LexerOptions {
    /** Default: "{" */
    readonly tagStart?: string;
    /** Default: "}" */
    readonly tagEnd?: string;
    /** Default: "\\" — character that escapes the next delimiter */
    readonly escapeChar?: string;
}

export interface ParserOptions extends LexerOptions {
    /**
     * Strict mode: invalid tags throw instead of degrading to text.
     * Default: false.
     */
    readonly strict?: boolean;
    /**
     * Maximum nesting depth for tag arguments. Prevents pathological inputs.
     * Default: 32.
     */
    readonly maxDepth?: number;
}

/**
 * Tag handler — receives evaluated argument strings plus the runtime context,
 * returns the value to splice into output.
 *
 * Returning undefined or null produces empty string. Booleans/numbers stringify.
 */
export type TagHandler<Ctx = unknown> = (
    args: readonly string[],
    ctx: RenderContext<Ctx>,
) => string | number | boolean | null | undefined;

export type AsyncTagHandler<Ctx = unknown> = (
    args: readonly string[],
    ctx: RenderContext<Ctx>,
) => Awaitable<string | number | boolean | null | undefined>;

/**
 * Variable resolver — looks up a variable name and returns its value.
 *
 * Return types: any primitive, `null`/`undefined` (treated as missing), or
 * a plain object/array. Objects are JSON-stringified by the renderer.
 */
export type VariableResolver<Ctx = unknown> = (
    name: string,
    ctx: RenderContext<Ctx>,
) => string | number | boolean | bigint | object | null | undefined;

export type AsyncVariableResolver<Ctx = unknown> = (
    name: string,
    ctx: RenderContext<Ctx>,
) => Awaitable<string | number | boolean | bigint | object | null | undefined>;

export interface RenderContext<Ctx = unknown> {
    /** User-provided data bag. */
    readonly data: Ctx;
    /** Local scope for {each} loop variables, etc. Frame-stacked. */
    readonly locals: ReadonlyMap<string, unknown>;
    /** Current nesting depth (for diagnostics, recursion limits). */
    readonly depth: number;
}

export type Awaitable<T> = T | Promise<T>;
