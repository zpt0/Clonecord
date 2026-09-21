import { state } from "../store";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const randomDelay = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, chunk as any);
    }
    return btoa(binary);
}

export function compareVersions(v1: string, v2: string): number {
    const parts1 = v1
        .replace(/[^0-9.]/g, "")
        .split(".")
        .map((n) => parseInt(n) || 0);
    const parts2 = v2
        .replace(/[^0-9.]/g, "")
        .split(".")
        .map((n) => parseInt(n) || 0);
    const maxLength = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < maxLength; i++) {
        const a = parts1[i] || 0;
        const b = parts2[i] || 0;
        if (a > b) return 1;
        if (a < b) return -1;
    }
    return 0;
}

/**
 * Convert GitHub-flavored release notes to something Discord's message
 * parser renders correctly: Discord has no `#` headings (they would show
 * literally) and collapses single newlines into spaces (everything ends up
 * on one line). Fenced code blocks are left untouched.
 */
export function formatReleaseNotesForDiscord(notes: string): string {
    const normalized = (notes || "").replace(/\r\n/g, "\n");
    const formatted = normalized
        .split(/(```[\s\S]*?(?:```|$))/g)
        .map((segment, index) => {
            // Odd segments are fenced code blocks — leave them alone.
            if (index % 2 === 1) return segment;
            const converted = segment
                .split("\n")
                .map((line) => {
                    const heading = line.match(/^#{1,6}\s+(.*)$/);
                    if (heading) return `**${heading[1].trim()}**`;
                    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) return "";
                    return line;
                })
                .join("\n");
            // Single newlines become paragraph breaks; existing blank lines stay.
            return converted.replace(/(?<!\n)\n(?!\n)/g, "\n\n");
        })
        .join("");
    return formatted.replace(/\n{3,}/g, "\n\n").trim();
}

export const replaceEmojis = (text: string | null | undefined): string | null | undefined => {
    if (!text) return text;
    return text.replace(/<(a?):([a-zA-Z0-9_]+):(\d+)>/g, (match, animated, name, id) => {
        if (state.emojiIdMap[id]) return `<${animated}:${name}:${state.emojiIdMap[id]}>`;
        return match;
    });
};
