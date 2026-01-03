import { describe, it, expect, vi } from "vitest";
import type { ArgumentNode } from "../src/index.js";
import { NodeType, Parser } from "../src/index.js";

describe("Parser class with evaluateTags set to true", () => {
    const functionParser = vi
        .fn()
        .mockImplementation(
            (name: string, args: ArgumentNode[]) =>
                `Parsed ${name} function with ${args.length} arguments: ${args.map((arg) => arg.finalValue).join(", ")}`,
        );

    const variableParser = vi
        .fn()
        .mockImplementation((name: string) => `Parsed ${name} variable`);

    const globalParser = new Parser({
        strict: true,
        functionParser,
        variableParser,
        evaluateTags: true,
    });

    it("should parse a variable tag", () => {
        const input = "{hello}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Variable,
                raw: "hello",
                value: "Parsed hello variable",
            },
        ]);
    });

    it("should parse a variable tag with emoji delimiters", () => {
        const input = "🧪<नाम🔚>";
        const parser = new Parser({
            strict: true,
            lexerOptions: { tagStart: "🧪<", tagEnd: "🔚>" },
            functionParser,
            variableParser,
            evaluateTags: true,
        });
        const result = parser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Variable,
                raw: "नाम",
                value: "Parsed नाम variable",
            },
        ]);
    });

    it("should parse a function tag with arguments", () => {
        const input = "{add:1|2}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "add",
                value: "Parsed add function with 2 arguments: 1, 2",
                args: [
                    {
                        type: NodeType.Argument,
                        finalValue: "1",
                        nodes: [{ type: NodeType.Text, value: "1" }],
                    },
                    {
                        type: NodeType.Argument,
                        finalValue: "2",
                        nodes: [{ type: NodeType.Text, value: "2" }],
                    },
                ],
            },
        ]);
    });

    it("should parse a function tag with escaped special characters", () => {
        const input = "{say:hello \\{user\\}.}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "say",
                value: "Parsed say function with 1 arguments: hello {user}.",
                args: [
                    {
                        type: NodeType.Argument,
                        finalValue: "hello {user}.",
                        nodes: [
                            { type: NodeType.Text, value: "hello {user}." },
                        ],
                    },
                ],
            },
        ]);
    });

    it("should parse both function and variable tags", () => {
        const input = "{add:1|2}{hello}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "add",
                value: "Parsed add function with 2 arguments: 1, 2",
                args: [
                    {
                        type: NodeType.Argument,
                        finalValue: "1",
                        nodes: [{ type: NodeType.Text, value: "1" }],
                    },
                    {
                        type: NodeType.Argument,
                        finalValue: "2",
                        nodes: [{ type: NodeType.Text, value: "2" }],
                    },
                ],
            },
            {
                type: NodeType.Variable,
                raw: "hello",
                value: "Parsed hello variable",
            },
        ]);
    });

    it("should parse nested variable tag within function tag", () => {
        const input = "{say:hello {user}.}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "say",
                value: "Parsed say function with 1 arguments: hello Parsed user variable.",
                args: [
                    {
                        type: NodeType.Argument,
                        nodes: [
                            { type: NodeType.Text, value: "hello " },
                            {
                                type: NodeType.Variable,
                                value: "Parsed user variable",
                                raw: "user",
                            },
                            { type: NodeType.Text, value: "." },
                        ],
                        finalValue: "hello Parsed user variable.",
                    },
                ],
            },
        ]);
    });

    it("should parse multiple function tags in sequence", () => {
        const input = "{add:1|2}{multiply:3|4}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "add",
                value: "Parsed add function with 2 arguments: 1, 2",
                args: [
                    { type: NodeType.Argument, finalValue: "1", nodes: [{ type: NodeType.Text, value: "1" }] },
                    { type: NodeType.Argument, finalValue: "2", nodes: [{ type: NodeType.Text, value: "2" }] },
                ],
            },
            {
                type: NodeType.Function,
                name: "multiply",
                value: "Parsed multiply function with 2 arguments: 3, 4",
                args: [
                    { type: NodeType.Argument, finalValue: "3", nodes: [{ type: NodeType.Text, value: "3" }] },
                    { type: NodeType.Argument, finalValue: "4", nodes: [{ type: NodeType.Text, value: "4" }] },
                ],
            },
        ]);
    });

    it("should parse duplicate variable tags", () => {
        const input = "{user} said hello to {user}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            { type: NodeType.Variable, raw: "user", value: "Parsed user variable" },
            { type: NodeType.Text, value: " said hello to " },
            { type: NodeType.Variable, raw: "user", value: "Parsed user variable" },
        ]);
    });

    it("should parse deeply nested function with multiple variables", () => {
        const input = "{format:{greeting} {name}!}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "format",
                value: "Parsed format function with 1 arguments: Parsed greeting variable Parsed name variable!",
                args: [
                    {
                        type: NodeType.Argument,
                        finalValue: "Parsed greeting variable Parsed name variable!",
                        nodes: [
                            { type: NodeType.Variable, raw: "greeting", value: "Parsed greeting variable" },
                            { type: NodeType.Text, value: " " },
                            { type: NodeType.Variable, raw: "name", value: "Parsed name variable" },
                            { type: NodeType.Text, value: "!" },
                        ],
                    },
                ],
            },
        ]);
    });

    it("should parse function with variable in each argument", () => {
        const input = "{compare:{a}|{b}}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "compare",
                value: "Parsed compare function with 2 arguments: Parsed a variable, Parsed b variable",
                args: [
                    {
                        type: NodeType.Argument,
                        finalValue: "Parsed a variable",
                        nodes: [{ type: NodeType.Variable, raw: "a", value: "Parsed a variable" }],
                    },
                    {
                        type: NodeType.Argument,
                        finalValue: "Parsed b variable",
                        nodes: [{ type: NodeType.Variable, raw: "b", value: "Parsed b variable" }],
                    },
                ],
            },
        ]);
    });

    it("should parse complex template with mixed content", () => {
        const input = "Welcome {user}! Your order #{orderId} for {product} is {status}.";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            { type: NodeType.Text, value: "Welcome " },
            { type: NodeType.Variable, raw: "user", value: "Parsed user variable" },
            { type: NodeType.Text, value: "! Your order #" },
            { type: NodeType.Variable, raw: "orderId", value: "Parsed orderId variable" },
            { type: NodeType.Text, value: " for " },
            { type: NodeType.Variable, raw: "product", value: "Parsed product variable" },
            { type: NodeType.Text, value: " is " },
            { type: NodeType.Variable, raw: "status", value: "Parsed status variable" },
            { type: NodeType.Text, value: "." },
        ]);
    });

    it("should handle parser function returning empty string", () => {
        const emptyVariableParser = vi.fn().mockReturnValue("");
        const parser = new Parser({
            strict: true,
            functionParser,
            variableParser: emptyVariableParser,
            evaluateTags: true,
        });

        const input = "{empty}";
        const result = parser.parse(input);

        expect(result).toEqual([
            { type: NodeType.Variable, raw: "empty", value: "" },
        ]);
    });

    it("should handle function parser returning complex values", () => {
        const complexFunctionParser = vi.fn().mockReturnValue({ computed: true, result: 42 });
        const parser = new Parser({
            strict: true,
            functionParser: complexFunctionParser,
            variableParser,
            evaluateTags: true,
        });

        const input = "{compute:x}";
        const result = parser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "compute",
                value: { computed: true, result: 42 },
                args: [{ type: NodeType.Argument, finalValue: "x", nodes: [{ type: NodeType.Text, value: "x" }] }],
            },
        ]);
    });

    it("should parse function with many arguments", () => {
        const input = "{join:a|b|c|d|e|f|g}";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "join",
                value: "Parsed join function with 7 arguments: a, b, c, d, e, f, g",
                args: [
                    { type: NodeType.Argument, finalValue: "a", nodes: [{ type: NodeType.Text, value: "a" }] },
                    { type: NodeType.Argument, finalValue: "b", nodes: [{ type: NodeType.Text, value: "b" }] },
                    { type: NodeType.Argument, finalValue: "c", nodes: [{ type: NodeType.Text, value: "c" }] },
                    { type: NodeType.Argument, finalValue: "d", nodes: [{ type: NodeType.Text, value: "d" }] },
                    { type: NodeType.Argument, finalValue: "e", nodes: [{ type: NodeType.Text, value: "e" }] },
                    { type: NodeType.Argument, finalValue: "f", nodes: [{ type: NodeType.Text, value: "f" }] },
                    { type: NodeType.Argument, finalValue: "g", nodes: [{ type: NodeType.Text, value: "g" }] },
                ],
            },
        ]);
    });

    it("should handle newlines and special whitespace in text", () => {
        const input = "Line 1\n{var}\tLine 2";
        const result = globalParser.parse(input);

        expect(result).toEqual([
            { type: NodeType.Text, value: "Line 1\n" },
            { type: NodeType.Variable, raw: "var", value: "Parsed var variable" },
            { type: NodeType.Text, value: "\tLine 2" },
        ]);
    });
});
