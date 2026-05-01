import { describe, expect, it } from "vitest";
import { Lexer } from "../src/lib/lexer/Lexer.js";

function kinds(
    input: string,
    opts?: ConstructorParameters<typeof Lexer>[1],
): string[] {
    return [...new Lexer(input, opts)].map(
        (t) => `${t.kind}:${JSON.stringify(t.value)}`,
    );
}

describe("Lexer", () => {
    it("tokenizes plain text", () => {
        expect(kinds("hello world")).toEqual(['Text:"hello world"', 'EOF:""']);
    });

    it("tokenizes a simple tag", () => {
        expect(kinds("hi {name}!")).toEqual([
            'Text:"hi "',
            'TagStart:"{"',
            'Text:"name"',
            'TagEnd:"}"',
            'Text:"!"',
            'EOF:""',
        ]);
    });

    it("tokenizes function tag with pipes", () => {
        expect(kinds("{f:a|b}")).toEqual([
            'TagStart:"{"',
            'Text:"f"',
            'Colon:":"',
            'Text:"a"',
            'Pipe:"|"',
            'Text:"b"',
            'TagEnd:"}"',
            'EOF:""',
        ]);
    });

    it("supports multi-character delimiters", () => {
        expect(kinds("hi {{name}}!", { tagStart: "{{", tagEnd: "}}" })).toEqual(
            [
                'Text:"hi "',
                'TagStart:"{{"',
                'Text:"name"',
                'TagEnd:"}}"',
                'Text:"!"',
                'EOF:""',
            ],
        );
    });

    it("does NOT emit stray TagEnd outside a tag (the v1 bug)", () => {
        // Single } in plain text should be text, not a TagEnd token
        const tokens = kinds("a } b");
        expect(tokens).toEqual(['Text:"a } b"', 'EOF:""']);
    });

    it("does NOT emit unbalanced }} for multi-char delims", () => {
        // The v1 lexer emitted TagEnd("}}") here even with no matching TagStart.
        const tokens = kinds("a }} b", { tagStart: "{{", tagEnd: "}}" });
        expect(tokens).toEqual(['Text:"a }} b"', 'EOF:""']);
    });

    it("treats a single { as text when delimiter is {{", () => {
        expect(kinds("a { b }} c", { tagStart: "{{", tagEnd: "}}" })).toEqual([
            'Text:"a { b }} c"',
            'EOF:""',
        ]);
    });

    it("escape character suppresses the next delimiter", () => {
        expect(kinds("hi \\{name\\}")).toEqual([
            'Text:"hi "',
            'Text:"{"',
            'Text:"name"',
            'Text:"}"',
            'EOF:""',
        ]);
    });

    it("escape character before non-delimiter passes through", () => {
        // \\n becomes literal n. Common pattern: escape "\\" with "\\\\".
        expect(kinds("\\n")).toEqual(['Text:"n"', 'EOF:""']);
    });

    it("trailing escape becomes literal", () => {
        expect(kinds("hello\\")).toEqual([
            'Text:"hello"',
            'Text:"\\\\"',
            'EOF:""',
        ]);
    });

    it("preserves Unicode (emoji) in spans", () => {
        const tokens = [...new Lexer("👋 {emoji}")];
        const text = tokens[0];
        expect(text).toBeDefined();
        if (!text) throw new Error();
        expect(text.value).toBe("👋 ");
        // Emoji is one code point — column should advance by 1
        const tagStart = tokens[1];
        expect(tagStart).toBeDefined();
        if (!tagStart) throw new Error();
        expect(tagStart.span.start.column).toBe(3);
    });

    it("colons and pipes outside tags are text", () => {
        expect(kinds("http://x.com|y")).toEqual([
            'Text:"http://x.com|y"',
            'EOF:""',
        ]);
    });

    it("handles nested tags", () => {
        const tokens = kinds("{outer:{inner}}");
        expect(tokens).toContain('TagStart:"{"');
        // Should see two TagStart, two TagEnd
        expect(tokens.filter((t) => t.startsWith("TagStart")).length).toBe(2);
        expect(tokens.filter((t) => t.startsWith("TagEnd")).length).toBe(2);
    });

    it("custom delimiters: <%= %> work", () => {
        expect(kinds("<%= name %>", { tagStart: "<%=", tagEnd: "%>" })).toEqual(
            ['TagStart:"<%="', 'Text:" name "', 'TagEnd:"%>"', 'EOF:""'],
        );
    });
});
