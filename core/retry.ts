import { state } from "../store";
import { RestAPI } from "@webpack/common";
import { findByPropsLazy } from "@webpack";
import { replaceEmojis, arrayBufferToBase64 } from "../utils/helpers";
import type { CloneFailure } from "../types";

/**
 * Best-effort retry of items that failed during a clone.
 * Uses the ID maps stored on `state` after the clone finished, so it only
 * works while the cloned server is still known (i.e. directly after a clone
 * or while the summary pill is visible).
 */

export interface RetryResult {
    /** `${context}: ${name}` entries that were retried successfully */
    succeeded: string[];
    /** items that failed again (with updated error messages) */
    failed: CloneFailure[];
    /** items that cannot be retried automatically (with reason) */
    skipped: string[];
    /** set when retrying is impossible at all (e.g. no target guild) */
    fatal?: string;
}

const AuthStore = findByPropsLazy("getToken");

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Extract a readable error message from a Discord API error */
function extractErrorMessage(e: any): string {
    let body = e?.body;
    if (!body && e?.text) {
        try {
            body = JSON.parse(e.text);
        } catch {
            body = null;
        }
    }
    if (body && typeof body === "object") {
        return body.message || body?.errors?._errors?.[0]?.message || e?.message || String(e);
    }
    return e?.message || String(e);
}

// ---------------------------------------------------------------------------
// Payload builders (mirror the logic used during the original clone)
// ---------------------------------------------------------------------------

const VALID_CHANNEL_TYPES = [0, 2, 4, 5, 12, 13, 15, 16];

function buildChannelPayload(ch: any): any {
    const channelMap = state.lastCloneChannelIdMap;
    const roleIdMap = state.lastCloneRoleIdMap;

    const payload: any = {
        name: replaceEmojis(ch.name) || "cloned-channel",
        type: ch.type,
        position: typeof ch.position === "number" && isFinite(ch.position) ? ch.position : 0,
        permission_overwrites: [],
    };

    // categories only accept name/type/position/permission_overwrites
    if (ch.type !== 4) {
        const topic = replaceEmojis(ch.topic);
        if (topic) payload.topic = String(topic).slice(0, 1024);
        payload.nsfw = Boolean(ch.nsfw);
        if (typeof ch.rate_limit_per_user === "number") {
            payload.rate_limit_per_user = Math.min(Math.max(ch.rate_limit_per_user, 0), 21600);
        }

        if (ch.parent_id && channelMap[ch.parent_id]) {
            payload.parent_id = channelMap[ch.parent_id];
        }
    }

    if (ch.type === 2 || ch.type === 13) {
        payload.bitrate = Math.min(Math.max(ch.bitrate || 64000, 8000), 384000);
        payload.user_limit = Math.min(Math.max(ch.user_limit || 0, 0), 99);
    }

    if (ch.type === 15 || ch.type === 16) {
        if (Array.isArray(ch.available_tags)) {
            payload.available_tags = ch.available_tags.map((tag: any) => ({
                name: replaceEmojis(tag.name) || tag.name,
                emoji_id:
                    tag.emoji_id && state.emojiIdMap[tag.emoji_id]
                        ? state.emojiIdMap[tag.emoji_id]
                        : null,
                emoji_name: tag.emoji_name || null,
                moderated: tag.moderated || false,
            }));
        }
        if (ch.default_reaction_emoji) {
            const dre = ch.default_reaction_emoji;
            if (dre.emoji_id && state.emojiIdMap[dre.emoji_id]) {
                payload.default_reaction_emoji = {
                    emoji_id: state.emojiIdMap[dre.emoji_id],
                    emoji_name: dre.emoji_name || null,
                };
            } else if (dre.emoji_name && !dre.emoji_id) {
                payload.default_reaction_emoji = { emoji_id: null, emoji_name: dre.emoji_name };
            }
        }
        if (ch.default_sort_order !== undefined) payload.default_sort_order = ch.default_sort_order;
        if (ch.default_forum_layout !== undefined)
            payload.default_forum_layout = ch.default_forum_layout;
    }

    if (Array.isArray(ch.permission_overwrites)) {
        const mapped = ch.permission_overwrites
            .filter(
                (ow: any) =>
                    ow.type === 0 && (roleIdMap[ow.id] || ow.id === state.lastCloneSourceGuildId)
            )
            .map((ow: any) => ({
                id:
                    ow.id === state.lastCloneSourceGuildId
                        ? state.lastCloneTargetGuildId
                        : roleIdMap[ow.id],
                type: 0,
                allow: ow.allow != null ? String(ow.allow) : "0",
                deny: ow.deny != null ? String(ow.deny) : "0",
            }))
            .filter((ow: any) => ow && typeof ow.id === "string" && ow.id.length > 0);
        if (mapped.length > 0) payload.permission_overwrites = mapped;
    }

    // Sanitisation — Discord rejects invalid form bodies with 400 (50035)
    if (payload.type != null && !VALID_CHANNEL_TYPES.includes(payload.type)) {
        payload.type = 0;
    }
    if (typeof payload.name !== "string" || payload.name.trim() === "") {
        payload.name = "cloned-channel";
    }
    if (payload.name.length > 100) payload.name = payload.name.slice(0, 97) + "...";
    if (payload.bitrate != null) {
        payload.bitrate = Math.min(Math.max(payload.bitrate, 8000), 384000);
    }
    if (payload.user_limit != null) {
        payload.user_limit = Math.min(Math.max(payload.user_limit, 0), 99);
    }
    if (payload.type !== 2 && payload.type !== 13) {
        delete payload.bitrate;
        delete payload.user_limit;
    }

    return payload;
}

