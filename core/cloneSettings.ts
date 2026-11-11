import { RestAPI } from "@webpack/common";
import { updateWithTime } from "../utils/notifications";
import { handleCloneError } from "../utils/errorHandler";
import { CloneContext } from "./types";

function getErrCode(error: any): number | null {
    let code = error?.body?.code ?? error?.code;
    if (!code && error?.text) {
        try {
            code = JSON.parse(error.text)?.code;
        } catch {}
    }
    return typeof code === "number" ? code : null;
}

export async function cloneSettings(ctx: CloneContext) {
    const {
        fullGuildData,
        newGuildId,
        channelIdMap,
        taskQueue,
        settingsProgressEnd,
        estimateChannels,
    } = ctx;

    try {
        const isCommunity =
            fullGuildData.features?.includes("COMMUNITY") ||
            estimateChannels.some((c: any) => [5, 13, 15, 16].includes(c.type));

        // Fields every guild accepts (needs MANAGE_GUILD, which the clone
        // target owner always has)
        const safePayload: any = {};
        if (fullGuildData.system_channel_id && channelIdMap[fullGuildData.system_channel_id]) {
            safePayload.system_channel_id = channelIdMap[fullGuildData.system_channel_id];
        }
        if (fullGuildData.afk_channel_id && channelIdMap[fullGuildData.afk_channel_id]) {
            safePayload.afk_channel_id = channelIdMap[fullGuildData.afk_channel_id];
        }

        // Fields that are only valid on guilds with the COMMUNITY feature
        const communityPayload: any = {};
        if (fullGuildData.rules_channel_id && channelIdMap[fullGuildData.rules_channel_id]) {
            communityPayload.rules_channel_id = channelIdMap[fullGuildData.rules_channel_id];
        }
        if (
            fullGuildData.public_updates_channel_id &&
            channelIdMap[fullGuildData.public_updates_channel_id]
        ) {
            communityPayload.public_updates_channel_id =
                channelIdMap[fullGuildData.public_updates_channel_id];
        }
        if (
            fullGuildData.safety_alerts_channel_id &&
            channelIdMap[fullGuildData.safety_alerts_channel_id]
        ) {
            communityPayload.safety_alerts_channel_id =
                channelIdMap[fullGuildData.safety_alerts_channel_id];
        }

        // Sent as separate PATCHes so one rejected part cannot take the
        // others (or the running clone) down. Discord 403s are permanent —
        // no point retrying them five times.
        const patchGuild = (body: any) =>
            taskQueue.execute(
                async () => {
                    await RestAPI.patch({
                        url: `/guilds/${newGuildId}`,
                        body,
                    });
                },
                undefined,
                undefined,
                2
            );

        // 1) Safe bindings — independent of the community feature
        if (Object.keys(safePayload).length > 0) {
            try {
                await patchGuild(safePayload);
            } catch (e: any) {
                handleCloneError("Settings", e, "Server channels", { neverFatal: true });
            }
        }

        // 2) Enable COMMUNITY on its own. Deliberately only this feature:
        //    copying things like INVITES_DISABLED (raid pause) is undesirable
        //    and rejected by Discord with 403.
        let communityEnabled = false;
        if (isCommunity) {
            try {
                await patchGuild({ features: ["COMMUNITY"] });
                communityEnabled = true;
            } catch (e: any) {
                const code = getErrCode(e);
                if (code === 50055) {
                    // target already has the feature — treat as success
                    communityEnabled = true;
                } else if (code !== 40006) {
                    // 40006 = guild is being updated (transient) — ignore
                    handleCloneError("Settings", e, "Community feature", { neverFatal: true });
                }
            }
        }

        // 3) Community-bound bindings — only valid once community is active
        if (communityEnabled && Object.keys(communityPayload).length > 0) {
            try {
                await patchGuild(communityPayload);
            } catch (e: any) {
                handleCloneError("Settings", e, "Community channels", { neverFatal: true });
            }
        }

        const positionUpdates: any[] = [];
        const categories = estimateChannels.filter((c: any) => c.type === 4);
        const otherChannels = estimateChannels.filter((c: any) => c.type !== 4);

        for (const cat of categories) {
            if (channelIdMap[cat.id]) {
                positionUpdates.push({
                    id: channelIdMap[cat.id],
                    position: typeof cat.position === "number" ? cat.position : 0,
                });
            }
        }
        for (const ch of otherChannels) {
            if (channelIdMap[ch.id]) {
                positionUpdates.push({
                    id: channelIdMap[ch.id],
                    position: typeof ch.position === "number" ? ch.position : 0,
                });
            }
        }

        if (positionUpdates.length > 0) {
            updateWithTime("Syncing channel positions...", settingsProgressEnd - 2);
            const chunkSize = 50;
            const positionPromises: Promise<any>[] = [];
            for (let i = 0; i < positionUpdates.length; i += chunkSize) {
                const chunk = positionUpdates.slice(i, i + chunkSize);
                positionPromises.push(
                    taskQueue.execute(async () => {
                        await RestAPI.patch({
                            url: `/guilds/${newGuildId}/channels`,
                            body: chunk,
                        });
                    })
                );
            }
            await Promise.all(positionPromises);
        }
    } catch (e) {
        handleCloneError("Settings", e, "Channel positions", { neverFatal: true });
    }
}
