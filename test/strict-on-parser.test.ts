import { describe, it, expect } from "vitest";
import { Parser, NodeType } from "../src/index.js";

describe("Parser class with strict mode on and parseTags off", () => {
    // Cases with the same behavior in both strict and non-strict modes
    it("should parse a simple tag", async () => {
        const input = "{tag}";
        const parser = new Parser(input, { strict: true });
        const result = await parser.parse();

        expect(result).toEqual([{ type: NodeType.Variable, raw: "tag" }]);
    });

    it("should parse text with a single-character tag", async () => {
        const input = "text {t} more text";
        const parser = new Parser(input, { strict: true });
        const result = await parser.parse();

        expect(result).toEqual([
            { type: NodeType.Text, value: "text " },
            { type: NodeType.Variable, raw: "t" },
            { type: NodeType.Text, value: " more text" },
        ]);
    });

    it("should parse multiple adjacent tags", async () => {
        const input = "{first}{second}";
        const parser = new Parser(input, { strict: true });
        const result = await parser.parse();

        expect(result).toEqual([
            { type: NodeType.Variable, raw: "first" },
            { type: NodeType.Variable, raw: "second" },
        ]);
    });

    it("should handle text outside of tags", async () => {
        const input = "text {tag} more text";
        const parser = new Parser(input, { strict: true });
        const result = await parser.parse();

        expect(result).toEqual([
            { type: NodeType.Text, value: "text " },
            { type: NodeType.Variable, raw: "tag" },
            { type: NodeType.Text, value: " more text" },
        ]);
    });

    it("should handle custom tag delimiters", async () => {
        const input = "$(tag)";
        const parser = new Parser(input, {
            strict: true,
            lexerOptions: { tagStart: "$(", tagEnd: ")" },
        });
        const result = await parser.parse();

        expect(result).toEqual([{ type: NodeType.Variable, raw: "tag" }]);
    });

    it("should parse text with escaped tags as literal text", async () => {
        const input = "\\{tag} here \\{func:arg}";
        const parser = new Parser(input, { strict: true });
        const result = await parser.parse();

        expect(result).toEqual([
            { type: NodeType.Text, value: "{tag} here {func:arg}" },
        ]);
    });

    // Strict mode-specific cases
    it("should throw an error for empty tags in strict mode", async () => {
        const input = "{}";
        const parser = new Parser(input, { strict: true });
        await expect(parser.parse()).rejects.toThrow(
            "Tags must start with a literal character and not be empty.",
        );
    });

    it("should throw an error for unclosed tags in strict mode", async () => {
        const input = "{tag";
        const parser = new Parser(input, { strict: true });
        await expect(parser.parse()).rejects.toThrow("Unexpected end of input");
    });

    it("should throw an error for tags with spaces in strict mode", async () => {
        const input = "{spaced tag}";
        const parser = new Parser(input, { strict: true });
        await expect(parser.parse()).rejects.toThrow(
            "Tags cannot contain spaces.",
        );
    });

    it("should throw an error for unexpected token in nested tags", async () => {
        const input = "{outer{inner}}";
        const parser = new Parser(input, { strict: true });
        await expect(parser.parse()).rejects.toThrow(
            "Unexpected token encountered within tag.",
        );
    });

    it("should throw an error for tag with unexpected colon but no arguments", async () => {
        const input = "{tag:}";
        const parser = new Parser(input, { strict: true });
        await expect(parser.parse()).rejects.toThrow(
            "Expected at least one argument for the tag payload.",
        );
    });
});
