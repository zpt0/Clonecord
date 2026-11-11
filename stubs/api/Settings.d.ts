declare module "@api/Settings" {
    enum OptionType {
        STRING = 0,
        NUMBER = 1,
        BOOLEAN = 2,
        SELECT = 3,
        MULTI_SELECT = 4,
        SLIDER = 5,
        COLOR = 6,
        COMPONENT = 7,
    }

    interface SettingDefinitionBase {
        type: OptionType;
        description: string;
        restartNeeded?: boolean;
        /** Hide from Vencord's standard options list (rendered by custom UI). */
        hidden?: boolean;
    }

    interface StringOption extends SettingDefinitionBase {
        type: OptionType.STRING;
        default?: string;
        validators?: Array<(value: string) => boolean | string>;
    }

    interface NumberOption extends SettingDefinitionBase {
        type: OptionType.NUMBER;
        default?: number;
        markers?: number[];
        stickToMarkers?: boolean;
    }

    interface BooleanOption extends SettingDefinitionBase {
        type: OptionType.BOOLEAN;
        default?: boolean;
    }

    interface SelectOption extends SettingDefinitionBase {
        type: OptionType.SELECT;
        options: { label: string; value: any; default?: boolean }[];
    }

    interface MultiSelectOption extends SettingDefinitionBase {
        type: OptionType.MULTI_SELECT;
        options: { label: string; value: any; default?: boolean }[];
    }

    interface SliderOption extends SettingDefinitionBase {
        type: OptionType.SLIDER;
        default?: number;
        markers: number[];
        stickToMarkers?: boolean;
    }

    interface ColorOption extends SettingDefinitionBase {
        type: OptionType.COLOR;
        default?: string;
    }

    interface ComponentOption extends SettingDefinitionBase {
        type: OptionType.COMPONENT;
        component: React.ComponentType<any>;
    }

    type SettingDefinition =
        | StringOption
        | NumberOption
        | BooleanOption
        | SelectOption
        | MultiSelectOption
        | SliderOption
        | ColorOption
        | ComponentOption;

    type SettingsMap = Record<string, SettingDefinition>;

    interface SettingsOption {
        value: any;
    }

    interface Settings {
        store: Record<string, any>;
        /** Option definitions, keyed by setting name. */
        def: Record<string, any>;
        /**
         * React hook: subscribes the calling component to the given keys.
         * Returns the current values, keyed by setting name.
         */
        use(keys: string[]): Record<string, any>;
        [key: string]: SettingsOption | (() => any) | any;
        get<T>(key: string): T;
        set(key: string, value: any): void;
    }

    export function definePluginSettings(settings: Record<string, any>): Settings;
    export { OptionType, SettingDefinition, SettingsMap, Settings };
}
