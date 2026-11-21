import { definePluginSettings } from "@api/Settings";
import type { DefinedSettings, SettingsDefinition } from "@utils/types";

import { SettingsArchitectureError } from "../core/errors";
import {
    FOUNDATION_SETTING_DEFINITION,
    readFoundationSettings,
    type FoundationSettingsSnapshot,
} from "./keys";
import { sortSettingsBySection } from "./sections";
import type { FoundationSettingMeta, FoundationSettingsDefinition } from "./types";
import {
    sanitizeSettingValue,
    validateFoundationDefinition,
    validatePluginSettingsDefinition,
} from "./validation";

const definedPlugins = new Set<string>();

export interface DefinedFoundationSettings<
    D extends FoundationSettingsDefinition = FoundationSettingsDefinition,
> {
    readonly pluginName: string;
    readonly definition: D;
    readonly settings: DefinedSettings;
    readonly keys: readonly string[];
    readonly metadata: Readonly<Record<string, FoundationSettingMeta>>;
    snapshot(plain: Readonly<Record<string, unknown>>): Record<string, unknown>;
    foundationSnapshot(plain: Readonly<Record<string, unknown>>): FoundationSettingsSnapshot;
}

function formatIssues(
    pluginName: string,
    issues: readonly { key: string; message: string }[]
): string {
    return `Invalid settings definition for ${pluginName}: ${issues.map((issue) => `${issue.key}: ${issue.message}`).join("; ")}`;
}

/** Test-only helper for isolating module-level one-definition-per-plugin enforcement. */
export function resetFoundationSettingsRegistry(): void {
    definedPlugins.clear();
}

export function defineFoundationSettings<D extends FoundationSettingsDefinition>(
    pluginName: string,
    pluginDefinition: D
): DefinedFoundationSettings<FoundationSettingsDefinition & D> {
    if (!pluginName.trim())
        throw new SettingsArchitectureError("Plugin name must be a non-empty string");
    if (definedPlugins.has(pluginName)) {
        throw new SettingsArchitectureError(
            `A foundation settings definition already exists for ${pluginName}`
        );
    }

    const pluginIssues = validatePluginSettingsDefinition(pluginDefinition);
    if (pluginIssues.length > 0)
        throw new SettingsArchitectureError(formatIssues(pluginName, pluginIssues));

    const merged = {
        ...FOUNDATION_SETTING_DEFINITION,
        ...pluginDefinition,
    } as FoundationSettingsDefinition & D;

    const issues = validateFoundationDefinition(merged);
    if (issues.length > 0) throw new SettingsArchitectureError(formatIssues(pluginName, issues));

    const definition = sortSettingsBySection(merged);
    const settings = definePluginSettings(
        definition as unknown as SettingsDefinition,
        {}
    ) as unknown as DefinedSettings;
    const keys = Object.freeze(Object.keys(definition));
    const metadata = Object.freeze(
        Object.fromEntries(Object.entries(definition).map(([key, def]) => [key, def.foundation]))
    ) as Readonly<Record<string, FoundationSettingMeta>>;

    definedPlugins.add(pluginName);

    return {
        pluginName,
        definition,
        settings,
        keys,
        metadata,
        snapshot(plain) {
            const values: Record<string, unknown> = {};
            for (const [key, def] of Object.entries(definition)) {
                values[key] = sanitizeSettingValue(def, plain[key]);
            }
            return values;
        },
        foundationSnapshot(plain) {
            return readFoundationSettings(plain);
        },
    };
}
