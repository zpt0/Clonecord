import type { SettingsStoreLike } from "@api/Settings";

import type {
    BridgeCapability,
    BridgeHandlerMap,
    BridgeJson,
    BridgeRegistration,
} from "./bridge/contract";
import { BRIDGE_CAPABILITIES, BRIDGE_CONTRACT_VERSION } from "./bridge/contract";
import type { BridgeHost } from "./bridge/host";
import {
    createDiagnosticPersistence,
    createDiagnosticReporter,
    DiagnosticCollector,
    type DiagnosticContextValue,
    type DiagnosticSeverity,
} from "./core/diagnostics";
import { isErr, type Result } from "./core/errors";
import {
    createLifecycleOwner,
    trackBridgeRegistration,
    type DisposalReport,
    type LifecycleOwner,
    type ResourceHandle,
    type ResourceScope,
} from "./core/lifecycle";
import {
    createVencordLogSink,
    FoundationLogger,
    parseLogLevel,
    setSharedLogLevel,
    type LogSink,
} from "./core/logging";
import type { DefinedFoundationSettings } from "./settings/definition";
import { createSettingsMonitor } from "./settings/live";
import type { FoundationSettingsDefinition } from "./settings/types";

export type FoundationBridgeStatus = "unavailable" | "disabled" | "registered" | "failed";

export interface FoundationRuntimeBridgeOptions {
    readonly host: BridgeHost;
    readonly capabilities?: readonly BridgeCapability[];
}

export interface FoundationRuntimeOptions<D extends FoundationSettingsDefinition> {
    readonly pluginName: string;
    readonly definition: DefinedFoundationSettings<D>;
    readonly sink?: LogSink;
    readonly store?: SettingsStoreLike;
    readonly diagnosticsLimit?: number;
    readonly version?: string;
    readonly bridge?: FoundationRuntimeBridgeOptions;
}

export interface FoundationRuntimeStatus {
    readonly lifecycle: string;
    readonly bridge: FoundationBridgeStatus;
    readonly diagnosticsEnabled: boolean;
    readonly logLevel: string;
}

export class FoundationRuntime<D extends FoundationSettingsDefinition> {
    readonly version: string;
    readonly lifecycle: LifecycleOwner;
    readonly logger: FoundationLogger;
    readonly diagnostics: DiagnosticCollector;
    readonly persistence;

    private bridgeHandle?: ResourceHandle<BridgeRegistration>;
    private bridgeStatus: FoundationBridgeStatus = "unavailable";
    private diagnosticsEnabled = false;
    private settingsValues: Readonly<Record<string, unknown>> = Object.freeze({});

    constructor(private readonly options: FoundationRuntimeOptions<D>) {
        this.version = options.version ?? BRIDGE_CONTRACT_VERSION.toString();
        this.lifecycle = createLifecycleOwner(options.pluginName);
        this.logger = new FoundationLogger(
            options.pluginName,
            options.sink ?? createVencordLogSink(),
            "warn"
        );
        this.diagnostics = new DiagnosticCollector(options.pluginName, {
            limit: options.diagnosticsLimit,
        });
        this.persistence = createDiagnosticPersistence(options.pluginName);
    }

    get status(): FoundationRuntimeStatus {
        return {
            lifecycle: this.lifecycle.state,
            bridge: this.bridgeStatus,
            diagnosticsEnabled: this.diagnosticsEnabled,
            logLevel: this.logger.level,
        };
    }

    get values(): Readonly<Record<string, unknown>> {
        return this.settingsValues;
    }

    async start(startup?: (scope: ResourceScope) => void | Promise<void>): Promise<Result<void>> {
        const result = await this.lifecycle.start(async (scope) => {
            const initialPlain = this.options.definition.foundationSnapshot(this.readPlain());
            this.applyFoundationSettings(initialPlain);

            createSettingsMonitor(scope, this.options.definition, {
                store: this.options.store,
                onChange: (change) =>
                    this.applyFoundationSettings(
                        this.options.definition.foundationSnapshot(change.plain)
                    ),
            });

            const reporter = createDiagnosticReporter(
                this.diagnostics,
                this.logger.child("diagnostics"),
                () => this.diagnosticsEnabled
            );
            scope.register("diagnostics:reporter", { dispose: reporter }, (value) =>
                value.dispose()
            );

            this.syncBridgeRegistration();
            await startup?.(scope);
        });

        if (isErr(result)) {
            this.bridgeStatus = "failed";
            this.bridgeHandle = undefined;
        }
        return result;
    }

    async stop(): Promise<DisposalReport> {
        const report = await this.lifecycle.stop();
        this.bridgeHandle = undefined;
        this.bridgeStatus = "unavailable";
        return report;
    }

