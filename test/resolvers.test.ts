import { describe, expect, it } from "vitest";
import { stringify } from "../src/lib/compiler/Render.js";
import { Template } from "../src/lib/compiler/Template.js";
import { pathResolver } from "../src/lib/resolvers/pathResolver.js";

describe("pathResolver", () => {
    it("resolves a top-level variable", () => {
        const tpl = Template.compile("Hi {user}!");
        expect(tpl.render({ variables: pathResolver({ user: "Alice" }) })).toBe(
            "Hi Alice!",
        );
    });

    it("resolves a one-deep dotted path", () => {
        const tpl = Template.compile("Hi {member.proper}!");
        expect(
            tpl.render({
                variables: pathResolver({ member: { proper: "Alice#1234" } }),
            }),
        ).toBe("Hi Alice#1234!");
    });

    it("resolves deeply nested paths", () => {
        const tpl = Template.compile("{a.b.c.d}");
        expect(
            tpl.render({
                variables: pathResolver({ a: { b: { c: { d: "found" } } } }),
            }),
        ).toBe("found");
    });

    it("returns empty string when an intermediate segment is missing", () => {
        const tpl = Template.compile("Hi {member.proper}!");
        expect(tpl.render({ variables: pathResolver({}) })).toBe("Hi !");
    });

    it("does not crash when an intermediate value is null", () => {
        const tpl = Template.compile("Hi {a.b.c}!");
        expect(
            tpl.render({ variables: pathResolver({ a: { b: null } }) }),
        ).toBe("Hi !");
    });

    it("does not crash when an intermediate value is a primitive", () => {
        const tpl = Template.compile("{a.b.c}");
        expect(tpl.render({ variables: pathResolver({ a: { b: 42 } }) })).toBe(
            "",
        );
    });

    it("supports array index access", () => {
        const tpl = Template.compile("First: {items.0.name}");
        expect(
            tpl.render({
                variables: pathResolver({
                    items: [{ name: "apple" }, { name: "banana" }],
                }),
            }),
        ).toBe("First: apple");
    });

    it("rejects non-numeric segments on arrays", () => {
        const tpl = Template.compile("{items.first}");
        expect(tpl.render({ variables: pathResolver({ items: ["a"] }) })).toBe(
            "",
        );
    });

    it("rejects out-of-bounds array indices", () => {
        const tpl = Template.compile("{items.5}");
        expect(
            tpl.render({ variables: pathResolver({ items: ["a", "b"] }) }),
        ).toBe("");
    });

    it("blocks prototype-pollution-style lookups", () => {
        const tpl = Template.compile("{__proto__.polluted}");
        expect(
            tpl.render({
                variables: pathResolver({} as Record<string, unknown>),
            }),
        ).toBe("");
    });

    it("blocks constructor traversal", () => {
        const tpl = Template.compile("{user.constructor.name}");
        expect(
            tpl.render({
                variables: pathResolver({ user: { name: "Alice" } }),
            }),
        ).toBe("");
    });

    it("does not see inherited properties", () => {
        // toString is on Object.prototype but not own.
        const tpl = Template.compile("{user.toString}");
        expect(
            tpl.render({
                variables: pathResolver({ user: { name: "Alice" } }),
            }),
        ).toBe("");
    });

    it("calls zero-arg functions at the leaf", () => {
        const tpl = Template.compile("{user.name}");
        expect(
            tpl.render({
                variables: pathResolver({ user: { name: () => "Alice" } }),
            }),
        ).toBe("Alice");
    });

    it("calls zero-arg functions mid-path", () => {
        const tpl = Template.compile("{user.profile.handle}");
        expect(
            tpl.render({
                variables: pathResolver({
                    user: { profile: () => ({ handle: "@alice" }) },
                }),
            }),
        ).toBe("@alice");
    });

    it("returns empty string when a leaf function throws", () => {
        const tpl = Template.compile("Hi {boom}");
        expect(
            tpl.render({
                variables: pathResolver({
                    boom: () => {
                        throw new Error("nope");
                    },
                }),
            }),
        ).toBe("Hi ");
    });

    it("does not invoke functions that take arguments", () => {
        const tpl = Template.compile("Hi {greet}");
        expect(
            tpl.render({
                variables: pathResolver({ greet: (n: string) => `hi ${n}` }),
            }),
        ).toBe("Hi ");
    });

    it("triggers onMissingVariable when path is unresolved", () => {
        const tpl = Template.compile("Hi {member.proper}!");
        expect(
            tpl.render({
                variables: pathResolver({}),
                onMissingVariable: (n) => `<${n}>`,
            }),
        ).toBe("Hi <member.proper>!");
    });

    it("works with renderAsync", async () => {
        const tpl = Template.compile("Hi {member.proper}!");
        const out = await tpl.renderAsync({
            variables: pathResolver({ member: { proper: "Alice" } }),
        });
        expect(out).toBe("Hi Alice!");
    });

    it("stringifies object leaves as JSON", () => {
        const tpl = Template.compile("{data}");
        expect(
            tpl.render({
                variables: pathResolver({ data: { id: 1, name: "x" } }),
            }),
        ).toBe('{"id":1,"name":"x"}');
    });
});

