import { describe, it, expect } from "vitest";
import { Parser, NodeType } from "../src/index.js";

const globalParser = new Parser({ strict: true });

describe("Parser class with strict mode on and evaluateTags off", () => {
    // Cases with the same behavior in both strict and non-strict modes
    it("should parse a simple tag", () => {
        const input = "{tag}";
        const result = globalParser.parse(input);

        expect(result).toEqual([{ type: NodeType.Variable, raw: "tag" }]);
    });

    it("should parse text with a single-character tag", () => {
        const input = "text {t} more text";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            { type: NodeType.Text, value: "text " },
            { type: NodeType.Variable, raw: "t" },
            { type: NodeType.Text, value: " more text" },
        ]);
    });

    it("should parse multiple adjacent tags", () => {
        const input = "{first}{second}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            { type: NodeType.Variable, raw: "first" },
            { type: NodeType.Variable, raw: "second" },
        ]);
    });

    it("should handle custom tag delimiters", () => {
        const input = "$(tag)";
        const parser = new Parser({
            strict: true,
            lexerOptions: { tagStart: "$(", tagEnd: ")" },
        });

        const result = parser.parse(input);

        expect(result).toEqual([{ type: NodeType.Variable, raw: "tag" }]);
    });

    it("should parse text with escaped tags as literal text", () => {
        const input = "\\{tag} here \\{func:arg}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            { type: NodeType.Text, value: "{tag} here {func:arg}" },
        ]);
    });

    // Strict mode-specific cases
    it("should throw an error for empty tags in strict mode", () => {
        const input = "{}";
        expect(() => globalParser.parse(input)).toThrow(
            "Tags must start with a literal character and not be empty.",
        );
    });

    it("should throw an error for unclosed tags in strict mode", () => {
        const input = "{tag";
        expect(() => globalParser.parse(input)).toThrow(
            "Unexpected end of input",
        );
    });

    it("should throw an error for tags with spaces in strict mode", () => {
        const input = "{spaced tag}";
        expect(() => globalParser.parse(input)).toThrow(
            "Tags cannot contain spaces. Escape them or disable strict mode.",
        );
    });

    it("should throw an error for unexpected token in nested tags", () => {
        const input = "{outer{inner}}";
        expect(() => globalParser.parse(input)).toThrow(
            "Unexpected token encountered within tag. Escape it or disable strict mode.",
        );
    });

    it("should throw an error for tag with unexpected colon but no arguments", () => {
        const input = "{tag:}";
        expect(() => globalParser.parse(input)).toThrow(
            "Expected at least one argument for the tag payload.",
        );
    });

    it("should parse function tag with single argument", () => {
        const input = "{func:arg}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "func",
                args: [
                    {
                        type: NodeType.Argument,
                        nodes: [{ type: NodeType.Text, value: "arg" }],
                    },
                ],
            },
        ]);
    });

    it("should parse function tag with multiple arguments", () => {
        const input = "{func:arg1|arg2|arg3}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "func",
                args: [
                    {
                        type: NodeType.Argument,
                        nodes: [{ type: NodeType.Text, value: "arg1" }],
                    },
                    {
                        type: NodeType.Argument,
                        nodes: [{ type: NodeType.Text, value: "arg2" }],
                    },
                    {
                        type: NodeType.Argument,
                        nodes: [{ type: NodeType.Text, value: "arg3" }],
                    },
                ],
            },
        ]);
    });

    it("should parse escaped pipe within argument", () => {
        const input = "{func:a\\|b}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "func",
                args: [
                    {
                        type: NodeType.Argument,
                        nodes: [{ type: NodeType.Text, value: "a|b" }],
                    },
                ],
            },
        ]);
    });

    it("should keep backslash-colon in argument (colon not escaped)", () => {
        const input = "{func:a\\:b}";
        const result = globalParser.parse(input);

        // Colon is not a special escape character inside arguments - backslash is kept
        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "func",
                args: [
                    {
                        type: NodeType.Argument,
                        nodes: [{ type: NodeType.Text, value: "a\\:b" }],
                    },
                ],
            },
        ]);
    });

    it("should parse escaped closing brace within argument", () => {
        const input = "{func:a\\}b}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "func",
                args: [
                    {
                        type: NodeType.Argument,
                        nodes: [{ type: NodeType.Text, value: "a}b" }],
                    },
                ],
            },
        ]);
    });

    it("should parse multiple tags interspersed with text", () => {
        const input = "Hello {name}, your balance is {balance}.";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            { type: NodeType.Text, value: "Hello " },
            { type: NodeType.Variable, raw: "name" },
            { type: NodeType.Text, value: ", your balance is " },
            { type: NodeType.Variable, raw: "balance" },
            { type: NodeType.Text, value: "." },
        ]);
    });

    it("should throw error for unclosed nested function", () => {
        const input = "{outer:arg{inner}";
        expect(() => globalParser.parse(input)).toThrow(
            "Unexpected end of input",
        );
    });

    it("should treat double backslash before pipe as escaped pipe", () => {
        const input = "{func:\\\\|arg}";
        const result = globalParser.parse(input);

        // Double backslash before pipe: first backslash escapes the second,
        // but backslash-pipe escapes the pipe, so \\| becomes single argument with \|
        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "func",
                args: [
                    {
                        type: NodeType.Argument,
                        nodes: [{ type: NodeType.Text, value: "\\|arg" }],
                    },
                ],
            },
        ]);
    });

    it("should handle only text input with no tags", () => {
        const input = "just plain text";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            { type: NodeType.Text, value: "just plain text" },
        ]);
    });

    it("should handle empty input", () => {
        const input = "";
        const result = globalParser.parse(input);

        expect(result).toEqual([]);
    });

    it("should throw error for space after tag name before colon", () => {
        const input = "{func :arg}";
        expect(() => globalParser.parse(input)).toThrow(
            "Tags cannot contain spaces. Escape them or disable strict mode.",
        );
    });

    it("should parse function with colons in arguments", () => {
        const input = "{time:HH:mm:ss}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "time",
                args: [
                    {
                        type: NodeType.Argument,
                        nodes: [{ type: NodeType.Text, value: "HH:mm:ss" }],
                    },
                ],
            },
        ]);
    });
});
