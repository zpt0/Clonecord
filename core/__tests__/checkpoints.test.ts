import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    newRunId,
    saveCheckpoint,
    loadCheckpoint,
    clearCheckpoint,
    emptyProgress,
    CloneCheckpoint,
} from "../checkpoints";

const store = new Map<string, unknown>();

vi.mock("@api/index", () => ({
    DataStore: {
        get: (key: string) => Promise.resolve(store.get(key) ?? null),
        set: (key: string, value: unknown) => {
            store.set(key, value);
            return Promise.resolve();
        },
        delete: (key: string) => {
            store.delete(key);
            return Promise.resolve();
        },
    },
}));

function makeCheckpoint(overrides: Partial<CloneCheckpoint> = {}): CloneCheckpoint {
    return {
        runId: newRunId("source-1"),
        sourceGuildId: "source-1",
        sourceGuildName: "Source",
        targetGuildId: "target-1",
        options: { cloneChannels: true },
        roleIdMap: { r1: "nr1" },
        channelIdMap: { c1: "nc1" },
        emojiIdMap: {},
        progress: { ...emptyProgress(), channelsCloned: 5 },
        updatedAt: Date.now(),
        completed: false,
        ...overrides,
    };
}

describe("checkpoints", () => {
    beforeEach(() => {
        store.clear();
    });

    it("round-trips a checkpoint", async () => {
        const cp = makeCheckpoint();
        await saveCheckpoint(cp);
        const loaded = await loadCheckpoint();
        expect(loaded).not.toBeNull();
        expect(loaded!.runId).toBe(cp.runId);
        expect(loaded!.channelIdMap).toEqual({ c1: "nc1" });
        expect(loaded!.progress.channelsCloned).toBe(5);
    });

    it("returns null when nothing saved", async () => {
        expect(await loadCheckpoint()).toBeNull();
    });

    it("returns null for completed checkpoints", async () => {
        await saveCheckpoint(makeCheckpoint({ completed: true }));
        expect(await loadCheckpoint()).toBeNull();
    });

    it("expires checkpoints older than 7 days", async () => {
        const old = makeCheckpoint({ updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 });
        await saveCheckpoint(old);
        expect(await loadCheckpoint()).toBeNull();
    });

    it("clears checkpoints", async () => {
        await saveCheckpoint(makeCheckpoint());
        await clearCheckpoint();
        expect(await loadCheckpoint()).toBeNull();
    });

    it("generates unique run ids per source", () => {
        expect(newRunId("a")).not.toBe(newRunId("a"));
        expect(newRunId("a")).toContain("a");
    });
});
