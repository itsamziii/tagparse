import type {
    ArgumentNode,
    CompiledTemplate,
    ParseDiagnostic,
    ParseResult,
    ParserOptions,
    Span,
    TagNode,
    TemplateNode,
    TextNode,
    Token,
    VariableNode,
} from "../../types.js";
import { NodeKind, TokenKind } from "../../types.js";
import { AggregateParseError, MaxDepthError } from "../errors/Errors.js";
import { Lexer } from "../lexer/Lexer.js";

const DEFAULT_MAX_DEPTH = 32;
const EMPTY_SPAN: Span = {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
};

/**
 * Parse a template into an AST. Pure function — no shared state, safe to call
 * concurrently (or, in a worker, in parallel) on different inputs.
 *
 * Behavior:
 *   - Returns { template, diagnostics }. In strict mode, throws AggregateParseError
 *     if diagnostics contain errors.
 *   - Unclosed tags become text in non-strict mode (with a diagnostic).
 *   - Empty {} becomes empty text in non-strict mode.
 *   - Variable names are NOT trimmed; whitespace inside { ... } is preserved
 *     as part of the name. (This is a deliberate departure from v1's silent trim.)
 */
export function parse(input: string, options: ParserOptions = {}): ParseResult {
    const strict = options.strict ?? false;
    const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
    const lexer = new Lexer(input, options);
    const tokens = [...lexer];

    const diagnostics: ParseDiagnostic[] = [];
    const cursor = { i: 0 };

    const nodes = parseNodes(
        tokens,
        cursor,
        diagnostics,
        0,
        maxDepth,
        /* inTag */ false,
        lexer,
    );

    if (strict) {
        const errors = diagnostics.filter((d) => d.severity === "error");
        if (errors.length > 0) {
            throw new AggregateParseError(errors);
        }
    }

    const template: CompiledTemplate = { nodes, source: input };
    return { template, diagnostics };
}

function parseNodes(
    tokens: readonly Token[],
    cursor: { i: number },
    diagnostics: ParseDiagnostic[],
    depth: number,
    maxDepth: number,
    inTag: boolean,
    lexer: Lexer,
): TemplateNode[] {
    if (depth > maxDepth) {
        const tok = tokens[cursor.i] ?? tokens.at(-1);
        if (!tok) {
            throw new MaxDepthError(maxDepth, EMPTY_SPAN);
        }
        throw new MaxDepthError(maxDepth, tok.span);
    }

    const out: TemplateNode[] = [];

    while (cursor.i < tokens.length) {
        const tok = tokens[cursor.i];
        if (!tok) break;

        if (tok.kind === TokenKind.EOF) break;

        // Inside a tag, these are terminators handled by the caller.
        if (
            inTag &&
            (tok.kind === TokenKind.Pipe || tok.kind === TokenKind.TagEnd)
        ) {
            break;
        }

        if (tok.kind === TokenKind.TagStart) {
            const tagNode = parseTag(
                tokens,
                cursor,
                diagnostics,
                depth,
                maxDepth,
                lexer,
            );
            // parseTag may return null to indicate "treat the start as text"
            if (tagNode === null) {
                pushText(out, tok.value, tok.span);
            } else if (tagNode.kind === NodeKind.Text) {
                pushText(out, tagNode.value, tagNode.span);
            } else {
                out.push(tagNode);
            }
            continue;
        }

        if (tok.kind === TokenKind.Text) {
            pushText(out, tok.value, tok.span);
            cursor.i++;
            continue;
        }

        // Stray Colon, Pipe, or TagEnd outside a tag — emit as text.
        // (Lexer only emits Colon/Pipe inside tags; TagEnd outside is impossible
        // because the lexer tracks tag depth. Belt-and-braces.)
        pushText(out, tok.value, tok.span);
        cursor.i++;
    }

    return out;
}

/**
 * Parse a tag starting at the current TagStart token.
 * Returns:
 *   - TagNode for {name:arg|arg}
 *   - VariableNode for {name}
 *   - TextNode if the tag is malformed and we recover by treating the run as text
 *   - null if caller should emit the TagStart as text (already consumed)
 */
