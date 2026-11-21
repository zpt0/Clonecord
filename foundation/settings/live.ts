import { SettingsStore, type SettingsStoreLike } from "@api/Settings";

import type { ResourceHandle, ResourceOptions, ResourceScope } from "../core/lifecycle";
import type { DefinedFoundationSettings } from "./definition";
import type { FoundationSettingsDefinition } from "./types";

export interface FoundationSettingsChange {
    readonly pluginName: string;
    readonly path: string;
    readonly plain: Readonly<Record<string, unknown>>;
    readonly values: Readonly<Record<string, unknown>>;
}

export interface SettingsMonitorOptions {
    readonly store?: SettingsStoreLike;
    onChange?(change: FoundationSettingsChange): void;
    readonly resourceOptions?: ResourceOptions;
}

export interface SettingsMonitor {
    readonly path: string;
    readonly handle: ResourceHandle<SettingsStoreLike>;
    getPlain(): Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPluginPlain(store: SettingsStoreLike, pluginName: string): Record<string, unknown> {
    const plugins = store.plain.plugins;
    if (!isRecord(plugins)) return {};
    const own = plugins[pluginName];
    return isRecord(own) ? own : {};
}

/**
 * Registers one Vencord prefix listener in the supplied lifecycle scope.
 * The listener is removed automatically when the scope is disposed.
 */
export function createSettingsMonitor<D extends FoundationSettingsDefinition>(
    scope: ResourceScope,
    definition: DefinedFoundationSettings<D>,
    options: SettingsMonitorOptions = {}
): SettingsMonitor {
    const store = options.store ?? SettingsStore;
    const path = `plugins.${definition.pluginName}`;
    const getPlain = () => readPluginPlain(store, definition.pluginName);

    const listener = (_data: unknown, changedPath: string) => {
        if (changedPath && changedPath !== path && !changedPath.startsWith(`${path}.`)) return;
        const plain = getPlain();
        options.onChange?.({
            pluginName: definition.pluginName,
            path: changedPath || path,
            plain,
            values: definition.snapshot(plain),
        });
    };

    store.addPrefixChangeListener(path, listener);
    const handle = scope.register(
        `settings:${definition.pluginName}`,
        store,
        () => store.removePrefixChangeListener(path, listener),
        options.resourceOptions
    );

    return { path, handle, getPlain };
}
