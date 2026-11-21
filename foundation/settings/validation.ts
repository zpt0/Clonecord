import { OptionType, type DefinedSettings } from "@utils/types";

import { isSettingSection } from "./sections";
import { FOUNDATION_SETTING_KEYS } from "./keys";
import type { FoundationSettingDef, FoundationSettingsDefinition, SettingsIssue } from "./types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function unique<T>(values: readonly T[], equals: (a: T, b: T) => boolean = Object.is): boolean {
    for (let index = 0; index < values.length; index++) {
        const first = values[index] as T;
        for (let other = index + 1; other < values.length; other++) {
            if (equals(first, values[other] as T)) return false;
        }
    }
    return true;
}

export function getSettingDefault(def: FoundationSettingDef): unknown {
    switch (def.type) {
        case OptionType.SELECT: {
            const marked = def.options.find((option) => option.default === true);
            return marked?.value;
        }
        case OptionType.SLIDER:
            return def.default;
        case OptionType.STRING:
        case OptionType.NUMBER:
        case OptionType.BIGINT:
        case OptionType.BOOLEAN:
        case OptionType.COMPONENT:
        case OptionType.CUSTOM:
            return "default" in def ? def.default : undefined;
        default:
            return undefined;
    }
}

export function validateSettingValue(
    def: FoundationSettingDef,
    value: unknown
): string | undefined {
    switch (def.type) {
        case OptionType.STRING:
            if (typeof value !== "string") return "Expected a string value";
            break;
        case OptionType.NUMBER:
            if (!isFiniteNumber(value)) return "Expected a finite number";
            if (def.min !== undefined && value < def.min)
                return `Value must be at least ${def.min}`;
            if (def.max !== undefined && value > def.max) return `Value must be at most ${def.max}`;
            break;
        case OptionType.BIGINT:
            if (typeof value !== "bigint") return "Expected a bigint value";
            if (def.min !== undefined && value < def.min)
                return `Value must be at least ${def.min}`;
            if (def.max !== undefined && value > def.max) return `Value must be at most ${def.max}`;
            break;
        case OptionType.BOOLEAN:
            if (typeof value !== "boolean") return "Expected a boolean value";
            break;
        case OptionType.SELECT: {
            if (!def.options.some((option) => Object.is(option.value, value)))
                return "Value is not a select option";
            break;
        }
        case OptionType.SLIDER: {
            if (!isFiniteNumber(value)) return "Expected a finite number";
            if (!def.markers.includes(value)) return "Value must be one of the slider markers";
            break;
        }
        case OptionType.COMPONENT:
        case OptionType.CUSTOM:
            break;
        default:
            return "Unsupported setting type";
    }

    if (typeof def.isValid === "function") {
        const result = def.isValid.call({} as DefinedSettings, value);
        if (result !== true)
            return typeof result === "string" && result ? result : "Value failed custom validation";
    }

    return undefined;
}

export function sanitizeSettingValue(def: FoundationSettingDef, value: unknown): unknown {
    const issue = validateSettingValue(def, value);
    if (!issue) return value;
    const fallback = getSettingDefault(def);
    if (fallback === undefined && def.type === OptionType.SELECT) return def.options[0]?.value;
    return fallback;
}

