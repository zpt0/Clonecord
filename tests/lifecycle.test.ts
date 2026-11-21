import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    createManagedAbortController,
    getOwnerScope,
    releaseManagedAbortController,
} from "../core/ownership";
import { getActiveRuntime, getBridgeHost, startRuntime, stopRuntime } from "../pluginRuntime";
import { state } from "../store";
import { __settingsStore, setPluginSettings } from "./helpers/vencord-mocks";

describe("Clonecord foundation lifecycle", () => {
    beforeEach(() => {
        (globalThis as any).window = {};
        __settingsStore.reset();
        setPluginSettings("Clonecord", {
            foundationBridgeEnabled: true,
            foundationDiagnosticsEnabled: false,
            foundationLogLevel: "warn",
        });
    });

    afterEach(async () => {
        await stopRuntime();
    });

    it("owns startup resources, the devtools global, and the bridge registration", async () => {
        await startRuntime();

        const runtime = getActiveRuntime();
        const host = getBridgeHost();
        expect(runtime?.status.lifecycle).toBe("started");
        expect(runtime?.status.bridge).toBe("registered");
        expect(getOwnerScope()?.has("startup:recovery")).toBe(true);
        expect((globalThis as any).window.ClonecordDev).toBeDefined();
        expect(host?.listRegistrations()).toHaveLength(1);
        expect(host?.listRegistrations()[0].capabilities).toEqual([
            "lifecycle.status",
            "settings.describe",
            "diagnostics.summary",
        ]);

        const response = await host!.handleRequest({
            version: 1,
            capability: "settings.describe",
            action: "schema",
        });
        expect(response.ok).toBe(true);
        expect(JSON.stringify(response)).not.toMatch(/authorization|gettoken|"token"/i);

        await stopRuntime();

        expect(getActiveRuntime()).toBeNull();
        expect(getOwnerScope()).toBeNull();
        expect(getBridgeHost()).toBeNull();
        expect((globalThis as any).window.ClonecordDev).toBeUndefined();
        expect(host?.listRegistrations()).toHaveLength(0);
        expect(state.isCloning).toBe(false);
        expect(state.abortController).toBeNull();
    });

    it("creates a fresh runtime on every start after stop", async () => {
        await startRuntime();
        const first = getActiveRuntime();
        await stopRuntime();

        await startRuntime();
        const second = getActiveRuntime();
        expect(second).not.toBeNull();
        expect(second).not.toBe(first);
        expect(second?.status.lifecycle).toBe("started");
    });

    it("aborts owned controllers on shutdown but not on explicit release", async () => {
        await startRuntime();

        const owned = createManagedAbortController("test-owned");
        const released = createManagedAbortController("test-released");
        releaseManagedAbortController(released);

        expect(owned.signal.aborted).toBe(false);
        expect(released.signal.aborted).toBe(false);

        await stopRuntime();

        expect(owned.signal.aborted).toBe(true);
        expect(released.signal.aborted).toBe(false);
    });
});