function buildRolePayload(role: any): any {
    const payload: any = {
        name: replaceEmojis(role.name) || role.name || "cloned-role",
        permissions: role.permissions != null ? String(role.permissions) : "0",
        color: typeof role.color === "number" ? role.color : 0,
        hoist: Boolean(role.hoist),
        mentionable: Boolean(role.mentionable),
    };
    const unicode = (role as any).unicodeEmoji || (role as any).unicode_emoji;
    if (unicode) payload.unicode_emoji = unicode;
    return payload;
}

// ---------------------------------------------------------------------------
// Per-context retry handlers
// ---------------------------------------------------------------------------

async function retryChannel(ch: any, targetGuildId: string): Promise<void> {
    const payload = buildChannelPayload(ch);
    const resp = await RestAPI.post({
        url: `/guilds/${targetGuildId}/channels`,
        body: payload,
    });
    if (resp?.body?.id && state.lastCloneChannelIdMap) {
        state.lastCloneChannelIdMap[ch.id] = resp.body.id;
    }
}

async function retryRole(role: any, targetGuildId: string): Promise<void> {
    const payload = buildRolePayload(role);
    const resp = await RestAPI.post({
        url: `/guilds/${targetGuildId}/roles`,
        body: payload,
    });
    if (resp?.body?.id && state.lastCloneRoleIdMap) {
        state.lastCloneRoleIdMap[role.id] = resp.body.id;
    }
}

async function retryEmoji(emoji: any, targetGuildId: string): Promise<void> {
    const ext = emoji.animated ? "gif" : "png";
    const response = await fetch(`https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=256`);
    if (!response.ok) throw new Error(`CDN returned ${response.status}`);
    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);

    const resp = await RestAPI.post({
        url: `/guilds/${targetGuildId}/emojis`,
        body: {
            name: emoji.name,
            image: `data:image/${ext};base64,${base64}`,
            roles: [],
        },
    });
    if (resp?.body?.id) {
        state.emojiIdMap[emoji.id] = resp.body.id;
        if (state.lastCloneEmojiIdMap) state.lastCloneEmojiIdMap[emoji.id] = resp.body.id;
    }
}

