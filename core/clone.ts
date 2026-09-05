import { NavigationRouter, RestAPI, GuildStore } from "@webpack/common";
import { findByPropsLazy } from "@webpack";

import {
    notify,
    createMainProgressNotification,
    completeMainProgress,
    updateProgress,
    updateWithTime,
    showCloneSummary,
} from "../utils/notifications";

import {
    fetchGuildData,
    fetchGuildRoles,
    extractChannels,
    normalizeChannel,
    fetchAssetBase64,
} from "../utils/api";
import { TaskQueue } from "../utils/TaskQueue";
import { translateError } from "../utils/errorHandler";
import { state, throwIfCancelled } from "../store";
import { CloneOptions } from "../types";
import { Guild } from "@vencord/discord-types";
import { sleep } from "../utils/helpers";
import { CloneContext } from "./types";
import { collectCloneGaps } from "./cloneGaps";
import {
    newRunId,
    saveCheckpoint,
    clearCheckpoint,
    emptyProgress,
    CloneCheckpoint,
} from "./checkpoints";

const AuthStore = findByPropsLazy("getToken");

async function fetchChannelsRaw(guildId: string): Promise<any[]> {
    const token = AuthStore?.getToken?.();
    if (!token) throw new Error("Could not get Discord token");
    const resp = await fetch(`/api/v9/guilds/${guildId}/channels`, {
        headers: { Authorization: token, "Content-Type": "application/json" },
    });
    if (!resp.ok) throw new Error(`Channels fetch failed: ${resp.status}`);
    return await resp.json();
}

async function waitForGuildInStore(guildId: string, maxWaitMs = 10000): Promise<boolean> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
        if (GuildStore.getGuild(guildId)) return true;
        await sleep(200);
    }
    return false;
}

import { extractAndCloneEmojis, cloneRoles } from "./cloneRoles";
import { cloneChannels } from "./cloneChannels";
import { cloneSettings } from "./cloneSettings";
import { cloneOnboarding } from "./cloneOnboarding";
import { cloneStickers, cloneSoundboard } from "./cloneAssets";
import { loadCheckpoint } from "./checkpoints";

export async function resumeClone(checkpointRunId?: string): Promise<boolean> {
    const checkpoint = await loadCheckpoint();
    if (!checkpoint) {
        notify("Nothing to Resume", "No unfinished clone found.", "info");
        return false;
    }
    if (checkpointRunId && checkpoint.runId !== checkpointRunId) return false;

    const guild = GuildStore.getGuild(checkpoint.sourceGuildId);
    if (!guild) {
        notify("Source Missing", "The source server is no longer available.", "error");
        return false;
    }
    const target = GuildStore.getGuild(checkpoint.targetGuildId);
    if (!target) {
        notify(
            "Target Missing",
            "The target server from the checkpoint no longer exists. Starting fresh is safer.",
            "error"
        );
        return false;
    }

    pendingResumeMaps = {
        roleIdMap: { ...checkpoint.roleIdMap },
        channelIdMap: { ...checkpoint.channelIdMap },
        emojiIdMap: { ...checkpoint.emojiIdMap },
    };

    await cloneServer(guild as Guild, {
        ...(checkpoint.options as unknown as CloneOptions),
        targetGuildId: checkpoint.targetGuildId,
        resumeMode: true,
    });
    return true;
}

let pendingResumeMaps: {
    roleIdMap: Record<string, string>;
    channelIdMap: Record<string, string>;
    emojiIdMap: Record<string, string>;
} | null = null;

