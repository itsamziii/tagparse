import { describe, expect, it } from "vitest";
import { AggregateParseError } from "../src/lib/errors/Errors.js";
import { parse } from "../src/lib/parser/Parser.js";
import { NodeKind } from "../src/types.js";

describe("parse", () => {
    it("parses plain text", () => {
        const { template, diagnostics } = parse("hello world");
        expect(diagnostics).toEqual([]);
        expect(template.nodes).toHaveLength(1);
        expect(template.nodes[0]?.kind).toBe(NodeKind.Text);
    });

    it("parses a variable", () => {
        const { template } = parse("hi {name}!");
        expect(template.nodes).toHaveLength(3);
        expect(template.nodes[1]).toMatchObject({
            kind: NodeKind.Variable,
            name: "name",
        });
    });

    it("parses a tag with one arg", () => {
        const { template } = parse("{upper:hello}");
        const tag = template.nodes[0];
        expect(tag).toBeDefined();
        if (!tag) throw new Error();
        expect(tag.kind).toBe(NodeKind.Tag);
        if (tag.kind !== NodeKind.Tag) throw new Error();
        expect(tag.name).toBe("upper");
        expect(tag.args).toHaveLength(1);
    });

    it("parses a tag with multiple args", () => {
        const { template } = parse("{if:cond|then|else}");
        const tag = template.nodes[0];
        expect(tag).toBeDefined();
        if (!tag) throw new Error();
        if (tag.kind !== NodeKind.Tag) throw new Error();
        expect(tag.name).toBe("if");
        expect(tag.args).toHaveLength(3);
    });

    it("parses nested tags inside arguments", () => {
        const { template } = parse("{if:{eq:1|1}|yes|no}");
        const outer = template.nodes[0];
        expect(outer).toBeDefined();
        if (!outer) throw new Error();
        if (outer.kind !== NodeKind.Tag) throw new Error();
        expect(outer.name).toBe("if");
        const firstArg = outer.args[0];
        expect(firstArg).toBeDefined();
        if (!firstArg) throw new Error();
        const inner = firstArg.nodes[0];
        expect(inner).toBeDefined();
        if (!inner) throw new Error();
        expect(inner.kind).toBe(NodeKind.Tag);
        if (inner.kind !== NodeKind.Tag) throw new Error();
        expect(inner.name).toBe("eq");
    });

    it("does NOT silently strip spaces from variable names (v1 footgun)", () => {
        const { template } = parse("{ name }");
        // We get a variable with name " name " — preserved.
        const v = template.nodes[0];
        expect(v).toBeDefined();
        if (!v) throw new Error();
        expect(v.kind).toBe(NodeKind.Variable);
        if (v.kind !== NodeKind.Variable) throw new Error();
        expect(v.name).toBe(" name ");
    });

    it("treats unclosed tags as text in non-strict mode with a diagnostic", () => {
        const { template, diagnostics } = parse("hello {unclosed");
        expect(
            diagnostics.some(
                (d) => d.severity === "error" && d.message.includes("Unclosed"),
            ),
        ).toBe(true);
        // Recovered as text — render-wise, original input is preserved.
        const allText = template.nodes.every((n) => n.kind === NodeKind.Text);
        expect(allText).toBe(true);
    });

    it("throws AggregateParseError in strict mode for unclosed tag", () => {
        expect(() => parse("hello {unclosed", { strict: true })).toThrow(
            AggregateParseError,
        );
    });

    it("warns on empty tag {} but does not error in non-strict", () => {
        const { diagnostics } = parse("a {} b");
        expect(diagnostics).toContainEqual(
            expect.objectContaining({
                severity: "warning",
                message: expect.stringContaining("Empty"),
            }),
        );
    });

    it("reports errors with positions", () => {
        const { diagnostics } = parse("ok {bad");
        const err = diagnostics.find((d) => d.severity === "error");
        expect(err).toBeDefined();
        expect(err?.span.start.line).toBe(1);
        expect(err?.span.start.column).toBeGreaterThan(0);
    });

    it("respects maxDepth", () => {
        const deep = `${"{a:".repeat(50)}x${"}".repeat(50)}`;
        expect(() => parse(deep, { maxDepth: 5 })).toThrow();
    });

    it("merges adjacent text nodes", () => {
        const { template } = parse("a\\{b\\}c");
        // Should be a single text node "a{b}c"
        const textNodes = template.nodes.filter(
            (n) => n.kind === NodeKind.Text,
        );
        expect(textNodes).toHaveLength(1);
        if (textNodes[0]?.kind !== NodeKind.Text) throw new Error();
        expect(textNodes[0]?.value).toBe("a{b}c");
    });

    it("supports custom delimiters", () => {
        const { template } = parse("hi <%= name %>", {
            tagStart: "<%=",
            tagEnd: "%>",
        });
        const v = template.nodes[1];
        expect(v).toBeDefined();
        if (!v) throw new Error();
        expect(v.kind).toBe(NodeKind.Variable);
        if (v.kind !== NodeKind.Variable) throw new Error();
        expect(v.name).toBe(" name ");
    });
});