    applyFoundationSettings(plain: Readonly<Record<string, unknown>>): void {
        const foundation = this.options.definition.foundationSnapshot(plain);
        this.settingsValues = Object.freeze(this.options.definition.snapshot(plain));
        this.diagnosticsEnabled = foundation.foundationDiagnosticsEnabled;
        const logLevel = parseLogLevel(foundation.foundationLogLevel, "warn");
        this.logger.setLevel(logLevel);
        setSharedLogLevel(logLevel);
        this.syncBridgeRegistration(foundation.foundationBridgeEnabled);
    }

    recordDiagnostic(
        severity: DiagnosticSeverity,
        message: string,
        context: Readonly<Record<string, DiagnosticContextValue>> = {}
    ) {
        if (!this.diagnosticsEnabled) return undefined;
        return this.diagnostics.record(severity, message, context);
    }

    diagnosticSummary(): string {
        return this.diagnostics.formatSummary();
    }

    private readPlain(): Record<string, unknown> {
        const store = this.options.store;
        if (!store) return {};
        const plugins = store.plain.plugins;
        if (typeof plugins !== "object" || plugins === null || Array.isArray(plugins)) return {};
        const own = (plugins as Record<string, unknown>)[this.options.pluginName];
        return typeof own === "object" && own !== null && !Array.isArray(own)
            ? (own as Record<string, unknown>)
            : {};
    }

    private syncBridgeRegistration(enabledOverride?: boolean): void {
        const bridge = this.options.bridge;
        const isActive = this.lifecycle.state === "started" || this.lifecycle.state === "starting";
        if (!bridge || !isActive) {
            if (!bridge) this.bridgeStatus = "unavailable";
            return;
        }

        const enabled =
            enabledOverride ??
            this.options.definition.foundationSnapshot(this.readPlain()).foundationBridgeEnabled;
        if (!enabled) {
            if (this.bridgeHandle && !this.bridgeHandle.disposed) void this.bridgeHandle.dispose();
            this.bridgeHandle = undefined;
            this.bridgeStatus = "disabled";
            return;
        }

        if (this.bridgeHandle && !this.bridgeHandle.disposed) {
            this.bridgeStatus = "registered";
            return;
        }

        const result = bridge.host.register({
            pluginName: this.options.pluginName,
            capabilities: bridge.capabilities ?? [...BRIDGE_CAPABILITIES],
            handlers: this.createBridgeHandlers(),
            canRegister: () => true,
        });

        if (!result.ok) {
            this.bridgeStatus = "failed";
            this.logger.warn("Bridge registration was rejected", result.error.code);
            return;
        }

        this.bridgeHandle = trackBridgeRegistration(this.lifecycle.scope, result.value);
        this.bridgeStatus = "registered";
    }

    private createBridgeHandlers(): BridgeHandlerMap {
        return {
            "bridge.info": (request) => ({
                version: BRIDGE_CONTRACT_VERSION,
                plugin: this.options.pluginName,
                bridgeVersion: BRIDGE_CONTRACT_VERSION,
                requestId: request.requestId ?? null,
            }),
            "lifecycle.status": () => {
                const status = this.status;
                return {
                    lifecycle: status.lifecycle,
                    bridge: status.bridge,
                    diagnosticsEnabled: status.diagnosticsEnabled,
                    logLevel: status.logLevel,
                };
            },
            "settings.describe": () => {
                const described: Record<string, BridgeJson> = {};
                for (const [key, meta] of Object.entries(this.options.definition.metadata)) {
                    described[key] = {
                        section: meta.section,
                        order: meta.order ?? null,
                        changeMode: meta.changeMode,
                        readPaths: [...meta.readPaths],
                    };
                }
                return { pluginName: this.options.pluginName, settings: described };
            },
            "diagnostics.summary": () => ({
                pluginName: this.options.pluginName,
                summary: this.diagnosticSummary(),
                entries: this.diagnostics.list().map((entry) => ({
                    id: entry.id,
                    severity: entry.severity,
                    message: entry.message,
                    context: { ...entry.context },
                })),
            }),
        };
    }
}

export function createFoundationRuntime<D extends FoundationSettingsDefinition>(
    options: FoundationRuntimeOptions<D>
): FoundationRuntime<D> {
    return new FoundationRuntime(options);
}

export function bridgeStatusLabel(status: FoundationBridgeStatus): string {
    switch (status) {
        case "registered":
            return "registered";
        case "disabled":
            return "disabled";
        case "failed":
            return "failed";
        case "unavailable":
            return "unavailable";
    }
}