describe("record resolver auto-calls zero-arg functions", () => {
    it("calls a zero-arg function value", () => {
        const tpl = Template.compile("{user}");
        expect(tpl.render({ variables: { user: () => "Alice" } })).toBe(
            "Alice",
        );
    });

    it("ignores functions that take arguments", () => {
        const tpl = Template.compile("{greet}");
        expect(
            tpl.render({
                variables: { greet: (name: string) => `hi ${name}` },
            }),
        ).toBe("");
    });

    it("does not see inherited keys (no toString resolution)", () => {
        const tpl = Template.compile("{toString}");
        expect(tpl.render({ variables: { user: "Alice" } })).toBe("");
    });

    it("falls through to onMissingVariable when zero-arg fn throws", () => {
        const tpl = Template.compile("{x}");
        expect(
            tpl.render({
                variables: {
                    x: () => {
                        throw new Error("nope");
                    },
                },
                onMissingVariable: () => "<missing>",
            }),
        ).toBe("<missing>");
    });
});

describe("stringify", () => {
    it("returns empty string for null and undefined", () => {
        expect(stringify(null)).toBe("");
        expect(stringify(undefined)).toBe("");
    });

    it("passes strings through", () => {
        expect(stringify("hello")).toBe("hello");
    });

    it("converts numbers and booleans", () => {
        expect(stringify(42)).toBe("42");
        expect(stringify(true)).toBe("true");
        expect(stringify(false)).toBe("false");
    });

    it("converts bigints", () => {
        expect(stringify(123n)).toBe("123");
    });

    it("JSON-encodes plain objects (not [object Object])", () => {
        expect(stringify({ a: 1 })).toBe('{"a":1}');
        expect(stringify({ a: 1 })).not.toBe("[object Object]");
    });

    it("JSON-encodes arrays", () => {
        expect(stringify([1, 2, 3])).toBe("[1,2,3]");
    });

    it("returns empty string for circular references instead of crashing", () => {
        const a: Record<string, unknown> = {};
        a.self = a;
        expect(stringify(a)).toBe("");
    });

    it("uses ISO format for Date", () => {
        const d = new Date("2024-01-15T12:00:00.000Z");
        expect(stringify(d)).toBe("2024-01-15T12:00:00.000Z");
    });

    it("returns empty string for functions and symbols", () => {
        expect(stringify(() => "x")).toBe("");
        expect(stringify(Symbol("x"))).toBe("");
    });

    it("renders objects from tag handlers as JSON, not [object Object]", () => {
        const tpl = Template.compile("Data: {info:x}");
        expect(
            tpl.render({
                tags: { info: () => ({ id: 1 }) as unknown as string },
            }),
        ).toBe('Data: {"id":1}');
    });

    it("renders objects from variable resolvers as JSON", () => {
        const tpl = Template.compile("Data: {info}");
        expect(
            tpl.render({
                variables: () => ({ id: 1 }),
            }),
        ).toBe('Data: {"id":1}');
    });
});