function parseTag(
    tokens: readonly Token[],
    cursor: { i: number },
    diagnostics: ParseDiagnostic[],
    depth: number,
    maxDepth: number,
    lexer: Lexer,
): TagNode | VariableNode | TextNode | null {
    const startTok = tokens[cursor.i];
    if (!startTok) return null;
    cursor.i++; // consume TagStart

    // Collect the "name" portion: text tokens up until the first Colon or TagEnd.
    let name = "";
    let nameEnd: Span | null = null;
    let sawColon = false;
    let sawEnd = false;

    while (cursor.i < tokens.length) {
        const t = tokens[cursor.i];
        if (!t) break;
        if (t.kind === TokenKind.EOF) break;
        if (t.kind === TokenKind.TagEnd) {
            sawEnd = true;
            break;
        }
        if (t.kind === TokenKind.Colon) {
            sawColon = true;
            break;
        }
        if (t.kind === TokenKind.Pipe) {
            // pipe before colon — malformed.
            diagnostics.push({
                severity: "error",
                message: "Unexpected '|' in tag name",
                span: t.span,
                hint: "Did you mean ':' to start arguments?",
            });
            // Recover: treat the whole thing up to TagEnd or EOF as text.
            return recoverTagAsText(startTok, tokens, cursor);
        }
        if (t.kind === TokenKind.TagStart) {
            // A tag started before the current one closed. Recover by emitting
            // current as text and re-parsing the new tag.
            diagnostics.push({
                severity: "error",
                message: "Tag started inside a tag name",
                span: t.span,
                hint: "Tag names cannot contain another tag. Close the outer tag first.",
            });
            return recoverTagAsText(startTok, tokens, cursor);
        }
        // Text token — accumulate.
        name += t.value;
        nameEnd = t.span;
        cursor.i++;
    }

    if (!sawColon && !sawEnd) {
        // Hit EOF before the tag closed.
        diagnostics.push({
            severity: "error",
            message: "Unclosed tag",
            span: startTok.span,
            hint: `Expected '${lexer.tagEnd}' to close the tag.`,
        });
        // Recover: emit the start delimiter + whatever name we collected as text.
        const lastSpan = nameEnd ?? startTok.span;
        return {
            kind: NodeKind.Text,
            value: lexer.tagStart + name,
            span: { start: startTok.span.start, end: lastSpan.end },
        };
    }

    if (sawEnd) {
        const endTok = tokens[cursor.i];
        if (!endTok) {
            return {
                kind: NodeKind.Variable,
                name,
                span: { start: startTok.span.start, end: startTok.span.end },
            };
        }
        cursor.i++; // consume TagEnd

        if (name.length === 0) {
            // Empty {} — degrade to empty text with a warning.
            diagnostics.push({
                severity: "warning",
                message: "Empty tag",
                span: { start: startTok.span.start, end: endTok.span.end },
                hint: "Empty tags are ignored.",
            });
            return {
                kind: NodeKind.Text,
                value: "",
                span: { start: startTok.span.start, end: endTok.span.end },
            };
        }

        return {
            kind: NodeKind.Variable,
            name,
            span: { start: startTok.span.start, end: endTok.span.end },
        };
    }

    // sawColon: parse arguments.
    const colonTok = tokens[cursor.i];
    if (!colonTok) {
        return recoverTagAsText(startTok, tokens, cursor);
    }
    cursor.i++; // consume colon

    if (name.length === 0) {
        diagnostics.push({
            severity: "error",
            message: "Tag must have a name before ':'",
            span: colonTok.span,
        });
        return recoverTagAsText(startTok, tokens, cursor);
    }

    const args: ArgumentNode[] = [];
    let closed = false;
    let endTokSpan: Span = colonTok.span;

    // Parse one argument at a time, each terminated by Pipe or TagEnd.
    while (cursor.i < tokens.length) {
        const argToken = tokens[cursor.i];
        if (!argToken) break;
        const argStart = argToken.span;
        const argNodes = parseNodes(
            tokens,
            cursor,
            diagnostics,
            depth + 1,
            maxDepth,
            /* inTag */ true,
            lexer,
        );

        const next = tokens[cursor.i];
        if (!next || next.kind === TokenKind.EOF) {
            diagnostics.push({
                severity: "error",
                message: "Unclosed tag",
                span: startTok.span,
                hint: `Expected '${lexer.tagEnd}' to close '${name}'.`,
            });
            // Recover: synthesize argument with what we have.
            const argEnd =
                argNodes.length > 0
                    ? (argNodes[argNodes.length - 1]?.span.end ?? argStart.end)
                    : argStart.end;
            args.push({
                kind: NodeKind.Argument,
                nodes: argNodes,
                span: { start: argStart.start, end: argEnd },
            });
            return {
                kind: NodeKind.Tag,
                name,
                args,
                span: { start: startTok.span.start, end: argEnd },
            };
        }

        const argEnd = next.span.start;
        args.push({
            kind: NodeKind.Argument,
            nodes: argNodes,
            span: { start: argStart.start, end: argEnd },
        });

        if (next.kind === TokenKind.TagEnd) {
            cursor.i++; // consume TagEnd
            closed = true;
            endTokSpan = next.span;
            break;
        }
        if (next.kind === TokenKind.Pipe) {
            cursor.i++; // consume Pipe and continue parsing next arg
            continue;
        }
        // Shouldn't reach: parseNodes only stops on Pipe/TagEnd/EOF.
        break;
    }

    if (!closed) {
        diagnostics.push({
            severity: "error",
            message: "Unclosed tag",
            span: startTok.span,
        });
    }

    return {
        kind: NodeKind.Tag,
        name,
        args,
        span: { start: startTok.span.start, end: endTokSpan.end },
    };
}

function recoverTagAsText(
    startTok: Token,
    tokens: readonly Token[],
    cursor: { i: number },
): TextNode {
    // Walk forward until TagEnd or EOF, collecting raw text. We're in error recovery —
    // do the simplest thing: rebuild source from token values.
    let text = startTok.value;
    let endSpan: Span = startTok.span;
    while (cursor.i < tokens.length) {
        const t = tokens[cursor.i];
        if (!t) break;
        if (t.kind === TokenKind.EOF) break;
        text += t.value;
        endSpan = t.span;
        cursor.i++;
        if (t.kind === TokenKind.TagEnd) break;
    }
    return {
        kind: NodeKind.Text,
        value: text,
        span: { start: startTok.span.start, end: endSpan.end },
    };
}

function pushText(out: TemplateNode[], value: string, span: Span): void {
    if (value.length === 0) return;
    const last = out[out.length - 1];
    if (last && last.kind === NodeKind.Text) {
        // Merge adjacent text nodes for cleaner ASTs.
        const merged: TextNode = {
            kind: NodeKind.Text,
            value: last.value + value,
            span: { start: last.span.start, end: span.end },
        };
        out[out.length - 1] = merged;
        return;
    }
    out.push({ kind: NodeKind.Text, value, span });
}
