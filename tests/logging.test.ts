import { describe, expect, it, vi } from "vitest";
import {
    createCollectingLogSink,
    createConsoleLogSink,
    FoundationLogger,
    parseLogLevel,
    resetSharedLogging,
} from "../foundation/core/logging";

describe("parseLogLevel", () => {
    it("accepts known level names", () => {
        expect(parseLogLevel("debug")).toBe("debug");
        expect(parseLogLevel("none")).toBe("none");
    });

    it("rejects inherited object keys", () => {
        expect(parseLogLevel("constructor")).toBe("warn");
        expect(parseLogLevel("__proto__")).toBe("warn");
        expect(parseLogLevel("toString")).toBe("warn");
    });

    it("uses the fallback for non-strings and unknown strings", () => {
        expect(parseLogLevel(undefined)).toBe("warn");
        expect(parseLogLevel("verbose", "error")).toBe("error");
    });
});

describe("FoundationLogger noise control", () => {
    it("folds identical messages and reports them once on flush", () => {
        const now = 1_000;
        const sink = createCollectingLogSink();
        const logger = new FoundationLogger("test", sink, "warn", { now: () => now });

        logger.warn("same message");
        logger.warn("same message");
        logger.warn("same message");

        expect(sink.entries).toHaveLength(1);
        logger.flush();
        expect(sink.entries).toHaveLength(2);
        expect(sink.entries[1]?.suppressed).toBe(2);
        expect(sink.entries[1]?.message).toBe("2 additional messages folded");

        logger.flush();
        expect(sink.entries).toHaveLength(2);
    });

    it("caps a window and summarizes with the highest suppressed severity", () => {
        let now = 0;
        const sink = createCollectingLogSink();
        const logger = new FoundationLogger("test", sink, "info", {
            now: () => now,
            windowMs: 1_000,
            maxPerWindow: 2,
        });

        logger.info("first");
        logger.warn("second");
        logger.error("third");
        logger.info("fourth");

        expect(sink.entries.map((entry) => entry.message)).toEqual(["first", "second"]);

        now += 1_000;
        logger.info("next window");

        expect(sink.entries).toHaveLength(4);
        expect(sink.entries[2]?.level).toBe("error");
        expect(sink.entries[2]?.suppressed).toBe(2);
        expect(sink.entries[3]?.message).toBe("next window");
    });

    it("keeps level filtering and complete silence", () => {
        const sink = createCollectingLogSink();
        const logger = new FoundationLogger("test", sink, "warn");

        logger.debug("hidden debug");
        logger.info("hidden info");
        logger.warn("visible warn");
        expect(sink.entries.map((entry) => entry.message)).toEqual(["visible warn"]);

        logger.setLevel("error");
        logger.warn("hidden after change");
        logger.error("visible error");
        expect(sink.entries).toHaveLength(2);

        logger.setLevel("none");
        logger.error("hidden by none");
        expect(sink.entries).toHaveLength(2);

        logger.setLevel("debug");
        logger.debug("visible debug");
        expect(sink.entries).toHaveLength(3);
    });

    it("shares deduplication and once() across child scopes", () => {
        const sink = createCollectingLogSink();
        const parent = new FoundationLogger("root", sink, "warn");

        parent.child("a").once("migrated state");
        parent.child("b").once("migrated state");
        parent.child("a").warn("repeated");
        parent.child("b").warn("repeated");

        expect(sink.entries).toHaveLength(2);
        expect(sink.entries[0]?.scope).toBe("root:a");
        expect(sink.entries[1]?.message).toBe("repeated");
    });

    it("uses compact level and scope badges", () => {
        const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        createConsoleLogSink().write({
            level: "warn",
            scope: "Questcord/quests",
            message: "Heartbeat failed",
            details: ["timeout"],
            timestamp: 0,
        });

        expect(spy).toHaveBeenCalledTimes(1);
        const args = spy.mock.calls[0] as unknown[];
        expect(args[0]).toBe("%c WARN %c Questcord/quests %cHeartbeat failed");
        expect(String(args[1])).toContain("#e5c890");
        expect(args[4]).toBe("timeout");
    });

    it("resets shared logging state for plugin reloads", () => {
        resetSharedLogging();
        expect(() => resetSharedLogging()).not.toThrow();
    });
});
