import { RestAPI, GuildStore } from "@webpack/common";
import { replaceEmojis, arrayBufferToBase64 } from "../utils/helpers";
import { checkGuildExistence } from "../utils/api";
import { updateWithTime, notify } from "../utils/notifications";
import { state } from "../store";
import { handleCloneError } from "../utils/errorHandler";
import { CloneContext } from "./types";

export interface CloneRolesResult {
    rolesCloned: number;
    rolesFailed: number;
}

export interface CloneEmojisResult {
    emojisCloned: number;
    emojisFailed: number;
}

export async function extractAndCloneEmojis(ctx: CloneContext): Promise<CloneEmojisResult> {
    const {
        sourceGuild,
        fullGuildData,
        options,
        estimateRoles,
        estimateChannels,
        newGuildId,
        taskQueue,
    } = ctx;
    const selectedChannelSet = Array.isArray(options.selectedChannelIds)
        ? new Set(options.selectedChannelIds)
        : null;
    const selectedRoleSet = Array.isArray(options.selectedRoleIds)
        ? new Set(options.selectedRoleIds)
        : null;
    const customEmojiIds = new Set<string>();
    let emojisCloned = 0;
    let emojisFailed = 0;

    const addEmojisFromText = (text: string | null | undefined) => {
        if (!text) return;
        const matches = text.matchAll(/<a?:[a-zA-Z0-9_]+:(\d+)>/g);
        for (const match of matches) {
            customEmojiIds.add(match[1]);
        }
    };

    addEmojisFromText(fullGuildData.description);

    if (options.cloneRoles) {
        for (const role of estimateRoles) {
            if (selectedRoleSet && !selectedRoleSet.has(role.id)) continue;
            addEmojisFromText(role.name);
        }
    }

    if (options.cloneChannels) {
        for (const ch of estimateChannels) {
            if (selectedChannelSet && !selectedChannelSet.has(ch.id)) continue;
            addEmojisFromText(ch.name);
            addEmojisFromText(ch.topic);
            if (ch.available_tags) {
                for (const tag of ch.available_tags) {
                    addEmojisFromText(tag.name);
                    if (tag.emoji_id) customEmojiIds.add(tag.emoji_id);
                }
            }
            if (ch.default_reaction_emoji?.emoji_id) {
                customEmojiIds.add(ch.default_reaction_emoji.emoji_id);
            }
        }
    }

    if (options.cloneSoundboard) {
        try {
            const soundboardResp = await RestAPI.get({
                url: `/guilds/${sourceGuild.id}/soundboard-sounds`,
            });
            const sounds =
                (soundboardResp as any).body?.items || (soundboardResp as any).body || [];
            for (const sound of sounds) {
                if (sound.emoji_id) customEmojiIds.add(sound.emoji_id);
            }
        } catch (e) {
            console.warn("[Clonecord] Failed to fetch soundboard data for emoji extraction:", e);
        }
    }

    if (options.cloneOnboarding) {
        try {
            const onboardingResp = await RestAPI.get({
                url: `/guilds/${sourceGuild.id}/onboarding`,
            });
            const onboardingData = (onboardingResp as any).body;
            if (onboardingData) {
                for (const prompt of onboardingData.prompts || []) {
                    addEmojisFromText(prompt.title);
                    for (const opt of prompt.options || []) {
                        addEmojisFromText(opt.title);
                        addEmojisFromText(opt.description);
                        const eid = opt.emoji_id || opt.emoji?.id || null;
                        if (eid) customEmojiIds.add(eid);
                    }
                }
            }
        } catch (e) {
            console.warn("[Clonecord] Failed to fetch onboarding data for emoji extraction:", e);
        }
    }

    const cloneAllEmojis = options.cloneEmojis === true;

    if (cloneAllEmojis || customEmojiIds.size > 0) {
        updateWithTime(
            cloneAllEmojis
                ? `Cloning custom emojis...`
                : `Cloning ${customEmojiIds.size} used emojis...`,
            20
        );

        try {
            const sourceEmojisResp = await RestAPI.get({ url: `/guilds/${sourceGuild.id}/emojis` });
            const sourceEmojis: any[] = (sourceEmojisResp as any).body || [];

            let emojisToClone: any[] = cloneAllEmojis
                ? [...sourceEmojis]
                : sourceEmojis.filter((e: any) => customEmojiIds.has(e.id));

            const targetTier = GuildStore.getGuild(newGuildId)
                ? (GuildStore.getGuild(newGuildId) as any)?.premiumTier || 0
                : 0;
            const emojiSlots = [50, 100, 150, 250][targetTier] ?? 50;

            let targetEmojis: any[] = [];
            try {
                const targetEmojisResp = await RestAPI.get({ url: `/guilds/${newGuildId}/emojis` });
                targetEmojis = (targetEmojisResp as any).body || [];
            } catch (e) {
                console.warn("[Clonecord] Failed to fetch target emojis:", e);
            }

            const existingByName = new Map(targetEmojis.map((e: any) => [e.name, e]));
            const filteredEmojis: any[] = [];
            for (const emoji of emojisToClone) {
                const existing = existingByName.get(emoji.name);
                if (existing) {
                    state.emojiIdMap[emoji.id] = existing.id;
                } else {
                    filteredEmojis.push(emoji);
                }
            }
            emojisToClone = filteredEmojis;

            const availableSlots = Math.max(0, emojiSlots - targetEmojis.length);
            const skipped = Math.max(0, emojisToClone.length - availableSlots);
            emojisToClone = emojisToClone.slice(0, availableSlots);

            if (skipped > 0) {
                notify(
                    "Emoji Limit",
                    `Target server (Tier ${targetTier}) has ${availableSlots} free emoji slots. ${skipped} emoji(s) will be skipped.`,
                    "info",
                    8000
                );
            }

            if (emojisToClone.length === 0) {
                updateWithTime("No emojis to clone (slots full or all exist).", 25);
                return { emojisCloned, emojisFailed };
            }

            let emojiStep = 0;
            const emojiPromises = emojisToClone.map(async (emoji: any) => {
                if (!state.isCloning) return;

                if (options.resumeMode) {
                    const existing = targetEmojis.find((e) => e.name === emoji.name);
                    if (existing) {
                        state.emojiIdMap[emoji.id] = existing.id;
                        emojiStep++;
                        updateWithTime(
                            `Skipping existing emoji (${emojiStep}/${emojisToClone.length})...`,
                            20 + (emojiStep / emojisToClone.length) * 5
                        );
                        return;
                    }
                }

                try {
                    const ext = emoji.animated ? "gif" : "png";
                    const emojiUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=256`;
                    const response = await fetch(emojiUrl);
                    if (response.ok) {
                        const buffer = await response.arrayBuffer();
                        const base64 = arrayBufferToBase64(buffer);
                        const imageStr = `data:image/${ext};base64,${base64}`;

                        await taskQueue.execute(
                            async () => {
                                const createResp = await RestAPI.post({
                                    url: `/guilds/${newGuildId}/emojis`,
                                    body: {
                                        name: emoji.name,
                                        image: imageStr,
                                        roles: [],
                                    },
                                });
                                if (createResp?.body?.id) {
                                    state.emojiIdMap[emoji.id] = createResp.body.id;
                                }
                            },
                            (msg) =>
                                updateWithTime(msg, 20 + (emojiStep / emojisToClone.length) * 5)
                        );

                        emojiStep++;
                        emojisCloned++;
                        updateWithTime(
                            `Cloned emoji ${emoji.name} (${emojiStep}/${emojisToClone.length})...`,
                            20 + (emojiStep / emojisToClone.length) * 5,
                            emojisToClone.length - emojiStep
                        );
                    }
                } catch (e) {
                    emojisFailed++;
                    state.failedItems.push({
                        context: "Emoji",
                        name: emoji.name,
                        error: (e as Error)?.message || String(e),
                        sourceData: emoji,
                    });
                    handleCloneError("Emoji", e, emoji.name);
                }
            });

            await Promise.all(emojiPromises);
        } catch (e) {
            console.warn("[Clonecord] Failed to fetch source emojis:", e);
        }
    }

    return { emojisCloned, emojisFailed };
}

export async function cloneRoles(ctx: CloneContext): Promise<CloneRolesResult> {
    let rolesFailed = 0;
    let rolesCloned = 0;
    const {
        sourceGuild,
        newGuildId,
        options,
        estimateRoles,
        rolesProgressStart,
        rolesProgressEnd,
        taskQueue,
        roleIdMap,
    } = ctx;

    let skipRoles = false;
    if (state.mainProgressNotificationId) {
        const skipBtn = document
            .getElementById(state.mainProgressNotificationId)
            ?.querySelector(".cc-skip-roles-btn") as HTMLElement;
        if (skipBtn) skipBtn.style.display = "";

        const ogSkip = state.skipRolesCallback;
        state.skipRolesCallback = () => {
            skipRoles = true;
            if (ogSkip) ogSkip();
        };
    }

    const selectedRoleSet = Array.isArray(options.selectedRoleIds)
        ? new Set(options.selectedRoleIds)
        : null;
    const isSelectedRole = (r: any) => !selectedRoleSet || selectedRoleSet.has(r.id);

    const sortedRoles = estimateRoles
        .filter((r) => r.name !== "@everyone" && isSelectedRole(r))
        .sort((a: any, b: any) => b.position - a.position);
    const everyoneRole = estimateRoles.find((r: any) => r.name === "@everyone");

    const newRoles = await RestAPI.get({ url: `/guilds/${newGuildId}/roles` });
    const existingTargetRoles = newRoles.body || [];
    const newEveryoneRole = existingTargetRoles.find((r: any) => r.name === "@everyone");

    if (everyoneRole && newEveryoneRole) {
        roleIdMap[everyoneRole.id] = newEveryoneRole.id;
        try {
            await RestAPI.patch({
                url: `/guilds/${newGuildId}/roles/${newEveryoneRole.id}`,
                body: { permissions: everyoneRole.permissions.toString() },
            });
        } catch (e) {
            console.warn("[Clonecord] Failed to update @everyone role:", e);
        }
    }

    if (options.resumeMode) {
        for (const role of sortedRoles) {
            if (!roleIdMap[role.id]) continue;
            const match = existingTargetRoles.find((r: any) => r.id === roleIdMap[role.id]);
            if (match) {
                const expectedName = replaceEmojis(role.name) || role.name;
                if (match.name !== expectedName) {
                    try {
                        await RestAPI.patch({
                            url: `/guilds/${newGuildId}/roles/${match.id}`,
                            body: { name: expectedName },
                        });
                    } catch (e) {
                        console.warn(`[Clonecord] Failed to patch role emoji: ${role.name}`, e);
                    }
                }
            }
        }
    }

    const rolesToCreate = options.resumeMode
        ? sortedRoles.filter((r: any) => !roleIdMap[r.id])
        : sortedRoles;
    const actionLabel = options.resumeMode ? "Resuming" : "Cloning";

    const targetGuildForTier = GuildStore.getGuild(newGuildId);
    const targetTier = (targetGuildForTier as any)?.premiumTier || 0;
    const canUseRoleIcons = targetTier >= 2;

    let roleStep = 0;
    const rolePromises = rolesToCreate.map(async (role: any) => {
        if (!state.isCloning) return;
        if (skipRoles) return;

        try {
            checkGuildExistence(sourceGuild.id, newGuildId);

            const rolePayload: any = {
                name: replaceEmojis(role.name),
                permissions: role.permissions.toString(),
                color: role.color,
                hoist: role.hoist,
                mentionable: role.mentionable,
            };

            if (canUseRoleIcons) {
                rolePayload.unicode_emoji =
                    (role as any).unicodeEmoji || (role as any).unicode_emoji || null;
                const roleIcon = (role as any).icon;
                if (roleIcon) {
                    try {
                        const iconExt = String(roleIcon).startsWith("a_") ? "gif" : "png";
                        const iconMime = iconExt === "gif" ? "image/gif" : "image/png";
                        const iconUrl = `https://cdn.discordapp.com/role-icons/${role.id}/${roleIcon}.${iconExt}?size=128`;
                        const iconResp = await fetch(iconUrl);
                        if (iconResp.ok) {
                            const iconBuf = await iconResp.arrayBuffer();
                            rolePayload.icon = `data:${iconMime};base64,${arrayBufferToBase64(iconBuf)}`;
                        }
                    } catch (e) {
                        console.warn("[Clonecord] Failed to fetch role icon:", e);
                    }
                }
            }

            const response = await taskQueue.execute(
                async () => {
                    try {
                        return await RestAPI.post({
                            url: `/guilds/${newGuildId}/roles`,
                            body: rolePayload,
                        });
                    } catch (e: any) {
                        let code = e?.body?.code || e?.code;
                        if (!code && e?.text) {
                            try {
                                code = JSON.parse(e.text)?.code;
                            } catch {}
                        }
                        if (code === 50101) {
                            delete rolePayload.icon;
                            delete rolePayload.unicode_emoji;
                            return await RestAPI.post({
                                url: `/guilds/${newGuildId}/roles`,
                                body: rolePayload,
                            });
                        }
                        throw e;
                    }
                },
                (msg) =>
                    updateWithTime(
                        msg,
                        rolesProgressStart +
                            (roleStep / Math.max(rolesToCreate.length, 1)) *
                                (rolesProgressEnd - rolesProgressStart)
                    ),
                () => skipRoles,
                5
            );

            if (response?.body?.id) {
                roleIdMap[role.id] = response.body.id;
            }

            roleStep++;
            rolesCloned++;
            updateWithTime(
                `${actionLabel} role ${roleStep}/${rolesToCreate.length}: ${role.name}`,
                rolesProgressStart +
                    (roleStep / Math.max(rolesToCreate.length, 1)) *
                        (rolesProgressEnd - rolesProgressStart),
                rolesToCreate.length - roleStep
            );
        } catch (e: any) {
            if (e?.rateLimitExhausted) {
                rolesFailed += rolesToCreate.length - roleStep;
                updateWithTime(`Rate limited, skipping remaining roles...`, rolesProgressEnd);
                skipRoles = true;
                return;
            }
            rolesFailed++;
            state.failedItems.push({
                context: "Role",
                name: role.name,
                error: (e as Error)?.message || String(e),
                sourceData: role,
            });
            handleCloneError("Role", e, role.name);
        }
    });

    await Promise.all(rolePromises);

    const positionUpdates = estimateRoles
        .filter((r: any) => r.name !== "@everyone" && roleIdMap[r.id])
        .map((r: any) => ({ id: roleIdMap[r.id], position: r.position }));
    if (positionUpdates.length > 0) {
        try {
            await taskQueue.execute(async () => {
                await RestAPI.patch({ url: `/guilds/${newGuildId}/roles`, body: positionUpdates });
            });
        } catch (e) {
            console.warn("[Clonecord] Failed to sync role positions:", e);
        }
    }

    if (options.resumeMode && rolesToCreate.length === 0) {
        updateWithTime(`All roles already exist, skipping...`, rolesProgressEnd);
    }

    if (state.mainProgressNotificationId) {
        const skipBtn = document
            .getElementById(state.mainProgressNotificationId)
            ?.querySelector(".cc-skip-roles-btn") as HTMLElement;
        if (skipBtn) skipBtn.style.display = "none";
    }

    return { rolesCloned, rolesFailed };
}
