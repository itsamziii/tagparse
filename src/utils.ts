export function getCharPoint(char: string) {
    return char.codePointAt(0);
}

/**
 * Escape characters that Discord interprets as markdown.
 */
export function escapeForDiscord(input: string): string {
    return input.replaceAll(
        /(?<markdownChar>[*>\\_`|~])/g,
        "\\$<markdownChar>",
    );
}

/**
 * Basic HTML escaping for template output.
 */
export function escapeHtml(input: string): string {
    return input
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
