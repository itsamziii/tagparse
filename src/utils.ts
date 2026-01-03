export function getCharPoint(char: string) {
    return char.codePointAt(0);
}

/**
 * Escape characters that Discord interprets as markdown.
 */
export function escapeForDiscord(input: string): string {
    return input.replace(/([\\`*_~|>])/g, "\\$1");
}

/**
 * Basic HTML escaping for template output.
 */
export function escapeHtml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
