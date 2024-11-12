import { describe, it, expect, vi } from "vitest";
import { ArgumentNode, NodeType, Parser } from "../src/index.js";

describe("Parser class with parseTags set to true", () => {
    const functionParser = vi
        .fn()
        .mockImplementation((name: string, args: ArgumentNode[]) => {
            return `Parsed ${name} function with ${args.length} arguments: ${args.map((arg) => arg.finalValue).join(", ")}`;
        });

    const variableParser = vi.fn().mockImplementation((name: string) => {
        return `Parsed ${name} variable`;
    });

    it("should parse a variable tag", async () => {
        const input = "{hello}";
        const parser = new Parser(input, {
            strict: true,
            functionParser,
            variableParser,
            parseTags: true,
        }); // If things work out in strict mode, they will work out in non strict mode as well
        const result = await parser.parse();

        expect(result).toEqual([
            {
                type: NodeType.Variable,
                raw: "hello",
                value: "Parsed hello variable",
            },
        ]);
    });

    it("should parse a function tag with arguments", async () => {
        const input = "{add:1|2}";
        const parser = new Parser(input, {
            strict: true,
            functionParser,
            variableParser,
            parseTags: true,
        });
        const result = await parser.parse();

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

    it("should parse both function and variable tags", async () => {
        const input = "{add:1|2}{hello}";
        const parser = new Parser(input, {
            strict: true,
            functionParser,
            variableParser,
            parseTags: true,
        });
        const result = await parser.parse();

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

    it("should parse nested variable tag within function tag", async () => {
        const input = "{say:hello {user}.}";
        const parser = new Parser(input, {
            strict: true,
            functionParser,
            variableParser,
            parseTags: true,
        });
        const result = await parser.parse();

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

    // it("", async () => {
    //     const input = "";
    //     const parser = new Parser(input, {
    //         strict: true,
    //         functionParser,
    //         variableParser,
    //         parseTags: true,
    //     });
    // });
});
