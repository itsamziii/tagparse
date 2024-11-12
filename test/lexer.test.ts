import { describe, it, expect } from "vitest";
import { Lexer, TokenType } from "../src/index.js";

describe("Lexer", () => {
    it("should tokenize a simple tag", async () => {
        const input = "{tag}";
        const lexer = new Lexer(input);
        const tokens = [];

        for await (const token of lexer) {
            tokens.push(token);
        }

        expect(tokens).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "tag" },
            { type: TokenType.TagEnd, value: "}" },
        ]);
    });

    it("should tokenize nested tags", async () => {
        const input = "{outer{inner}}";
        const lexer = new Lexer(input);
        const tokens = [];

        for await (const token of lexer) {
            tokens.push(token);
        }

        expect(tokens).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "outer" },
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "inner" },
            { type: TokenType.TagEnd, value: "}" },
            { type: TokenType.TagEnd, value: "}" },
        ]);
    });

    it("should tokenize tags with arguments", async () => {
        const input = "{tag:arg1|arg2}";
        const lexer = new Lexer(input);
        const tokens = [];

        for await (const token of lexer) {
            tokens.push(token);
        }

        expect(tokens).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "tag" },
            { type: TokenType.Colon, value: ":" },
            { type: TokenType.Literal, value: "arg1" },
            { type: TokenType.Pipe, value: "|" },
            { type: TokenType.Literal, value: "arg2" },
            { type: TokenType.TagEnd, value: "}" },
        ]);
    });

    it("should handle custom tag delimiters", async () => {
        const input = "$(tag)";
        const lexer = new Lexer(input, { tagStart: "$(", tagEnd: ")" });
        const tokens = [];

        for await (const token of lexer) {
            tokens.push(token);
        }

        expect(tokens).toEqual([
            { type: TokenType.TagStart, value: "$(" },
            { type: TokenType.Literal, value: "tag" },
            { type: TokenType.TagEnd, value: ")" },
        ]);
    });

    it("should handle spaces within tags", async () => {
        const input = "{tag with spaces}";
        const lexer = new Lexer(input);
        const tokens = [];

        for await (const token of lexer) {
            tokens.push(token);
        }

        expect(tokens).toEqual([
            { type: TokenType.TagStart, value: "{" },
            { type: TokenType.Literal, value: "tag" },
            { type: TokenType.Space, value: " " },
            { type: TokenType.Literal, value: "with" },
            { type: TokenType.Space, value: " " },
            { type: TokenType.Literal, value: "spaces" },
            { type: TokenType.TagEnd, value: "}" },
        ]);
    });
});