export async function cloneServer(sourceGuild: Guild, options: CloneOptions) {
    if (state.isCloning) {
        notify("Already Cloning", "Please wait for the current clone to finish", "error");
        return;
    }

    state.isCloning = true;
    state.abortController = new AbortController();
    state.emojiIdMap = {};
    if (pendingResumeMaps) {
        state.emojiIdMap = { ...pendingResumeMaps.emojiIdMap };
    }
    state.cloneErrors = [];
    state.failedItems = [];
    state.cloneStats = null;
    state.sourceGuildName = sourceGuild.name;
    state.sourceGuildId = sourceGuild.id;
    state.isExistingServer = !!options.targetGuildId;
    state.optionsUsed = { ...options };

    const taskQueue = new TaskQueue(5);
    state.taskQueue = taskQueue;

    const runId = newRunId(sourceGuild.id);
    const checkpointBase = {
        runId,
        sourceGuildId: sourceGuild.id,
        sourceGuildName: sourceGuild.name,
        targetGuildId: "",
        options: { ...options },
        completedAt: null,
        updatedAt: Date.now(),
    };
    const progress = emptyProgress();

    try {
        const guild = GuildStore.getGuild(sourceGuild.id);
        if (!guild) throw new Error("Server not found");

        const fullGuildData = await fetchGuildData(sourceGuild.id);
        let estimateChannels: any[] = [];
        if (options.cloneChannels) {
            const isRealChannel = (ch: any) => ch?.name && ch.name !== "___hidden___";
            try {
                const restChannels = await fetchChannelsRaw(sourceGuild.id);
                estimateChannels = restChannels.filter(isRealChannel);

                const localChannels = extractChannels(sourceGuild.id, true);
                const restChannelIds = new Set(restChannels.map((c: any) => c.id));
                for (const localCh of localChannels) {
                    if (localCh?.id && !restChannelIds.has(localCh.id) && isRealChannel(localCh)) {
                        estimateChannels.push(normalizeChannel(localCh));
                    }
                }
            } catch (e) {
                estimateChannels = extractChannels(sourceGuild.id, true)
                    .filter((ch: any) => ch?.name && ch.name !== "___hidden___")
                    .map(normalizeChannel);
            }
        }

        const estimateRoles = options.cloneRoles ? await fetchGuildRoles(sourceGuild.id) : [];

        const rolesProgressStart = 0;
        const rolesProgressEnd = 30;
        const channelsProgressStart = 30;
        const channelsProgressEnd = 80;
        const settingsProgressEnd = 85;
        const onboardingProgressStart = 85;
        const stickersProgressStart = 85;
        const stickersProgressEnd = 90;
        const soundboardProgressStart = 90;
        const soundboardProgressEnd = 95;

        const pillId = createMainProgressNotification(
            sourceGuild.name,
            "Preparing to clone...",
            undefined,
            state.isExistingServer,
            options.cloneRoles
        );
        state.mainProgressNotificationId = pillId;

        throwIfCancelled();

        updateWithTime("Downloading assets...", 1);

        const [iconData, bannerData, splashData] = await Promise.all([
            fetchAssetBase64(
                `https://cdn.discordapp.com/icons/${sourceGuild.id}/${sourceGuild.icon}.png?size=512`
            ),
            (sourceGuild as any).banner
                ? fetchAssetBase64(
                      `https://cdn.discordapp.com/banners/${sourceGuild.id}/${(sourceGuild as any).banner}.png?size=512`
                  )
                : Promise.resolve(null),
            (sourceGuild as any).splash
                ? fetchAssetBase64(
                      `https://cdn.discordapp.com/splashes/${sourceGuild.id}/${(sourceGuild as any).splash}.png?size=512`
                  )
                : Promise.resolve(null),
        ]);

        throwIfCancelled();

        let newGuildId: string;

        if (options.targetGuildId) {
            newGuildId = options.targetGuildId;

            if (!options.resumeMode) {
                updateWithTime("Preparing target server...", 2);

                try {
                    await RestAPI.patch({
                        url: `/guilds/${newGuildId}`,
                        body: {
                            features: [],
                            system_channel_id: null,
                            rules_channel_id: null,
                            public_updates_channel_id: null,
                        },
                    });
                } catch (e) {
                    console.warn("[Clonecord] Failed to reset guild features:", e);
                }

                const existingChannels = await RestAPI.get({
                    url: `/guilds/${newGuildId}/channels`,
                });
                const deleteChannels = (existingChannels.body || []) as any[];
                if (deleteChannels.length > 0) {
                    updateWithTime(`Deleting ${deleteChannels.length} existing channels...`, 3);
                    const deleteChannelPromises = deleteChannels.map(async (ch: any) => {
                        try {
                            await taskQueue.execute(async () => {
                                await RestAPI.del({ url: `/channels/${ch.id}` });
                            });
                        } catch (e) {
                            console.warn(`[Clonecord] Failed to delete channel ${ch.name}:`, e);
                        }
                    });
                    await Promise.all(deleteChannelPromises);
                }

                const existingRoles = await RestAPI.get({ url: `/guilds/${newGuildId}/roles` });
                const deleteRoles = (existingRoles.body || []).filter(
                    (r: any) => r.name !== "@everyone"
                );
                if (deleteRoles.length > 0) {
                    updateWithTime(`Deleting ${deleteRoles.length} existing roles...`, 5);
                    const deleteRolePromises = deleteRoles.map(async (r: any) => {
                        try {
                            await taskQueue.execute(async () => {
                                await RestAPI.del({ url: `/guilds/${newGuildId}/roles/${r.id}` });
                            });
                        } catch (e) {
                            console.warn(`[Clonecord] Failed to delete role ${r.name}:`, e);
                        }
                    });
                    await Promise.all(deleteRolePromises);
                }

                await sleep(2000);
            }
        } else {
            updateWithTime("Creating new server...", 2);

            const createBody: any = {
                name: `${sourceGuild.name} (Clone)`,
                icon: iconData,
                system_channel_flags: (sourceGuild as any).system_channel_flags || 0,
            };

            const createResp = (await RestAPI.post({ url: "/guilds", body: createBody })) as any;
            newGuildId = createResp?.body?.id;
            if (!newGuildId) throw new Error("Failed to create server — no ID returned");
            state.currentCloneGuildId = newGuildId;

            const appeared = await waitForGuildInStore(newGuildId);
            if (!appeared) {
                console.warn(`[Clonecord] New guild ${newGuildId} not yet in GuildStore`);
            }

            NavigationRouterTransitionToGuild(newGuildId);

            try {
                const defaultChannels = await RestAPI.get({
                    url: `/guilds/${newGuildId}/channels`,
                });
                const channels = (defaultChannels.body || []) as any[];
                for (const ch of channels) {
                    try {
                        await RestAPI.del({ url: `/channels/${ch.id}` });
                    } catch (e) {
                        console.warn("[Clonecord] Failed to delete default channel:", e);
                    }
                }
            } catch (e) {
                console.warn("[Clonecord] Failed to delete default channels:", e);
            }
        }

        const ctx: CloneContext = {
            sourceGuild,
            fullGuildData,
            newGuildId,
            options,
            roleIdMap: pendingResumeMaps ? { ...pendingResumeMaps.roleIdMap } : {},
            channelIdMap: pendingResumeMaps ? { ...pendingResumeMaps.channelIdMap } : {},
            taskQueue,
            estimateChannels,
            estimateRoles,
            rolesProgressStart,
            rolesProgressEnd,
            channelsProgressStart,
            channelsProgressEnd,
            settingsProgressEnd,
            onboardingProgressStart,
            stickersProgressStart,
            stickersProgressEnd,
            soundboardProgressStart,
            soundboardProgressEnd,
        };

        const snapshot = async () => {
            const checkpoint: CloneCheckpoint = {
                ...checkpointBase,
                targetGuildId: newGuildId,
                roleIdMap: { ...ctx.roleIdMap },
                channelIdMap: { ...ctx.channelIdMap },
                emojiIdMap: { ...state.emojiIdMap },
                progress: { ...progress },
                updatedAt: Date.now(),
            };
            await saveCheckpoint(checkpoint);
        };

        throwIfCancelled();

        let emojisCloned = 0;
        if (options.cloneChannels || options.cloneRoles || options.cloneOnboarding) {
            const emojiResult = await extractAndCloneEmojis(ctx);
            emojisCloned = emojiResult.emojisCloned;
            progress.emojisCloned = emojisCloned;
            await snapshot();
        }

        throwIfCancelled();

        let stickersCloned = 0;
        let sourceStickerCount = 0;
        if (options.cloneStickers) {
            updateWithTime("Cloning stickers...", stickersProgressStart);
            try {
                const sourceStickersResp = await RestAPI.get({ url: `/guilds/${sourceGuild.id}/stickers` });
                sourceStickerCount = ((sourceStickersResp as any).body || []).length;
            } catch {}
            stickersCloned = await cloneStickers(ctx);
            progress.stickersCloned = stickersCloned;
            await snapshot();
        }

        throwIfCancelled();

        let soundboardCloned = 0;
        let sourceSoundboardCount = 0;
        if (options.cloneSoundboard) {
            updateWithTime("Cloning soundboard...", soundboardProgressStart);
            try {
                const sourceSoundsResp = await RestAPI.get({ url: `/guilds/${sourceGuild.id}/soundboard-sounds` });
                const body = (sourceSoundsResp as any).body;
                sourceSoundboardCount = (body?.items || body || []).length;
            } catch {}
            soundboardCloned = await cloneSoundboard(ctx);
            progress.soundboardCloned = soundboardCloned;
            await snapshot();
        }

        throwIfCancelled();

        let rolesCloned = 0;
        if (options.cloneRoles) {
            updateWithTime("Cloning roles...", rolesProgressStart);
            const rolesResult = await cloneRoles(ctx);
            rolesCloned = rolesResult.rolesCloned;
            progress.rolesCloned = rolesCloned;
            await snapshot();
        }

        throwIfCancelled();

        let channelsCloned = 0;
        let categoriesCloned = 0;
        if (options.cloneChannels) {
            const channelsResult = await cloneChannels(ctx);
            channelsCloned = channelsResult.channelsCloned;
            categoriesCloned = channelsResult.categoriesCloned;
            progress.channelsCloned = channelsCloned;
            progress.categoriesCloned = categoriesCloned;
            await snapshot();
        }

        throwIfCancelled();

        let onboardingCloned = false;
        if (options.cloneChannels || options.cloneRoles) {
            updateWithTime("Applying settings...", channelsProgressEnd);
            await cloneSettings(ctx);
        }

        throwIfCancelled();

        if (options.cloneOnboarding) {
            await cloneOnboarding(ctx);
            onboardingCloned = true;
        }

        throwIfCancelled();

        if (!options.targetGuildId) {
            try {
                const patchBody: any = {};
                if (bannerData) patchBody.banner = bannerData;
                if (splashData) patchBody.splash = splashData;
                if (fullGuildData.description) patchBody.description = fullGuildData.description;
                if (options.cloneSystemFlags && fullGuildData.system_channel_flags !== undefined) {
                    patchBody.system_channel_flags = fullGuildData.system_channel_flags;
                }
                if (Object.keys(patchBody).length > 0) {
                    await sleep(2000);
                    await RestAPI.patch({ url: `/guilds/${newGuildId}`, body: patchBody });
                }
            } catch (e) {
                console.warn("[Clonecord] Failed to apply final guild settings:", e);
            }
        }

        if (options.targetGuildId) {
            NavigationRouterTransitionToGuild(newGuildId);
        }

        state.cloneStats = {
            channelsCloned,
            categoriesCloned,
            rolesCloned,
            emojisCloned,
            stickersCloned,
            soundboardCloned,
            onboardingCloned,
        };

        state.lastCloneSourceGuildId = sourceGuild.id;
        state.lastCloneTargetGuildId = newGuildId;
        state.lastCloneRoleIdMap = { ...ctx.roleIdMap };
        state.lastCloneChannelIdMap = { ...ctx.channelIdMap };
        state.lastCloneEmojiIdMap = { ...state.emojiIdMap };

        updateProgress(100);
        await clearCheckpoint();

        const hasFailures = state.failedItems.length > 0;
        completeMainProgress(
            pillId,
            hasFailures
                ? `${sourceGuild.name} cloned with ${state.failedItems.length} error${state.failedItems.length > 1 ? "s" : ""}`
                : `${sourceGuild.name} cloned!`,
            !hasFailures
        );

        try {
            const targetGuild = GuildStore.getGuild(newGuildId);
            const gaps = collectCloneGaps({
                source: fullGuildData,
                targetTier: (targetGuild as any)?.premiumTier || 0,
                sourceTier: fullGuildData?.premium_tier || 0,
                sourceStickerCount,
                sourceSoundboardCount,
                options: {
                    cloneChannels: options.cloneChannels,
                    cloneRoles: options.cloneRoles,
                    cloneOnboarding: options.cloneOnboarding,
                    cloneStickers: options.cloneStickers,
                    cloneSoundboard: options.cloneSoundboard,
                },
                stats: {
                    stickersCloned,
                    soundboardCloned,
                    onboardingCloned,
                },
            });
            showCloneSummary(state.cloneStats, state.failedItems, gaps);
        } catch {
            showCloneSummary(state.cloneStats, state.failedItems);
        }
    } catch (e: any) {
        if (e?.message === "Cancelled") {
            if (state.mainProgressNotificationId) {
                completeMainProgress(
                    state.mainProgressNotificationId,
                    "Clone Cancelled — resume from the Clonecord menu",
                    false,
                    "Cancelled"
                );
            }
            return;
        }

        console.error("[Clonecord] Clone failed:", e);
        const errorMsg = translateError(e);
        if (state.mainProgressNotificationId) {
            completeMainProgress(
                state.mainProgressNotificationId,
                errorMsg || "Clone failed",
                false,
                "Error"
            );
        } else {
            notify("Clone Failed", errorMsg, "error", 8000);
        }

        if (state.cloneStats) {
            showCloneSummary(state.cloneStats, state.failedItems);
        }
    } finally {
        pendingResumeMaps = null;
        state.isCloning = false;
        state.abortController = null;
        state.mainProgressNotificationId = null;
        state.currentCloneGuildId = null;
        state.skipRolesCallback = null;
        state.taskQueue = null;
    }
}

function NavigationRouterTransitionToGuild(guildId: string) {
    try {
        (NavigationRouter as any).transitionTo(`/channels/${guildId}`);
    } catch (e) {
        console.warn("[Clonecord] Failed to navigate to guild:", e);
    }
}