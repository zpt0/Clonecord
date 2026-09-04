import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TaskQueue } from "../TaskQueue";

vi.mock("../../store", () => ({
    state: { isCloning: true },
}));

describe("TaskQueue.getStatus", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("reports idle state on a fresh queue", () => {
        const queue = new TaskQueue(5);
        const status = queue.getStatus();

        expect(status.throttled).toBe(false);
        expect(status.throttledSecondsLeft).toBe(0);
        expect(status.consecutive429).toBe(0);
        expect(status.currentConcurrency).toBe(5);
        expect(status.maxConcurrency).toBe(5);
        expect(status.avgRequestMs).toBe(0);
        expect(status.completedRequests).toBe(0);
    });

    it("tracks completed requests and average duration", async () => {
        const queue = new TaskQueue(5);

        const p1 = queue.execute(async () => {
            await new Promise((r) => setTimeout(r, 100));
            return "a";
        });
        const p2 = queue.execute(async () => {
            await new Promise((r) => setTimeout(r, 300));
            return "b";
        });
        const all = Promise.all([p1, p2]);
        await vi.advanceTimersByTimeAsync(500);
        await all;

        const status = queue.getStatus();
        expect(status.completedRequests).toBe(2);
        expect(status.avgRequestMs).toBe(200);
    });

    it("reports throttled state after a 429", async () => {
        const queue = new TaskQueue(5);
        let calls = 0;

        const p = queue.execute(
            async () => {
                calls++;
                if (calls === 1) {
                    const err: any = new Error("rate limited");
                    err.status = 429;
                    err.retry_after = 10;
                    throw err;
                }
                return "ok";
            },
            undefined,
            undefined,
            2
        );
        const done = p.then(
            () => "resolved",
            () => "rejected"
        );
        await vi.advanceTimersByTimeAsync(12000);
        expect(await done).toBe("resolved");

        const status = queue.getStatus();
        expect(status.consecutive429).toBe(0);
        expect(status.currentConcurrency).toBeLessThan(5);
        expect(status.completedRequests).toBe(1);
    });
});
