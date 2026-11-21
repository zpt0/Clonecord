declare module "@utils/types" {
    import type { ComponentType, ReactNode } from "react";

    export type ReplaceFn = (match: string, ...groups: string[]) => string;

    export interface PatchReplacement {
        match: string | RegExp;
        replace: string | ReplaceFn;
        noWarn?: boolean;
        predicate?(): boolean;
        fromBuild?: number;
        toBuild?: number;
    }

    export interface Patch {
        plugin: string;
        find: string | RegExp;
        replacement: PatchReplacement | PatchReplacement[];
        all?: boolean;
        noWarn?: boolean;
        group?: boolean;
        predicate?(): boolean;
        fromBuild?: number;
        toBuild?: number;
    }

    export type PluginPatch = Omit<Patch, "plugin">;

    export const enum StartAt {
        Init = "Init",
        DOMContentLoaded = "DOMContentLoaded",
        WebpackReady = "WebpackReady",
    }

    export const enum ReporterTestable {
        None = 1 << 1,
        Start = 1 << 2,
        Patches = 1 << 3,
        FluxEvents = 1 << 4,
    }

    /** Mirrors upstream Vencord numeric values. */
    export enum OptionType {
        STRING = 0,
        NUMBER = 1,
        BIGINT = 2,
        BOOLEAN = 3,
        SELECT = 4,
        SLIDER = 5,
        COMPONENT = 6,
        CUSTOM = 7,
    }

    export interface PluginSettingDefCommon {
        description: string;
        displayName?: string;
        placeholder?: string;
        onChange?(newValue: unknown): void;
        restartNeeded?: boolean;
        componentProps?: Record<string, unknown>;
        target?: "WEB" | "DESKTOP" | "BOTH";
        disabled?: boolean | ((this: DefinedSettings) => boolean);
        hidden?: boolean | ((this: DefinedSettings) => boolean);
        isValid?(this: DefinedSettings, value: unknown): boolean | string;
    }

    export interface PluginSettingStringDef extends PluginSettingDefCommon {
        type: OptionType.STRING;
        default?: string;
        multiline?: boolean;
    }

    export interface PluginSettingNumberDef extends PluginSettingDefCommon {
        type: OptionType.NUMBER;
        default?: number;
        min?: number;
        max?: number;
    }

    export interface PluginSettingBigIntDef extends PluginSettingDefCommon {
        type: OptionType.BIGINT;
        default?: bigint;
        min?: bigint;
        max?: bigint;
    }

    export interface PluginSettingBooleanDef extends PluginSettingDefCommon {
        type: OptionType.BOOLEAN;
        default?: boolean;
    }

    export interface PluginSettingSelectOption {
        label: string;
        value: string | number | boolean;
        default?: boolean;
    }

    export interface PluginSettingSelectDef extends PluginSettingDefCommon {
        type: OptionType.SELECT;
        options: readonly PluginSettingSelectOption[];
    }

    export interface PluginSettingSliderDef extends PluginSettingDefCommon {
        type: OptionType.SLIDER;
        markers: number[];
        default: number;
        stickToMarkers?: boolean;
    }

    export interface PluginSettingComponentProps {
        setValue(newValue: unknown): void;
        option: PluginSettingComponentDef;
        closePluginSettings(): void;
    }

    export interface PluginSettingComponentDef extends Omit<
        PluginSettingDefCommon,
        "description" | "placeholder" | "displayName"
    > {
        type: OptionType.COMPONENT;
        /** Existing Clonecord component rows preserve an empty string. */
        description?: string;
        component: (props: PluginSettingComponentProps) => ReactNode | Promise<ReactNode>;
        default?: unknown;
    }

    export interface PluginSettingCustomDef extends PluginSettingDefCommon {
        type: OptionType.CUSTOM;
        default?: unknown;
        onChange?: (newValue: unknown) => void;
    }

    export type PluginSettingDef =
        | PluginSettingStringDef
        | PluginSettingNumberDef
        | PluginSettingBigIntDef
        | PluginSettingBooleanDef
        | PluginSettingSelectDef
        | PluginSettingSliderDef
        | PluginSettingComponentDef
        | PluginSettingCustomDef;

    export type SettingsDefinition = Record<string, PluginSettingDef>;

    export interface DefinedSettings<
        Def extends SettingsDefinition = SettingsDefinition,
        Private extends object = object,
    > {
        def: Def;
        store: Record<string, any> & Private;
        plain: Record<string, any> & Private;
        use<F extends Extract<keyof Def | keyof Private, string>>(
            filter?: F[]
        ): Pick<Record<string, any> & Private, F>;
        pluginName: string;
        withPrivateSettings<T extends object>(): DefinedSettings<Def, T>;
    }

    export interface PluginAuthor {
        name: string;
        id?: string | bigint;
    }

    export interface PluginDefinition {
        name: string;
        description: string;
        authors: PluginAuthor[];
        settings?: DefinedSettings | any;
        patches?: any[];
        contextMenus?: Record<string, any>;
        flux?: Record<string, any>;
        managedStyle?: string;
        settingsAboutComponent?: ComponentType<any>;
        tags?: string[];
        required?: boolean;
        start?(): void | Promise<void>;
        stop?(): void | Promise<void>;
        [key: string]: any;
    }

    export type Plugin = PluginDefinition;

    export default function definePlugin(plugin: PluginDefinition): PluginDefinition;
}
