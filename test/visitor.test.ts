import { describe, expect, it } from "vitest";
import { parse } from "../src/lib/parser/Parser.js";
import {
    collectTagNames,
    collectVariableNames,
    findNodes,
    walk,
} from "../src/lib/visitor/Visitor.js";
import { NodeKind } from "../src/types.js";

function nodes(src: string) {
    return parse(src).template.nodes;
}

function nameOf(n: unknown): string {
    return (n as { name: string }).name;
}

describe("walk", () => {
    it("visits text nodes", () => {
        const visited: string[] = [];
        walk(nodes("hello world"), {
            visitText(n) {
                visited.push(n.value);
            },
        });
        expect(visited).toEqual(["hello world"]);
    });

    it("visits variable nodes", () => {
        const names: string[] = [];
        walk(nodes("{foo} and {bar}"), {
            visitVariable(n) {
                names.push(n.name);
            },
        });
        expect(names).toEqual(["foo", "bar"]);
    });

    it("visits tag and its argument nodes", () => {
        const tags: string[] = [];
        const argIndices: number[] = [];
        walk(nodes("{upper:hello}"), {
            visitTag(n) {
                tags.push(n.name);
            },
            visitArgument(_n, ctx) {
                argIndices.push(ctx.index);
            },
        });
        expect(tags).toEqual(["upper"]);
        expect(argIndices).toEqual([0]);
    });

    it("enter returning 'skip' skips children", () => {
        const visited: string[] = [];
        walk(nodes("{upper:{name}}"), {
            enter(n) {
                if ("name" in n && nameOf(n) === "upper") return "skip";
                return undefined;
            },
            visitVariable(n) {
                visited.push(n.name);
            },
        });
        expect(visited).toEqual([]);
    });

    it("enter returning 'stop' aborts traversal", () => {
        const visited: string[] = [];
        walk(nodes("{a}{b}{c}"), {
            enter(n) {
                if ("name" in n && nameOf(n) === "b") return "stop";
                return undefined;
            },
            visitVariable(n) {
                visited.push(n.name);
            },
        });
        expect(visited).toEqual(["a"]);
    });

    it("calls leave after children", () => {
        const order: string[] = [];
        walk(nodes("{x}"), {
            enter(n) {
                if ("name" in n) order.push(`enter:${nameOf(n)}`);
                return undefined;
            },
            leave(n) {
                if ("name" in n) order.push(`leave:${nameOf(n)}`);
            },
        });
        expect(order).toEqual(["enter:x", "leave:x"]);
    });

    it("visits nested tag arguments recursively", () => {
        const vars: string[] = [];
        walk(nodes("{if:{flag}|{a}|{b}}"), {
            visitVariable(n) {
                vars.push(n.name);
            },
        });
        expect(vars.sort()).toEqual(["a", "b", "flag"]);
    });
});

describe("findNodes", () => {
    it("finds all variable nodes", () => {
        const found = findNodes(
            nodes("{x} text {y}"),
            (n) => n.kind === NodeKind.Variable,
        );
        expect(found.map(nameOf)).toEqual(["x", "y"]);
    });

    it("finds nodes inside tag arguments", () => {
        const found = findNodes(
            nodes("{upper:{inner}}"),
            (n) => n.kind === NodeKind.Variable,
        );
        expect(found).toHaveLength(1);
        expect(nameOf(found[0])).toBe("inner");
    });

    it("returns empty array when nothing matches", () => {
        expect(
            findNodes(nodes("plain text"), (n) => n.kind === NodeKind.Tag),
        ).toEqual([]);
    });
});

describe("collectVariableNames", () => {
    it("collects all variable names including nested", () => {
        const names = collectVariableNames(nodes("{a} {if:{b}|{c}|{d}}"));
        expect([...names].sort()).toEqual(["a", "b", "c", "d"]);
    });
});

describe("collectTagNames", () => {
    it("collects tag names including nested", () => {
        const names = collectTagNames(nodes("{upper:{lower:x}}"));
        expect([...names].sort()).toEqual(["lower", "upper"]);
    });
});
