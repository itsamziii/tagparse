import { describe, it, expect } from "vitest";
import { Parser, NodeType } from "../src/index.js";

describe("Parser class with strict mode off", () => {
    it("should parse empty tags as text nodes", async () => {
        const input = "{}";
        const parser = new Parser(input);
        const result = await parser.parse();

        expect(result).toEqual([{ type: NodeType.Text, value: "{}" }]);
    });

    it("should treat nested variable tags as text", async () => {
        const input = "{outer{inner}}";
        const parser = new Parser(input);
        const result = await parser.parse();

        expect(result).toEqual([
            { type: NodeType.Text, value: "{outer{inner}}" },
        ]);
    });

    it("should handle errored instance of function tag by passing it back as text node", async () => {
        const input = "{tag:}";
        const parser = new Parser(input);
        const result = await parser.parse();

        expect(result).toEqual([
            {
                type: NodeType.Function,
                name: "tag",
                args: [],
            },
        ]);
    });

    it("should parse unclosed tag as text", async () => {
        const input = "Hello, {tag";
        const parser = new Parser(input);
        const result = await parser.parse();

        expect(result).toEqual([{ type: NodeType.Text, value: "Hello, {tag" }]);
    });

    it("should ignore spaces towards the start of variable tag but return text if space present towards tag end", async () => {
        const input = "Text { spaced tag }";
        const parser = new Parser(input);
        const result = await parser.parse();

        expect(result).toEqual([
            { type: NodeType.Text, value: "Text {spacedtag }" },
        ]);
    });
});
