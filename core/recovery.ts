import { GuildStore } from "@webpack/common";

import { state } from "../store";
import { closePill, notify } from "../utils/notifications";
import { clearCheckpoint, loadCheckpoint } from "./checkpoints";
import { resumeClone } from "./clone";

/** Startup scan for an unfinished clone, extracted without changing its behavior. */
export async function checkForUnfinishedClone(): Promise<void> {
    if (state.isCloning) return;
    try {
        const checkpoint = await loadCheckpoint();
        if (!checkpoint) return;

        const sourceStillExists = !!GuildStore.getGuild(checkpoint.sourceGuildId);
        const targetStillExists = !!GuildStore.getGuild(checkpoint.targetGuildId);
        if (!sourceStillExists || !targetStillExists) {
            await clearCheckpoint();
            return;
        }

        const p = checkpoint.progress;
        const totalCloned =
            p.channelsCloned +
            p.categoriesCloned +
            p.rolesCloned +
            p.emojisCloned +
            p.stickersCloned +
            p.soundboardCloned;

        const opts = checkpoint.options as any;
        const expectedWork =
            (opts.cloneChannels ? 1 : 0) +
            (opts.cloneRoles ? 1 : 0) +
            (opts.cloneOnboarding ? 1 : 0) +
            (opts.cloneStickers ? 1 : 0) +
            (opts.cloneSoundboard ? 1 : 0);

        if (expectedWork === 0) {
            await clearCheckpoint();
            return;
        }

        const ago = Math.round((Date.now() - checkpoint.updatedAt) / 60000);
        const agoText = ago < 1 ? "just now" : ago === 1 ? "1 min ago" : `${ago} min ago`;
        const summary =
            totalCloned > 0
                ? `${checkpoint.sourceGuildName}: ${totalCloned} items cloned (${agoText})`
                : `${checkpoint.sourceGuildName} (${agoText})`;

        notify("Unfinished Clone Found", `${summary}. Resume or discard?`, "info", 0, [
            {
                label: "Resume",
                type: "default",
                onClick: (id) => {
                    closePill(id);
                    resumeClone(checkpoint.runId).catch(() => {});
                },
            },
            {
                label: "Discard",
                type: "danger",
                onClick: (id) => {
                    closePill(id);
                    clearCheckpoint().catch(() => {});
                },
            },
        ]);
    } catch {}
}
