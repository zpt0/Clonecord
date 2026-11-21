import { OptionType } from "@utils/types";

import { parseLogLevel, type LogLevelName } from "../core/logging";
import type { FoundationSettingsDefinition } from "./types";

export const FoundationSettingKey = {
    BridgeEnabled: "foundationBridgeEnabled",
    DiagnosticsEnabled: "foundationDiagnosticsEnabled",
    LogLevel: "foundationLogLevel",
} as const;

export type FoundationSettingKeyName =
    (typeof FoundationSettingKey)[keyof typeof FoundationSettingKey];

export const FOUNDATION_SETTING_KEYS: readonly FoundationSettingKeyName[] =
    Object.values(FoundationSettingKey);

export const FOUNDATION_SETTING_DEFINITION: FoundationSettingsDefinition = {
    [FoundationSettingKey.BridgeEnabled]: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Allow this plugin to register with the optional plugin bridge.",
        foundation: {
            section: "General",
            changeMode: "live",
            readPaths: ["foundation/index.ts", "foundation/bridge/host.ts"],
            docs: "Bridge registration is rejected while this setting is disabled. Plugins still work without it.",
        },
    },
    [FoundationSettingKey.DiagnosticsEnabled]: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Record and log foundation diagnostic events.",
        foundation: {
            section: "Diagnostics",
            changeMode: "live",
            readPaths: ["foundation/index.ts", "foundation/core/diagnostics.ts"],
        },
    },
    [FoundationSettingKey.LogLevel]: {
        type: OptionType.SELECT,
        options: [
            { label: "Debug", value: "debug" },
            { label: "Info", value: "info" },
            { label: "Warn", value: "warn", default: true },
            { label: "Error", value: "error" },
            { label: "None", value: "none" },
        ],
        description: "Minimum severity written to the Vencord log.",
        foundation: {
            section: "Diagnostics",
            changeMode: "live",
            readPaths: ["foundation/index.ts", "foundation/core/logging.ts"],
        },
    },
};

export interface FoundationSettingsSnapshot {
    readonly foundationBridgeEnabled: boolean;
    readonly foundationDiagnosticsEnabled: boolean;
    readonly foundationLogLevel: LogLevelName;
    [key: string]: unknown;
}

export function readFoundationSettings(
    plain: Readonly<Record<string, unknown>>
): FoundationSettingsSnapshot {
    return {
        foundationBridgeEnabled: plain[FoundationSettingKey.BridgeEnabled] === true,
        foundationDiagnosticsEnabled: plain[FoundationSettingKey.DiagnosticsEnabled] === true,
        foundationLogLevel: parseLogLevel(plain[FoundationSettingKey.LogLevel], "warn"),
    };
}
