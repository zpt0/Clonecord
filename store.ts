import { CloneOptions, CloneStats, CloneFailure } from "./types";
import type { TaskQueue } from "./utils/TaskQueue";

export const state = {
    isCloning: false,
    abortController: null as AbortController | null,
    pillContainer: null as HTMLElement | null,
    mainProgressNotificationId: null as string | null,
    currentCloneGuildId: null as string | null,
    skipRolesCallback: null as (() => void) | null,
    taskQueue: null as TaskQueue | null,
    emojiIdMap: {} as Record<string, string>,
    cloneStartTime: null as number | null,
    timerInterval: null as ReturnType<typeof setInterval> | null,
    cloneErrors: [] as string[],
    cloneStats: null as CloneStats | null,
    failedItems: [] as CloneFailure[],
    sourceGuildName: "" as string,
    sourceGuildId: "" as string,
    isExistingServer: false as boolean,
    optionsUsed: null as CloneOptions | null,
    settings: null as any,
    lastCloneTargetGuildId: null as string | null,
    lastCloneRoleIdMap: {} as Record<string, string>,
    lastCloneChannelIdMap: {} as Record<string, string>,
    lastCloneEmojiIdMap: {} as Record<string, string>,
    lastCloneSourceGuildId: null as string | null,
    hiddenChannelsSkipped: 0,
};

/** Clears transient clone state owned by the plugin lifecycle. */
export function resetPluginState(): void {
    state.isCloning = false;
    state.abortController = null;
    state.pillContainer = null;
    state.mainProgressNotificationId = null;
    state.currentCloneGuildId = null;
    state.skipRolesCallback = null;
    state.taskQueue = null;
    state.cloneStartTime = null;
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
}

export function throwIfCancelled() {
    if (!state.isCloning || state.abortController?.signal.aborted) {
        throw new Error("Cancelled");
    }
}
