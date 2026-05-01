import type { TagHandler } from "../../types.js";

/**
 * Escape Discord markdown so user input renders as literal text.
 * Covers: * _ ~ ` | > \ and the backtick zero-width trick.
 */
export function escapeDiscordMarkdown(input: string): string {
    return input.replace(/([*_~`|>\\])/g, "\\$1");
}

/**
 * Escape user mentions, role mentions, channel mentions, and @everyone/@here
 * by inserting a zero-width space after the @ and #. Keeps text readable.
 */
export function escapeDiscordMentions(input: string): string {
    return input
        .replace(/@(everyone|here)/g, "@\u200B$1")
        .replace(/<@!?(\d+)>/g, "<@\u200B$1>")
        .replace(/<@&(\d+)>/g, "<@&\u200B$1>")
        .replace(/<#(\d+)>/g, "<#\u200B$1>");
}

/**
 * Escape both markdown and mentions. Use this on any user-provided text
 * before splicing into a message.
 */
export function escapeDiscord(input: string): string {
    return escapeDiscordMentions(escapeDiscordMarkdown(input));
}

/**
 * Markdown-aware escape: leaves text inside fenced code blocks alone, and
 * inside inline code spans only escapes the backticks themselves. Useful
 * when you want to preserve formatting in a templated message but still
 * sanitize ambient text.
 */
export function escapeDiscordPreservingCode(input: string): string {
    // Split by fenced code blocks first.
    const fenceRegex = /(```[\s\S]*?```)/g;
    return input
        .split(fenceRegex)
        .map((part, i) => {
            if (i % 2 === 1) return part; // fenced block — leave as-is
            // Then inline code spans within prose.
            const inlineRegex = /(`[^`\n]*`)/g;
            return part
                .split(inlineRegex)
                .map((p, j) => (j % 2 === 1 ? p : escapeDiscord(p)))
                .join("");
        })
        .join("");
}

/**
 * Basic HTML escape — handy when bots cross-post to webhooks/web UIs.
 */
export function escapeHtml(input: string): string {
    return input
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

/** Discord embed limits for v10. */
export const DISCORD_LIMITS = {
    messageContent: 2_000,
    embedTitle: 256,
    embedDescription: 4_096,
    embedFieldName: 256,
    embedFieldValue: 1_024,
    embedFooter: 2_048,
    embedAuthorName: 256,
    embedTotal: 6_000,
} as const;

/**
 * Truncate by Unicode code points, not UTF-16 units. Appends ellipsis if cut.
 */
export function truncate(input: string, max: number, ellipsis = "…"): string {
    const chars = Array.from(input);
    if (chars.length <= max) return input;
    const room = Math.max(0, max - Array.from(ellipsis).length);
    return chars.slice(0, room).join("") + ellipsis;
}

/**
 * {mention:userId} → "<@userId>"
 */
export const mentionTag: TagHandler = (args) => {
    if (args.length !== 1 || !args[0]) return "";
    const id = args[0]?.trim();
    if (!/^\d{15,21}$/.test(id)) return "";
    return `<@${id}>`;
};

/**
 * {channel:channelId} → "<#channelId>"
 */
export const channelTag: TagHandler = (args) => {
    if (args.length !== 1 || !args[0]) return "";
    const id = args[0]?.trim();
    if (!/^\d{15,21}$/.test(id)) return "";
    return `<#${id}>`;
};

/**
 * {role:roleId} → "<@&roleId>"
 */
export const roleTag: TagHandler = (args) => {
    if (args.length !== 1 || !args[0]) return "";
    const id = args[0]?.trim();
    if (!/^\d{15,21}$/.test(id)) return "";
    return `<@&${id}>`;
};

/**
 * {emoji:name|id} → "<:name:id>" (or animated with {animEmoji:name|id})
 */
export const emojiTag: TagHandler = (args) => {
    if (args.length !== 2) return "";
    const [name, id] = args;
    if (!name || !id || !/^\d{15,21}$/.test(id.trim())) return "";
    return `<:${name}:${id.trim()}>`;
};

export const animEmojiTag: TagHandler = (args) => {
    if (args.length !== 2) return "";
    const [name, id] = args;
    if (!name || !id || !/^\d{15,21}$/.test(id.trim())) return "";
    return `<a:${name}:${id.trim()}>`;
};

/**
 * {timestamp:unixSeconds|style?} → "<t:unix:R>" etc.
 * Style: t T d D f F R (Discord's standard set).
 */
export const timestampTag: TagHandler = (args) => {
    if (args.length < 1 || args.length > 2) return "";
    const ts = args[0]?.trim();
    if (!ts) return "";
    if (!/^\d+$/.test(ts)) return "";
    const style = args[1]?.trim();
    if (style && !/^[tTdDfFR]$/.test(style)) return `<t:${ts}>`;
    return style ? `<t:${ts}:${style}>` : `<t:${ts}>`;
};

/**
 * {escape:text} — escape user-provided text against markdown + mentions.
 */
export const escapeTag: TagHandler = (args) => escapeDiscord(args[0] ?? "");

/**
 * {bold:text} {italic:text} {underline:text} {strike:text} {code:text} {spoiler:text}
 */
export const boldTag: TagHandler = (args) => `**${args[0] ?? ""}**`;
export const italicTag: TagHandler = (args) => `*${args[0] ?? ""}*`;
export const underlineTag: TagHandler = (args) => `__${args[0] ?? ""}__`;
export const strikeTag: TagHandler = (args) => `~~${args[0] ?? ""}~~`;
export const codeTag: TagHandler = (args) =>
    `\`${(args[0] ?? "").replaceAll("`", "\u200B`")}\``;
export const spoilerTag: TagHandler = (args) => `||${args[0] ?? ""}||`;

/**
 * {codeblock:lang|text} — fenced code block. Strips fence chars from input.
 */
export const codeblockTag: TagHandler = (args) => {
    if (args.length === 0 || args.length > 2) return "";
    const [a, b] = args.length === 2 ? args : ["", args[0]];
    const lang = (a ?? "").replace(/[^\w-]/g, "");
    const safe = (b ?? "").replaceAll("```", "``\u200B`");
    return `\`\`\`${lang}\n${safe}\n\`\`\``;
};

export const discordTags = {
    mention: mentionTag,
    channel: channelTag,
    role: roleTag,
    emoji: emojiTag,
    animEmoji: animEmojiTag,
    timestamp: timestampTag,
    escape: escapeTag,
    bold: boldTag,
    italic: italicTag,
    underline: underlineTag,
    strike: strikeTag,
    code: codeTag,
    spoiler: spoilerTag,
    codeblock: codeblockTag,
} as const;
