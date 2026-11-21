import { OptionType, type DefinedSettings } from "@utils/types";

import type {
    SelectOptionLike,
    SettingControlKind,
    SettingDefinitionLike,
    SettingFieldDefinition,
    SettingsCategoryDefinition,
    UnifiedSettingsConfig,
} from "./types";
import { SETTINGS_CATEGORY_ORDER } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export function getSettingOptions(
    def: SettingDefinitionLike | undefined
): readonly SelectOptionLike[] {
    if (!Array.isArray(def?.options)) return [];
    return def.options.filter((option): option is SelectOptionLike => {
        if (!isRecord(option)) return false;
        return "value" in option && "label" in option;
    });
}

export function getSettingMarkers(def: SettingDefinitionLike | undefined): number[] {
    if (!Array.isArray(def?.markers)) return [];
    return def.markers.filter((marker): marker is number => typeof marker === "number");
}

export function getNumericBound(value: unknown): number | undefined {
    return typeof value === "number" ? value : undefined;
}

export function isRestartRequired(def: SettingDefinitionLike | undefined): boolean {
    return def?.foundation?.changeMode === "restart" || def?.restartNeeded === true;
}

export function getValidationError(
    def: SettingDefinitionLike | undefined,
    value: number
): string | null {
    if (!def || typeof def.isValid !== "function") return null;
    const validate = def.isValid as (
        this: SettingDefinitionLike,
        input: number
    ) => boolean | string | undefined;
    const result = validate.call(def, value);
    if (result === true || result === undefined) return null;
    return typeof result === "string" ? result : "Invalid value";
}

export function getSettingDefault(
    definition: Readonly<Record<string, SettingDefinitionLike>>,
    key: string
): unknown {
    const def = definition[key];
    if (def === undefined) return undefined;
    if ("default" in def) return def.default;
    if (def.type === OptionType.SELECT) {
        return getSettingOptions(def).find((option) => option.default)?.value;
    }
    return undefined;
}

export function getSettingDefaults(
    definition: Readonly<Record<string, SettingDefinitionLike>>
): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    for (const key of Object.keys(definition)) {
        const value = getSettingDefault(definition, key);
        if (value !== undefined) defaults[key] = value;
    }
    return defaults;
}

export function readSetting(settings: DefinedSettings, key: string): unknown {
    const store = settings.store as Record<string, unknown>;
    return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : undefined;
}

export function writeSetting(settings: DefinedSettings, key: string, value: unknown): void {
    (settings.store as Record<string, unknown>)[key] = value;
}

export function resetSettingKeys(
    settings: DefinedSettings,
    definition: Readonly<Record<string, SettingDefinitionLike>>,
    keys: readonly string[]
): void {
    const store = settings.store as Record<string, unknown>;
    for (const key of keys) {
        const value = getSettingDefault(definition, key);
        if (value === undefined) delete store[key];
        else store[key] = value;
    }
}

export function inferControl(
    def: SettingDefinitionLike | undefined,
    key: string
): SettingControlKind {
    switch (def?.type) {
        case OptionType.BOOLEAN:
            return "toggle";
        case OptionType.SELECT:
            return "select";
        case OptionType.SLIDER:
            return "slider";
        case OptionType.NUMBER:
        case OptionType.BIGINT:
            return "number";
        case OptionType.STRING:
            return /color/i.test(key) ? "color" : "text";
        case OptionType.COMPONENT:
        case OptionType.CUSTOM:
            return "custom";
        default:
            return "text";
    }
}

export function categoryFields(
    category: SettingsCategoryDefinition
): readonly SettingFieldDefinition[] {
    return category.groups.flatMap((group) => group.fields ?? []);
}

export function categorySettingCount(category: SettingsCategoryDefinition): number {
    return (
        categoryFields(category).length +
        category.groups.reduce((sum, group) => sum + (group.actions?.length ?? 0), 0)
    );
}

export function validateUnifiedSettingsConfig(config: UnifiedSettingsConfig): string[] {
    const issues: string[] = [];
    const categoryIds = config.categories.map((category) => category.id);
    const expectedIds = SETTINGS_CATEGORY_ORDER.filter((id) => categoryIds.includes(id));

    if (JSON.stringify(categoryIds) !== JSON.stringify(expectedIds)) {
        issues.push(`Categories must follow the shared order: ${expectedIds.join(", ")}`);
    }
    if (new Set(categoryIds).size !== categoryIds.length) issues.push("Duplicate category id");

    const groupIds = new Set<string>();
    const covered = new Map<string, string>();

    for (const category of config.categories) {
        if (category.groups.length === 0) issues.push(`Category ${category.id} is empty`);
        for (const group of category.groups) {
            if (groupIds.has(group.id)) issues.push(`Duplicate group id: ${group.id}`);
            groupIds.add(group.id);
            const hasContent =
                (group.fields?.length ?? 0) > 0 ||
                (group.actions?.length ?? 0) > 0 ||
                group.render !== undefined;
            if (!hasContent) issues.push(`Group ${group.id} is empty`);

            for (const field of group.fields ?? []) {
                if (covered.has(field.key)) issues.push(`Setting shown twice: ${field.key}`);
                covered.set(field.key, category.id);
                if (!field.label.trim() || !field.description.trim()) {
                    issues.push(`Setting ${field.key} needs a label and description`);
                }
                if (field.control === "custom" && field.render === undefined) {
                    issues.push(`Custom setting ${field.key} has no renderer`);
                }
            }
            for (const action of group.actions ?? []) {
                if (!action.label.trim() || !action.description.trim()) {
                    issues.push(`Action ${action.id} needs a label and description`);
                }
            }
        }
    }

    const componentKeys = new Set(config.componentKeys ?? []);
    for (const [key, def] of Object.entries(config.definition)) {
        const isComponent = def?.type === OptionType.COMPONENT || def?.type === OptionType.CUSTOM;
        if (isComponent && componentKeys.has(key)) continue;
        if (!covered.has(key)) issues.push(`Setting ${key} is missing from the custom settings UI`);
    }

    for (const key of componentKeys) {
        if (covered.has(key)) issues.push(`Component setting ${key} must not use a store control`);
    }

    return issues;
}
