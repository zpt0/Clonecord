import { CloneOptions, CloneStats, CloneFailure } from "./types";

export const state = {
    isCloning: false,
    abortController: null as AbortController | null,
    pillContainer: null as HTMLElement | null,
    mainProgressNotificationId: null as string | null,
    currentCloneGuildId: null as string | null,
    skipRolesCallback: null as (() => void) | null,
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
};

export function throwIfCancelled() {
    if (!state.isCloning || state.abortController?.signal.aborted) {
        throw new Error("Cancelled");
    }
}
