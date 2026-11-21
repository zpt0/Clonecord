import { SettingsStore } from "@api/Settings";

import {
    createBridgeHost,
    createFoundationRuntime,
    type BridgeHost,
    type FoundationRuntime,
} from "./foundation";
import { PLUGIN_VERSION } from "./constants";
import { setOwnerScope, scheduleManagedTimeout } from "./core/ownership";
import { checkForUnfinishedClone } from "./core/recovery";
import { registerDevTools, unregisterDevTools } from "./devTools";
import { definition, settings } from "./settings";
import { resetPluginState, state } from "./store";
import { disposeNotificationRuntime } from "./utils/notifications";
import { createScopedLogger } from "./foundation/core/logging";

const log = createScopedLogger("pluginRuntime");

/** Declarative, read-only bridge surface. No clone, token, or account capability. */
const BRIDGE_CAPABILITIES = Object.freeze([
    "lifecycle.status",
    "settings.describe",
    "diagnostics.summary",
] as const);

type ClonecordRuntime = FoundationRuntime<typeof definition.definition>;

let activeRuntime: ClonecordRuntime | null = null;
let activeBridgeHost: BridgeHost | null = null;
let startPromise: Promise<void> | null = null;
let stopPromise: Promise<void> | null = null;

export function getActiveRuntime(): ClonecordRuntime | null {
    return activeRuntime;
}

export function getBridgeHost(): BridgeHost | null {
    return activeBridgeHost;
}

async function createAndStartRuntime(): Promise<void> {
    if (activeRuntime) return;

    const bridgeHost = createBridgeHost({ ownerName: "Clonecord" });
    const runtime = createFoundationRuntime({
        pluginName: "Clonecord",
        definition,
        store: SettingsStore,
        version: PLUGIN_VERSION,
        bridge: {
            host: bridgeHost,
            capabilities: [...BRIDGE_CAPABILITIES],
        },
    });

    activeRuntime = runtime;
    activeBridgeHost = bridgeHost;

    const result = await runtime.start((scope) => {
        setOwnerScope(scope);

        state.settings = settings;

        // Devtools remains the same public API, but ownership of unregistering
        // it now belongs to the foundation scope.
        scope.register(
            "devtools:global",
            undefined,
            () => {
                unregisterDevTools();
            },
            { tags: ["global"] }
        );
        registerDevTools();

        scheduleManagedTimeout(
            () => {
                void checkForUnfinishedClone();
            },
            8000,
            "startup-recovery",
            "startup:recovery"
        );

        runtime.recordDiagnostic("info", "Clonecord runtime started", {
            plugin: "Clonecord",
            version: PLUGIN_VERSION,
        });
    });

    if (!result.ok) {
        setOwnerScope(null);
        activeRuntime = null;
        activeBridgeHost = null;
        log.warn("Foundation runtime failed to start:", result.error);
    }
}

/** Creates a fresh runtime on every start; the foundation lifecycle cannot restart. */
export async function startRuntime(): Promise<void> {
    if (stopPromise) await stopPromise;
    if (activeRuntime) return;
    if (startPromise) return startPromise;

    startPromise = createAndStartRuntime().finally(() => {
        startPromise = null;
    });
    return startPromise;
}

async function disposeRuntime(): Promise<void> {
    const pendingStart = startPromise;
    if (pendingStart) await pendingStart;
    const runtime = activeRuntime;

    // Stop new domain resources from being attached while disposal is running.
    setOwnerScope(null);

    if (runtime) {
        const report = await runtime.stop();
        if (!report.ok) {
            log.warn("Foundation runtime stopped with disposal errors:", report.errors);
        }
    }

    disposeNotificationRuntime();
    resetPluginState();

    activeRuntime = null;
    activeBridgeHost = null;
}

export function stopRuntime(): Promise<void> {
    if (stopPromise) return stopPromise;

    stopPromise = disposeRuntime().finally(() => {
        stopPromise = null;
    });
    return stopPromise;
}