async function retrySticker(sticker: any, targetGuildId: string): Promise<void> {
    const formatExt: Record<number, string> = { 1: "png", 2: "png", 3: "json", 4: "gif" };
    const ext = formatExt[sticker.format_type] || "png";
    const mimeTypes: Record<number, string> = {
        1: "image/png",
        2: "image/apng",
        3: "application/json",
        4: "image/gif",
    };
    const response = await fetch(`https://media.discordapp.net/stickers/${sticker.id}.${ext}`);
    if (!response.ok) throw new Error(`CDN returned ${response.status}`);

    const blob = await response.blob();
    const file = new File([blob], `${sticker.name}.${ext}`, {
        type: mimeTypes[sticker.format_type] || "image/png",
    });

    const formData = new FormData();
    formData.append("name", sticker.name);
    formData.append("description", sticker.description || "");
    formData.append("tags", sticker.tags || "");
    formData.append("file", file);

    const authToken = AuthStore?.getToken?.();
    if (!authToken) throw new Error("Could not get auth token");

    const resp = await fetch(`/api/v9/guilds/${targetGuildId}/stickers`, {
        method: "POST",
        headers: { Authorization: authToken },
        body: formData,
    });
    if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.message || `Sticker upload failed: ${resp.status}`);
    }
}

async function retrySoundboard(sound: any, targetGuildId: string): Promise<void> {
    const response = await fetch(`https://cdn.discordapp.com/soundboard-sounds/${sound.sound_id}`);
    if (!response.ok) throw new Error(`CDN returned ${response.status}`);

    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);

    const body: any = {
        name: sound.name,
        sound: `data:audio/ogg;base64,${base64}`,
        volume: sound.volume ?? 1,
    };
    if (sound.emoji_id && state.emojiIdMap[sound.emoji_id]) {
        body.emoji_id = state.emojiIdMap[sound.emoji_id];
        if (sound.emoji_name) body.emoji_name = sound.emoji_name;
    } else if (sound.emoji_name) {
        body.emoji_name = sound.emoji_name;
    }

    await RestAPI.post({
        url: `/guilds/${targetGuildId}/soundboard-sounds`,
        body,
    });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function retryFailedItems(failures: CloneFailure[]): Promise<RetryResult> {
    const result: RetryResult = { succeeded: [], failed: [], skipped: [] };

    const targetGuildId = state.lastCloneTargetGuildId;
    if (!targetGuildId) {
        result.fatal = "The cloned server is unknown. Start a new clone instead of retrying.";
        return result;
    }

    for (const failure of failures) {
        const data = failure.sourceData;
        const label = `${failure.context}: ${failure.name}`;

        if (!data) {
            result.skipped.push(`${label} (no source data)`);
            continue;
        }

        try {
            switch (failure.context) {
                case "Channel":
                case "Category":
                    await retryChannel(data, targetGuildId);
                    break;
                case "Role":
                    if (data.id === state.lastCloneSourceGuildId) {
                        // @everyone cannot be created
                        result.skipped.push(`${label} (@everyone always exists)`);
                        continue;
                    }
                    await retryRole(data, targetGuildId);
                    break;
                case "Emoji":
                    await retryEmoji(data, targetGuildId);
                    break;
                case "Sticker":
                    await retrySticker(data, targetGuildId);
                    break;
                case "Soundboard":
                    await retrySoundboard(data, targetGuildId);
                    break;
                case "Onboarding":
                    result.skipped.push(`${label} (re-run the clone to fix onboarding)`);
                    continue;
                default:
                    result.skipped.push(`${label} (unknown item type)`);
                    continue;
            }

            result.succeeded.push(label);
        } catch (e) {
            result.failed.push({
                ...failure,
                error: extractErrorMessage(e),
            });
            console.warn(`[Clonecord] Retry failed for ${label}:`, e);
        }

        // be gentle with the API
        await sleep(600);
    }

    // update the global failure list + stats so a later summary reflects reality
    state.failedItems = result.failed;
    if (state.cloneStats) {
        const statKey: Record<string, keyof typeof state.cloneStats> = {
            Channel: "channelsCloned",
            Category: "categoriesCloned",
            Role: "rolesCloned",
            Emoji: "emojisCloned",
            Sticker: "stickersCloned",
            Soundboard: "soundboardCloned",
        };
        for (const label of result.succeeded) {
            const ctx = label.slice(0, label.indexOf(":"));
            const key = statKey[ctx];
            if (key && typeof state.cloneStats[key] === "number") {
                (state.cloneStats as any)[key]++;
            }
        }
    }

    return result;
}
