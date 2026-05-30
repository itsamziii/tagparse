import { describe, expect, it } from "vitest";
import { renderAsync } from "../src/lib/compiler/RenderAsync.js";
import { Template } from "../src/lib/compiler/Template.js";
import { parse } from "../src/lib/parser/Parser.js";
import { builtinTags } from "../src/lib/tags/builtins.js";

describe("Template.render", () => {
    it("substitutes variables from a record", () => {
        const tpl = Template.compile("Hello {user}!");
        expect(tpl.render({ variables: { user: "Alice" } })).toBe(
            "Hello Alice!",
        );
    });

    it("substitutes variables from a resolver function", () => {
        const tpl = Template.compile("Hello {user}!");
        expect(tpl.render({ variables: (name) => name.toUpperCase() })).toBe(
            "Hello USER!",
        );
    });

    it("missing variables become empty string by default", () => {
        const tpl = Template.compile("a{x}b");
        expect(tpl.render({})).toBe("ab");
    });

    it("onMissingVariable can fill in placeholders", () => {
        const tpl = Template.compile("a{x}b");
        expect(tpl.render({ onMissingVariable: (n) => `<${n}>` })).toBe(
            "a<x>b",
        );
    });

    it("evaluates tag handlers eagerly", () => {
        const tpl = Template.compile("{upper:hi}");
        expect(tpl.render({ tags: builtinTags })).toBe("HI");
    });

    it("handles {if} with truthy condition", () => {
        const tpl = Template.compile("{if:{flag}|yes|no}");
        expect(
            tpl.render({ variables: { flag: "true" }, tags: builtinTags }),
        ).toBe("yes");
        expect(tpl.render({ variables: { flag: "" }, tags: builtinTags })).toBe(
            "no",
        );
    });

    it("handles {if} with composed comparison", () => {
        const tpl = Template.compile("{if:{eq:{x}|5}|match|miss}");
        expect(tpl.render({ variables: { x: "5" }, tags: builtinTags })).toBe(
            "match",
        );
        expect(tpl.render({ variables: { x: "6" }, tags: builtinTags })).toBe(
            "miss",
        );
    });

    it("does NOT evaluate the unused branch of {if}", () => {
        let unusedCalled = false;
        const tpl = Template.compile("{if:true|safe|{boom}}");
        tpl.render({
            variables: () => {
                unusedCalled = true;
                return "x";
            },
            tags: builtinTags,
        });
        expect(unusedCalled).toBe(false);
    });

    it("handles {each} with comma list", () => {
        const tpl = Template.compile("{each:a,b,c|<{it}>|, }");
        expect(tpl.render({ tags: builtinTags })).toBe("<a>, <b>, <c>");
    });

    it("each exposes idx and idx1", () => {
        const tpl = Template.compile("{each:x,y|{idx}-{it}|;}");
        expect(tpl.render({ tags: builtinTags })).toBe("0-x;1-y");
    });

    it("nested each", () => {
        const tpl = Template.compile("{each:1,2|{each:a,b|{idx}{it}|}}");
        expect(tpl.render({ tags: builtinTags })).toBe("0a1b0a1b");
    });

    it("each iterates an array variable", () => {
        const tpl = Template.compile("{each:{items}|<{it}>|,}");
        expect(
            tpl.render({
                variables: { items: ["a", "b", "c"] },
                tags: builtinTags,
            }),
        ).toBe("<a>,<b>,<c>");
    });

    it("each iterates an array of numbers and exposes idx1", () => {
        const tpl = Template.compile("{each:{xs}|{idx1}:{it}|;}");
        expect(
            tpl.render({ variables: { xs: [10, 20] }, tags: builtinTags }),
        ).toBe("1:10;2:20");
    });

    it("each on an empty array renders nothing", () => {
        const tpl = Template.compile("[{each:{xs}|{it}}]");
        expect(tpl.render({ variables: { xs: [] }, tags: builtinTags })).toBe(
            "[]",
        );
    });

    it("default tag substitutes empty values", () => {
        const tpl = Template.compile("Hi {default:{name}|stranger}!");
        expect(tpl.render({ tags: builtinTags })).toBe("Hi stranger!");
        expect(
            tpl.render({ variables: { name: "Bob" }, tags: builtinTags }),
        ).toBe("Hi Bob!");
    });

    it("escape characters work in templates", () => {
        const tpl = Template.compile("\\{not a tag\\}");
        expect(tpl.render({})).toBe("{not a tag}");
    });
});

describe("renderAsync", () => {
    it("awaits async resolvers", async () => {
        const { template } = parse("Hello {user}!");
        const out = await renderAsync(template, {
            variables: async (n) => (n === "user" ? "Async" : ""),
        });
        expect(out).toBe("Hello Async!");
    });

    it("runs sync handlers transparently", async () => {
        const { template } = parse("{upper:hi}");
        const out = await renderAsync(template, { tags: builtinTags });
        expect(out).toBe("HI");
    });

    it("handles structural tags asynchronously", async () => {
        const { template } = parse("{if:{x}|yes|no}");
        const out = await renderAsync(template, {
            variables: async (n) => (n === "x" ? "1" : ""),
            tags: builtinTags,
        });
        expect(out).toBe("yes");
    });
});

describe("Template metadata", () => {
    it("collects variable names", () => {
        const tpl = Template.compile("{a} and {b} and {c}");
        expect([...tpl.variableNames].sort()).toEqual(["a", "b", "c"]);
    });

    it("collects tag names", () => {
        const tpl = Template.compile("{upper:{name}} {if:x|y|z}");
        expect([...tpl.tagNames].sort()).toEqual(["if", "upper"]);
    });

    it("hasErrors reflects diagnostics", () => {
        const tpl = Template.compile("{unclosed");
        expect(tpl.hasErrors).toBe(true);
    });
});
