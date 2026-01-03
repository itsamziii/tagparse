import { describe, it, expect } from "vitest";
import { Lexer, TokenType } from "../src/index.js";

// Helper to strip position from tokens for easier comparison
function stripPositions(
    tokens: { position?: unknown, type: string; value: string; }[],
) {
    return tokens.map(({ type, value }) => ({ type, value }));
}

describe("Lexer", () => {
    // Edge cases: empty and whitespace-only input
    it("should return no tokens for empty input", () => {
        const lexer = new Lexer("");
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([]);
    });

    it("should tokenize whitespace-only input as literal", () => {
        const lexer = new Lexer("   ");
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.Space, value: " " },
            { type: TokenType.Space, value: " " },
            { type: TokenType.Space, value: " " },
        ]);
    });

    it("should tokenize plain text without any tags", () => {
        const lexer = new Lexer("hello world");
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.Literal, value: "hello" },
            { type: TokenType.Space, value: " " },
            { type: TokenType.Literal, value: "world" },
        ]);
    });

    it("should tokenize text before and after a tag", () => {
        const lexer = new Lexer("prefix {tag} suffix");
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.Literal, value: "prefix" },
            { type: TokenType.Space, value: " " },
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "tag" },
            { type: TokenType.TagEnd, value: "}" },
            { type: TokenType.Space, value: " " },
            { type: TokenType.Literal, value: "suffix" },
        ]);
    });

    // Multiple special characters
    it("should tokenize multiple colons in a row", () => {
        const lexer = new Lexer("{tag::value}");
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "tag" },
            { type: TokenType.Colon, value: ":" },
            { type: TokenType.Colon, value: ":" },
            { type: TokenType.Literal, value: "value" },
            { type: TokenType.TagEnd, value: "}" },
        ]);
    });

    it("should tokenize multiple pipes in a row", () => {
        const lexer = new Lexer("{tag:a||b}");
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "tag" },
            { type: TokenType.Colon, value: ":" },
            { type: TokenType.Literal, value: "a" },
            { type: TokenType.Pipe, value: "|" },
            { type: TokenType.Pipe, value: "|" },
            { type: TokenType.Literal, value: "b" },
            { type: TokenType.TagEnd, value: "}" },
        ]);
    });

    it("should tokenize mixed special characters", () => {
        const lexer = new Lexer("{a:b|c:d|e}");
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "a" },
            { type: TokenType.Colon, value: ":" },
            { type: TokenType.Literal, value: "b" },
            { type: TokenType.Pipe, value: "|" },
            { type: TokenType.Literal, value: "c" },
            { type: TokenType.Colon, value: ":" },
            { type: TokenType.Literal, value: "d" },
            { type: TokenType.Pipe, value: "|" },
            { type: TokenType.Literal, value: "e" },
            { type: TokenType.TagEnd, value: "}" },
        ]);
    });

    // Unclosed/unterminated tags
    it("should tokenize unclosed tag start", () => {
        const lexer = new Lexer("{tag");
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "tag" },
        ]);
    });

    it("should tokenize orphan tag end", () => {
        const lexer = new Lexer("tag}");
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.Literal, value: "tag" },
            { type: TokenType.TagEnd, value: "}" },
        ]);
    });

    it("should tokenize multiple unclosed tags", () => {
        const lexer = new Lexer("{a {b {c");
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "a" },
            { type: TokenType.Space, value: " " },
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "b" },
            { type: TokenType.Space, value: " " },
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "c" },
        ]);
    });

    // Special characters in literals
    it("should tokenize backslash as part of literal", () => {
        const lexer = new Lexer("{tag\\:value}");
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "tag\\" },
            { type: TokenType.Colon, value: ":" },
            { type: TokenType.Literal, value: "value" },
            { type: TokenType.TagEnd, value: "}" },
        ]);
    });

    it("should tokenize numbers and special chars in literal", () => {
        const lexer = new Lexer("{tag123_test-value}");
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "tag123_test-value" },
            { type: TokenType.TagEnd, value: "}" },
        ]);
    });

    // Original tests
    it("should tokenize a simple tag", () => {
        const input = "{tag}";
        const lexer = new Lexer(input);
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "tag" },
            { type: TokenType.TagEnd, value: "}" },
        ]);
    });

    it("should tokenize nested tags", () => {
        const input = "{outer{inner}}";
        const lexer = new Lexer(input);
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "outer" },
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "inner" },
            { type: TokenType.TagEnd, value: "}" },
            { type: TokenType.TagEnd, value: "}" },
        ]);
    });

    it("should tokenize tags with arguments", () => {
        const input = "{tag:arg1|arg2}";
        const lexer = new Lexer(input);
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "tag" },
            { type: TokenType.Colon, value: ":" },
            { type: TokenType.Literal, value: "arg1" },
            { type: TokenType.Pipe, value: "|" },
            { type: TokenType.Literal, value: "arg2" },
            { type: TokenType.TagEnd, value: "}" },
        ]);
    });

    it("should handle custom tag delimiters", () => {
        const input = "$(tag)";
        const lexer = new Lexer(input, { tagStart: "$(", tagEnd: ")" });
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.TagStart, value: "$(" },
            { type: TokenType.Literal, value: "tag" },
            { type: TokenType.TagEnd, value: ")" },
        ]);
    });

    it("should handle multi-byte (emoji) tag delimiters", () => {
        const input = "🧪<नाम🔚>";
        const lexer = new Lexer(input, { tagStart: "🧪<", tagEnd: "🔚>" });
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.TagStart, value: "🧪<" },
            { type: TokenType.Literal, value: "नाम" },
            { type: TokenType.TagEnd, value: "🔚>" },
        ]);
    });

    it("should handle spaces within tags", () => {
        const input = "{tag with spaces}";
        const lexer = new Lexer(input);
        const tokens = [...lexer];

        expect(stripPositions(tokens)).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "tag" },
            { type: TokenType.Space, value: " " },
            { type: TokenType.Literal, value: "with" },
            { type: TokenType.Space, value: " " },
            { type: TokenType.Literal, value: "spaces" },
            { type: TokenType.TagEnd, value: "}" },
        ]);
    });

    // Position tracking tests
    it("should track positions correctly", () => {
        const lexer = new Lexer("{a}");
        const tokens = [...lexer];

        expect(tokens[0]!.position).toEqual({ line: 1, column: 1, offset: 0 });
        expect(tokens[1]!.position).toEqual({ line: 1, column: 2, offset: 1 });
        expect(tokens[2]!.position).toEqual({ line: 1, column: 3, offset: 2 });
    });

    it("should track line numbers across newlines", () => {
        const lexer = new Lexer("a\n{b}");
        const tokens = [...lexer];

        expect(tokens[0]!.position?.line).toBe(1);
        expect(tokens[1]!.position?.line).toBe(2);
    });
});
