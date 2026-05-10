export {
    type AnyTagHandler,
    defineStructuralTag,
    isStructural,
    type RenderOptions,
    render,
    type StructuralTagHandler,
    stringify,
    withLocals,
} from "./lib/compiler/Render.js";
export {
    type AnyAsyncTagHandler,
    type AsyncStructuralTagHandler,
    type RenderAsyncOptions,
    renderAsync,
} from "./lib/compiler/RenderAsync.js";
export { Template } from "./lib/compiler/Template.js";
export {
    AggregateParseError,
    MaxDepthError,
    RenderError,
    StrictModeError,
    TagParseError,
} from "./lib/errors/Errors.js";
export { Lexer } from "./lib/lexer/Lexer.js";
export { Stream } from "./lib/lexer/Stream.js";
export { parse } from "./lib/parser/Parser.js";
export { pathResolver } from "./lib/resolvers/pathResolver.js";
export {
    builtinTags,
    defaultTag,
    eachTag,
    eqTag,
    gteTag,
    gtTag,
    ifTag,
    isTruthy,
    lengthTag,
    lowerTag,
    lteTag,
    ltTag,
    neTag,
    notTag,
    replaceTag,
    trimTag,
    unlessTag,
    upperTag,
} from "./lib/tags/builtins.js";

export {
    collectTagNames,
    collectVariableNames,
    findNodes,
    type VisitContext,
    type Visitor,
    walk,
} from "./lib/visitor/Visitor.js";
export type {
    ArgumentNode,
    AsyncTagHandler,
    AsyncVariableResolver,
    CompiledTemplate,
    LexerOptions,
    NodeKind,
    ParseDiagnostic,
    ParseResult,
    ParserOptions,
    Position,
    RenderContext,
    Span,
    TagHandler,
    TagNode,
    TemplateNode,
    TextNode,
    Token,
    TokenKind,
    VariableNode,
    VariableResolver,
} from "./types.js";
export {
    NodeKind as NodeKindValues,
    TokenKind as TokenKindValues,
} from "./types.js";
