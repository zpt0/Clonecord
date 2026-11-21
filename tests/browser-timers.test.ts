import { afterEach, describe, expect, it, vi } from "vitest";

import {
    cancelManagedInterval,
    cancelManagedTimeout,
    createManagedInterval,
    scheduleManagedTimeout,
    setOwnerScope,
} from "../core/ownership";
import { ResourceScope } from "../foundation/core/lifecycle";

describe("Clonecord browser-style timer handles", () => {
    afterEach(() => {
        setOwnerScope(null);
        vi.restoreAllMocks();
    });

    it("accepts numeric setTimeout IDs and cleans them up on cancel or fire", async () => {
        const scope = new ResourceScope();
        setOwnerScope(scope);

        let nextId = 100;
        let scheduled!: () => void;
        vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => {
            scheduled = callback;
            return nextId++;
        }) as any);
        vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => undefined);

        const callback = vi.fn();
        const timeout = scheduleManagedTimeout(callback, 10, "browser", "browser:timeout");
        expect(timeout).toBe(100);
        expect(scope.has("browser:timeout")).toBe(true);

        cancelManagedTimeout(timeout);
        expect(scope.has("browser:timeout")).toBe(false);

        const secondScope = new ResourceScope();
        setOwnerScope(secondScope);
        const second = scheduleManagedTimeout(callback, 10, "browser", "browser:timeout:2");
        expect(second).toBe(101);
        scheduled();
        expect(callback).toHaveBeenCalledOnce();
        expect(secondScope.has("browser:timeout:2")).toBe(false);

        await Promise.all([scope.disposeAll(), secondScope.disposeAll()]);
    });

    it("falls back to an unowned timeout when registration fails", async () => {
        const scope = new ResourceScope();
        setOwnerScope(scope);
        await scope.disposeAll();

        let nextId = 300;
        let scheduled!: () => void;
        vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => {
            scheduled = callback;
            return nextId++;
        }) as any);

        const callback = vi.fn();
        expect(() => scheduleManagedTimeout(callback, 10, "disposed")).not.toThrow();
        scheduled();
        expect(callback).toHaveBeenCalledOnce();
    });

    it("falls back to an unowned interval when registration fails", () => {
        const scope = new ResourceScope();
        vi.spyOn(scope, "register").mockImplementation(() => {
            throw new Error("scope disposed during registration");
        });
        setOwnerScope(scope);

        let nextId = 400;
        let scheduled!: () => void;
        vi.spyOn(globalThis, "setInterval").mockImplementation(((callback: () => void) => {
            scheduled = callback;
            return nextId++;
        }) as any);
        vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);

        const callback = vi.fn();
        expect(() => createManagedInterval(callback, 10, "disposed")).not.toThrow();
        scheduled();
        expect(callback).toHaveBeenCalledOnce();
    });

    it("accepts numeric setInterval IDs and cleans them up on scope disposal", async () => {
        const scope = new ResourceScope();
        setOwnerScope(scope);

        let nextId = 200;
        vi.spyOn(globalThis, "setInterval").mockImplementation((() => nextId++) as any);
        vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);

        const interval = createManagedInterval(
            () => {},
            10,
            "browser-interval",
            "browser:interval"
        );
        expect(interval).toBe(200);
        expect(scope.has("browser:interval")).toBe(true);

        cancelManagedInterval(interval);
        expect(scope.has("browser:interval")).toBe(false);
        await scope.disposeAll();
        expect(scope.isDisposed).toBe(true);
    });
});