function validateCommonFields(def: FoundationSettingDef): string[] {
    const issues: string[] = [];
    const common = def as unknown as UnknownRecord;

    if (def.type === OptionType.COMPONENT) {
        // Vencord component rows may omit the description or use an empty string.
        if (common.description !== undefined && typeof common.description !== "string") {
            issues.push("description must be a string");
        }
    } else if (!isNonEmptyString(common.description)) {
        issues.push("description must be a non-empty string");
    }
    if (common.displayName !== undefined && !isNonEmptyString(common.displayName)) {
        issues.push("displayName must be a non-empty string");
    }
    if (common.placeholder !== undefined && typeof common.placeholder !== "string") {
        issues.push("placeholder must be a string");
    }
    if (common.onChange !== undefined && typeof common.onChange !== "function")
        issues.push("onChange must be a function");
    if (common.isValid !== undefined && typeof common.isValid !== "function")
        issues.push("isValid must be a function");
    if (common.restartNeeded !== undefined && typeof common.restartNeeded !== "boolean") {
        issues.push("restartNeeded must be a boolean");
    }

    for (const field of ["disabled", "hidden"] as const) {
        const value = common[field];
        if (value !== undefined && typeof value !== "boolean" && typeof value !== "function") {
            issues.push(`${field} must be a boolean or function`);
        }
    }

    if (common.componentProps !== undefined && !isRecord(common.componentProps)) {
        issues.push("componentProps must be an object");
    }
    if (
        common.target !== undefined &&
        !["WEB", "DESKTOP", "BOTH"].includes(String(common.target))
    ) {
        issues.push("target must be WEB, DESKTOP, or BOTH");
    }

    const meta = common.foundation;
    if (!isRecord(meta)) {
        issues.push("foundation metadata is required");
        return issues;
    }
    if (!isSettingSection(meta.section)) issues.push("foundation.section is invalid");
    if (meta.changeMode !== "live" && meta.changeMode !== "restart")
        issues.push("foundation.changeMode must be live or restart");
    if (meta.order !== undefined && (!Number.isInteger(meta.order) || (meta.order as number) < 0)) {
        issues.push("foundation.order must be a non-negative integer");
    }
    if (
        !Array.isArray(meta.readPaths) ||
        meta.readPaths.length === 0 ||
        !meta.readPaths.every(isNonEmptyString)
    ) {
        issues.push("foundation.readPaths must contain at least one non-empty string");
    } else if (!unique(meta.readPaths)) {
        issues.push("foundation.readPaths must not contain duplicates");
    }
    if (meta.docs !== undefined && typeof meta.docs !== "string")
        issues.push("foundation.docs must be a string");

    const expectedRestart = meta.changeMode === "restart";
    if ((common.restartNeeded === true) !== expectedRestart) {
        issues.push("restartNeeded must match foundation.changeMode");
    }

    return issues;
}

