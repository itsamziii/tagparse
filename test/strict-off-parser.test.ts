import { describe, it, expect } from "vitest";
import { Parser, NodeType } from "../src/index.js";

const globalParser = new Parser();

describe("Parser class with strict mode off", () => {
    it("should parse empty tags as text nodes", () => {
        const input = "{}";
        const result = globalParser.parse(input);

        expect(result).toEqual([{ type: NodeType.Text, value: "{}" }]);
    });

    it("should treat nested variable tags as text", () => {
        const input = "{outer{inner}}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            { type: NodeType.Text, value: "{outer{inner}}" },
        ]);
    });

    it("should handle errored instance of function tag by passing it back as text node", () => {
        const input = "{tag:}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "tag",
                args: [],
            },
        ]);
    });

    it("should parse unclosed tag as text", () => {
        const input = "Hello, {tag";
        const result = globalParser.parse(input);

        expect(result).toEqual([{ type: NodeType.Text, value: "Hello, {tag" }]);
    });

    it("should ignore spaces towards the start of variable tag but return text if space present towards tag end", () => {
        const input = "Text { spaced tag }";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            { type: NodeType.Text, value: "Text {spacedtag }" },
        ]);
    });

    it("should not hang on unterminated function tag and return text", () => {
        const input = "{tag:arg1|arg2";
        const result = globalParser.parse(input);

        expect(result).toEqual([{ type: NodeType.Text, value: "{tag:arg1|arg2" }]);
    });

    it("should allow parsing multiple times with fresh state", () => {
        const input = "{tag}";

        const first = globalParser.parse(input);
        const second = globalParser.parse(input);

        expect(first).toEqual([{ type: NodeType.Variable, raw: "tag" }]);
        expect(second).toEqual(first);
    });

    it("should handle only text input with no tags", () => {
        const input = "just plain text here";
        const result = globalParser.parse(input);

        expect(result).toEqual([{ type: NodeType.Text, value: "just plain text here" }]);
    });

    it("should handle empty input", () => {
        const input = "";
        const result = globalParser.parse(input);

        expect(result).toEqual([]);
    });

    it("should handle multiple unclosed tags", () => {
        const input = "{first {second {third";
        const result = globalParser.parse(input);

        // Spaces within unclosed tags are consumed by the parser
        expect(result).toEqual([{ type: NodeType.Text, value: "{first{second {third" }]);
    });

    it("should handle mixed valid and invalid tags", () => {
        const input = "{valid} {unclosed";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            { type: NodeType.Variable, raw: "valid" },
            { type: NodeType.Text, value: " {unclosed" },
        ]);
    });

    it("should handle orphan closing braces as text", () => {
        const input = "text } more } text";
        const result = globalParser.parse(input);

        expect(result).toEqual([{ type: NodeType.Text, value: "text } more } text" }]);
    });

    it("should handle double braces as text", () => {
        const input = "{{tag}}";
        const result = globalParser.parse(input);

        expect(result).toEqual([{ type: NodeType.Text, value: "{{tag}}" }]);
    });

    it("should parse function with spaces in arguments", () => {
        const input = "{func:arg with spaces}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "func",
                args: [{ type: NodeType.Argument, nodes: [{ type: NodeType.Text, value: "arg with spaces" }] }],
            },
        ]);
    });

    it("should handle whitespace-only input", () => {
        const input = "   ";
        const result = globalParser.parse(input);

        expect(result).toEqual([{ type: NodeType.Text, value: "   " }]);
    });

    it("should handle very long tag names gracefully", () => {
        const longName = "a".repeat(1000);
        const input = `{${longName}}`;
        const result = globalParser.parse(input);

        expect(result).toEqual([{ type: NodeType.Variable, raw: longName }]);
    });

    it("should handle special unicode characters in tag names", () => {
        const input = "{日本語}";
        const result = globalParser.parse(input);

        expect(result).toEqual([{ type: NodeType.Variable, raw: "日本語" }]);
    });

    it("should handle emojis in tag names", () => {
        const input = "{emoji🎉}";
        const result = globalParser.parse(input);

        expect(result).toEqual([{ type: NodeType.Variable, raw: "emoji🎉" }]);
    });

    it("should handle multiple consecutive valid tags", () => {
        const input = "{a}{b}{c}{d}{e}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            { type: NodeType.Variable, raw: "a" },
            { type: NodeType.Variable, raw: "b" },
            { type: NodeType.Variable, raw: "c" },
            { type: NodeType.Variable, raw: "d" },
            { type: NodeType.Variable, raw: "e" },
        ]);
    });

    it("should handle function tag with empty arguments between pipes", () => {
        const input = "{func:a||b}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "func",
                args: [
                    { type: NodeType.Argument, nodes: [{ type: NodeType.Text, value: "a" }] },
                    { type: NodeType.Argument, nodes: [{ type: NodeType.Text, value: "b" }] },
                ],
            },
        ]);
    });
});
