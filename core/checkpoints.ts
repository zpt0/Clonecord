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
    completedAt: number | null;
}

const CHECKPOINT_KEY = "Clonecord-clone-checkpoint";
const CHECKPOINT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CHECKPOINT_MIN_AGE_MS = 60 * 1000;

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
        if (!raw) return null;

        if (raw.completedAt != null) {
            await DataStore.delete(CHECKPOINT_KEY).catch(() => {});
            return null;
        }

        if (!raw.runId || !raw.sourceGuildId || !raw.targetGuildId) return null;

        const age = Date.now() - (raw.updatedAt || 0);
        if (age > CHECKPOINT_TTL_MS) {
            await DataStore.delete(CHECKPOINT_KEY).catch(() => {});
            return null;
        }

        if (age < CHECKPOINT_MIN_AGE_MS) return null;

        return raw;
    } catch (e) {
        console.warn("[Clonecord] Failed to load clone checkpoint:", e);
        return null;
    }
}

export async function clearCheckpoint(): Promise<void> {
    try {
        const raw = (await DataStore.get(CHECKPOINT_KEY)) as CloneCheckpoint | null;
        if (raw) {
            await DataStore.set(CHECKPOINT_KEY, { ...raw, completedAt: Date.now() });
        }
        setTimeout(async () => {
            try { await DataStore.delete(CHECKPOINT_KEY); } catch {}
        }, 60000);
    } catch (e) {
        try { await DataStore.delete(CHECKPOINT_KEY); } catch {}
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
