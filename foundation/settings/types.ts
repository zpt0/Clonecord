import type { PluginSettingDef } from "@utils/types";

export const SETTING_SECTIONS = [
    "General",
    "Behavior",
    "Notifications",
    "Appearance",
    "Diagnostics",
    "About",
] as const;

export type SettingSection = (typeof SETTING_SECTIONS)[number];

export type SettingChangeMode = "live" | "restart";

export interface FoundationSettingMeta {
    readonly section: SettingSection;
    readonly order?: number;
    /** Must match Vencord's `restartNeeded` flag. */
    readonly changeMode: SettingChangeMode;
    /** Source locations that read this setting. Required to prevent dead settings. */
    readonly readPaths: readonly string[];
    readonly docs?: string;
}

export type FoundationSettingDef = PluginSettingDef & {
    readonly foundation: FoundationSettingMeta;
};

export type FoundationSettingsDefinition = Record<string, FoundationSettingDef>;

export interface SettingsIssue {
    readonly key: string;
    readonly message: string;
}
