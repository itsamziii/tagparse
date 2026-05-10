import { describe, expect, it } from "vitest";
import { Template } from "../src/lib/compiler/Template.js";
import {
    discordTags,
    escapeDiscord,
    escapeDiscordMarkdown,
    escapeDiscordMentions,
    truncate,
} from "../src/lib/discord/discord.js";

describe("Discord escapers", () => {
    it("escapes markdown chars", () => {
        expect(escapeDiscordMarkdown("**hi**")).toBe("\\*\\*hi\\*\\*");
        expect(escapeDiscordMarkdown("a_b_c")).toBe("a\\_b\\_c");
    });

    it("neutralizes @everyone and @here", () => {
        expect(escapeDiscordMentions("@everyone hi")).toContain(
            "@\u200Beveryone",
        );
        expect(escapeDiscordMentions("@here hi")).toContain("@\u200Bhere");
    });

    it("neutralizes user mentions", () => {
        expect(escapeDiscordMentions("<@123456789012345678>")).toContain(
            "<@\u200B",
        );
    });

    it("escapeDiscord composes both", () => {
        const out = escapeDiscord("**@everyone**");
        expect(out).not.toContain("**@everyone**");
        expect(out).toContain("\\*\\*");
    });
});

describe("Discord tags", () => {
    it("renders mention tag with valid id", () => {
        const tpl = Template.compile("{mention:123456789012345678}");
        expect(tpl.render({ tags: discordTags })).toBe("<@123456789012345678>");
    });

    it("rejects invalid mention id", () => {
        const tpl = Template.compile("{mention:nope}");
        expect(tpl.render({ tags: discordTags })).toBe("");
    });

    it("renders timestamp with style", () => {
        const tpl = Template.compile("{timestamp:1700000000|R}");
        expect(tpl.render({ tags: discordTags })).toBe("<t:1700000000:R>");
    });

    it("renders codeblock with language", () => {
        const tpl = Template.compile("{codeblock:js|console.log(1)}");
        expect(tpl.render({ tags: discordTags })).toBe(
            "```js\nconsole.log(1)\n```",
        );
    });

    it("escape tag escapes user input", () => {
        const tpl = Template.compile("Welcome {escape:{name}}!");
        const out = tpl.render({
            variables: { name: "**@everyone**" },
            tags: discordTags,
        });
        expect(out).not.toContain("**@everyone**");
        expect(out).toContain("\\*\\*");
    });
});

describe("truncate", () => {
    it("truncates by code points, not UTF-16 units", () => {
        // 4 emoji = 4 code points = 8 UTF-16 units
        expect(truncate("👋👋👋👋", 3, "")).toBe("👋👋👋");
    });

    it("appends ellipsis when truncating", () => {
        expect(truncate("hello world", 8)).toBe("hello w…");
    });

    it("returns input unchanged if short enough", () => {
        expect(truncate("hi", 10)).toBe("hi");
    });
});