function validateTypedFields(def: FoundationSettingDef): string[] {
    const issues: string[] = [];

    switch (def.type) {
        case OptionType.STRING:
            if (def.default !== undefined && typeof def.default !== "string")
                issues.push("default must be a string");
            if (def.multiline !== undefined && typeof def.multiline !== "boolean")
                issues.push("multiline must be a boolean");
            break;
        case OptionType.NUMBER:
            if (def.default !== undefined && !isFiniteNumber(def.default))
                issues.push("default must be a finite number");
            if (def.min !== undefined && !isFiniteNumber(def.min))
                issues.push("min must be a finite number");
            if (def.max !== undefined && !isFiniteNumber(def.max))
                issues.push("max must be a finite number");
            if (isFiniteNumber(def.min) && isFiniteNumber(def.max) && def.min > def.max)
                issues.push("min must be <= max");
            if (isFiniteNumber(def.default) && isFiniteNumber(def.min) && def.default < def.min) {
                issues.push("default must be >= min");
            }
            if (isFiniteNumber(def.default) && isFiniteNumber(def.max) && def.default > def.max) {
                issues.push("default must be <= max");
            }
            break;
        case OptionType.BIGINT:
            if (def.default !== undefined && typeof def.default !== "bigint")
                issues.push("default must be a bigint");
            if (def.min !== undefined && typeof def.min !== "bigint")
                issues.push("min must be a bigint");
            if (def.max !== undefined && typeof def.max !== "bigint")
                issues.push("max must be a bigint");
            if (typeof def.min === "bigint" && typeof def.max === "bigint" && def.min > def.max) {
                issues.push("min must be <= max");
            }
            if (
                typeof def.default === "bigint" &&
                typeof def.min === "bigint" &&
                def.default < def.min
            ) {
                issues.push("default must be >= min");
            }
            if (
                typeof def.default === "bigint" &&
                typeof def.max === "bigint" &&
                def.default > def.max
            ) {
                issues.push("default must be <= max");
            }
            break;
        case OptionType.BOOLEAN:
            if (def.default !== undefined && typeof def.default !== "boolean")
                issues.push("default must be a boolean");
            break;
        case OptionType.SELECT: {
            if (!Array.isArray(def.options) || def.options.length === 0) {
                issues.push("options must contain at least one entry");
                break;
            }
            const values: Array<string | number | boolean> = [];
            const defaults: number[] = [];
            for (const [index, option] of def.options.entries()) {
                if (!isRecord(option)) {
                    issues.push(`options[${index}] must be an object`);
                    continue;
                }
                if (!isNonEmptyString(option.label))
                    issues.push(`options[${index}].label must be a non-empty string`);
                if (
                    typeof option.value !== "string" &&
                    typeof option.value !== "number" &&
                    typeof option.value !== "boolean"
                ) {
                    issues.push(`options[${index}].value must be a string, number, or boolean`);
                    continue;
                }
                if (typeof option.value === "number" && !Number.isFinite(option.value)) {
                    issues.push(`options[${index}].value must be finite`);
                    continue;
                }
                values.push(option.value);
                if (option.default === true) defaults.push(index);
            }
            if (!unique(values)) issues.push("options must have unique values");
            if (defaults.length !== 1) issues.push("exactly one option must be marked default");
            break;
        }
        case OptionType.SLIDER: {
            if (
                !Array.isArray(def.markers) ||
                def.markers.length === 0 ||
                !def.markers.every(isFiniteNumber)
            ) {
                issues.push("markers must contain at least one finite number");
                break;
            }
            if (!unique(def.markers)) issues.push("markers must be unique");
            const sorted = [...def.markers].sort((a, b) => a - b);
            if (def.markers.some((value, index) => value !== sorted[index]))
                issues.push("markers must be sorted ascending");
            if (!isFiniteNumber(def.default)) issues.push("default must be a finite number");
            else if (!def.markers.includes(def.default))
                issues.push("default must be one of the slider markers");
            if (def.stickToMarkers !== undefined && typeof def.stickToMarkers !== "boolean") {
                issues.push("stickToMarkers must be a boolean");
            }
            break;
        }
        case OptionType.COMPONENT:
            if (typeof def.component !== "function") issues.push("component must be a function");
            break;
        case OptionType.CUSTOM:
            break;
        default:
            issues.push("unsupported setting type");
    }

    return issues;
}

export function validateFoundationDefinition(
    definition: FoundationSettingsDefinition
): readonly SettingsIssue[] {
    const issues: SettingsIssue[] = [];
    const keyPattern = /^[A-Za-z][A-Za-z0-9_]*$/;

    for (const [key, def] of Object.entries(definition)) {
        if (!keyPattern.test(key))
            issues.push({ key, message: "setting key must match /^[A-Za-z][A-Za-z0-9_]*$/" });
        if (!def || typeof def !== "object") {
            issues.push({ key, message: "setting definition must be an object" });
            continue;
        }

        const messages = [...validateCommonFields(def), ...validateTypedFields(def)];
        for (const message of messages) issues.push({ key, message });
    }

    return issues;
}

export function validatePluginSettingsDefinition(
    definition: FoundationSettingsDefinition
): readonly SettingsIssue[] {
    const issues: SettingsIssue[] = [];

    for (const key of Object.keys(definition)) {
        if ((FOUNDATION_SETTING_KEYS as readonly string[]).includes(key)) {
            issues.push({ key, message: "reserved foundation setting key cannot be overridden" });
        }
    }

    return issues;
}

export function validateSettingsSnapshot(
    definition: FoundationSettingsDefinition,
    values: Readonly<Record<string, unknown>>
): readonly SettingsIssue[] {
    const issues: SettingsIssue[] = [];
    for (const [key, def] of Object.entries(definition)) {
        const issue = validateSettingValue(def, values[key]);
        if (issue) issues.push({ key, message: issue });
    }
    return issues;
}
