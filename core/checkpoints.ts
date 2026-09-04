import { DataStore } from "@api/index";

export interface CloneCheckpoint {
    runId: string;
    sourceGuildId: string;
    sourceGuildName: string;
    targetGuildId: string;
    options: Record<string, unknown>;
    roleIdMap: Record<string, string>;
    channelIdMap: Record<string, string>;
    emojiIdMap: Record<string, string>;
    progress: {
        channelsCloned: number;
        categoriesCloned: number;
        rolesCloned: number;
        emojisCloned: number;
        stickersCloned: number;
        soundboardCloned: number;
    };
    updatedAt: number;
    completed: boolean;
}

const CHECKPOINT_KEY = "Clonecord-clone-checkpoint";
const CHECKPOINT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function newRunId(sourceGuildId: string): string {
    const rand = Math.random().toString(36).substring(2, 8);
    return `${sourceGuildId}-${Date.now()}-${rand}`;
}

export async function saveCheckpoint(checkpoint: CloneCheckpoint): Promise<void> {
    try {
        await DataStore.set(CHECKPOINT_KEY, {
            ...checkpoint,
            updatedAt: checkpoint.updatedAt || Date.now(),
        });
    } catch (e) {
        console.warn("[Clonecord] Failed to save clone checkpoint:", e);
    }
}

export async function loadCheckpoint(): Promise<CloneCheckpoint | null> {
    try {
        const raw = (await DataStore.get(CHECKPOINT_KEY)) as CloneCheckpoint | null;
        if (!raw || raw.completed) return null;
        if (!raw.runId || !raw.sourceGuildId || !raw.targetGuildId) return null;
        if (Date.now() - (raw.updatedAt || 0) > CHECKPOINT_TTL_MS) {
            await clearCheckpoint();
            return null;
        }
        return raw;
    } catch (e) {
        console.warn("[Clonecord] Failed to load clone checkpoint:", e);
        return null;
    }
}

export async function clearCheckpoint(): Promise<void> {
    try {
        await DataStore.delete(CHECKPOINT_KEY);
    } catch (e) {
        console.warn("[Clonecord] Failed to clear clone checkpoint:", e);
    }
}

export function emptyProgress(): CloneCheckpoint["progress"] {
    return {
        channelsCloned: 0,
        categoriesCloned: 0,
        rolesCloned: 0,
        emojisCloned: 0,
        stickersCloned: 0,
        soundboardCloned: 0,
    };
}
