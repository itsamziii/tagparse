import { describe, expect, it } from "vitest";
import {
    escapeForDiscord,
    escapeHtml,
    NodeType,
    ParserAsync,
} from "../src";

describe("ParserAsync", () => {
    it("evaluates variables and functions asynchronously", async () => {
        const parser = new ParserAsync({
            evaluateTags: true,
            variableParser: async (name) => {
                await Promise.resolve();
                return name.toUpperCase();
            },
            functionParser: async (name, args) => {
                await Promise.resolve();
                if (name === "wrap") {
                    return `[${args[0]?.finalValue ?? ""}]`;
                }
                return "";
            },
        });

        const nodes = await parser.parseAsync("Hello {user}! {wrap:ok}");
        const variable = nodes.find(
            (node) => node.type === NodeType.Variable,
        ) as any;
        const func = nodes.find(
            (node) => node.type === NodeType.Function,
        ) as any;

        expect(variable.value).toBe("USER");
        expect(func.value).toBe("[ok]");
        expect(func.args[0]?.finalValue).toBe("ok");
    });

    it("falls back to no-op resolvers when none provided", async () => {
        const parser = new ParserAsync({ evaluateTags: true });
        const nodes = await parser.parseAsync("Hello {user}");
        const variable = nodes.find(
            (node) => node.type === NodeType.Variable,
        ) as any;
        expect(variable.value).toBe("user");
    });
});

describe("escaping helpers", () => {
    it("escapes discord markdown and html", () => {
        expect(escapeForDiscord("*hey*")).toBe("\\*hey\\*");
        expect(escapeHtml('<a "b">')).toBe("&lt;a &quot;b&quot;&gt;");
    });
});
