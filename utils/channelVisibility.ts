/**
 * Discord now redacts channels the current user cannot view server-side:
 * `GET /guilds/{id}/channels` omits them entirely and the Gateway sends them
 * with the placeholder name `___hidden___`, the `CHANNEL_OBFUSCATED` flag
 * (1 << 17) set and permission_overwrites reduced to a single @everyone deny.
 *
 * No client-side patch can reconstruct the withheld data — these helpers exist
 * so Clonecord can tell the difference between "channel is hidden from us" and
 * "channel is gone", skip what cannot be cloned and say so honestly.
 */

export const CHANNEL_OBFUSCATED = 1 << 17;
export const REDACTED_CHANNEL_NAME = "___hidden___";

/**
 * Discord exposes an undocumented internal `server-hub` pseudo-channel in some
 * guild channel lists. It is not a user-created channel, was always rejected by
 * the documented create-channel API in older clients (HTTP 400), and must never
 * be cloned into the target server.
 */
export const INTERNAL_PSEUDO_CHANNEL_NAMES = new Set(["server-hub"]);

export function isInternalPseudoChannel(channel: any): boolean {
    const name = channel?.name;
    if (typeof name !== "string") return false;
    return INTERNAL_PSEUDO_CHANNEL_NAMES.has(name.trim().toLowerCase());
}

export interface ChannelVisibilityReport<T extends { id: string } = any> {
    /** channels Discord sent us in full — safe to clone */
    cloneable: T[];
    /** channels Discord redacted (placeholder name / obfuscated flag) */
    obfuscated: T[];
    /** channels that exist in the guild but carry no usable data at all */
    missing: T[];
}

export function isObfuscatedChannel(channel: any): boolean {
    if (!channel) return true;
    if (channel.name === REDACTED_CHANNEL_NAME) return true;
    if (typeof channel.flags === "number" && (channel.flags & CHANNEL_OBFUSCATED) !== 0)
        return true;
    return false;
}

function hasUsableData(channel: any): boolean {
    if (!channel || typeof channel !== "object") return false;
    if (typeof channel.id !== "string" || channel.id.length === 0) return false;
    if (typeof channel.name === "string" && channel.name.trim().length > 0) return true;
    return false;
}

export function analyzeChannelVisibility<T extends { id: string }>(
    channels: T[],
    restChannelIds?: string[] | null
): ChannelVisibilityReport<T> {
    const list = Array.isArray(channels) ? channels : [];
    const rest = Array.isArray(restChannelIds) ? new Set(restChannelIds) : null;

    const cloneable: T[] = [];
    const obfuscated: T[] = [];
    const missing: T[] = [];

    for (const ch of list) {
        const restHas = rest ? rest.has(ch?.id) : true;

        if (!hasUsableData(ch) || (!restHas && !isObfuscatedChannel(ch))) {
            // No usable name/type — treat as obfuscated rather than pretending we
            // know what the channel is.
            if (isObfuscatedChannel(ch) || restHas === false) obfuscated.push(ch);
            else missing.push(ch);
            continue;
        }

        if (isObfuscatedChannel(ch) || restHas === false) {
            obfuscated.push(ch);
            continue;
        }

        cloneable.push(ch);
    }

    return { cloneable, obfuscated, missing };
}

export function buildHiddenChannelsNote(counts: {
    obfuscated: number;
    missing: number;
}): string | null {
    const { obfuscated, missing } = counts;
    if (!obfuscated && !missing) return null;

    const parts: string[] = [];
    if (obfuscated > 0) {
        parts.push(
            `${obfuscated} channel${obfuscated === 1 ? "" : "s"} hidden by Discord (redacted server-side)`
        );
    }
    if (missing > 0) {
        parts.push(`${missing} channel${missing === 1 ? "" : "s"} without usable data`);
    }

    return parts.join("; ");
}
