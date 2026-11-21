import type { DefinedSettings } from "@utils/types";
import type { ComponentType, ReactNode } from "react";

import type { UpdateTarget } from "../../foundation/core/updates";

export const SETTINGS_CATEGORY_ORDER = [
    "essential",
    "general",
    "updates",
    "design",
    "notifications",
    "advanced",
    "developer",
    "about",
] as const;

export type SettingsCategoryId = (typeof SETTINGS_CATEGORY_ORDER)[number];

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export type SettingControlKind =
    "toggle" | "select" | "slider" | "number" | "color" | "text" | "custom";

export interface SelectOptionLike {
    readonly label: string;
    readonly value: string | number | boolean;
    readonly default?: boolean;
}

/** Structural view of a Vencord setting definition used by the shared controls. */
export interface SettingDefinitionLike {
    readonly type?: number;
    readonly default?: unknown;
    readonly options?: unknown;
    readonly markers?: unknown;
    readonly min?: unknown;
    readonly max?: unknown;
    readonly stickToMarkers?: unknown;
    readonly isValid?: unknown;
    readonly restartNeeded?: unknown;
    readonly foundation?: {
        readonly changeMode?: unknown;
    };
}

export interface SettingFieldDefinition {
    readonly key: string;
    readonly label: string;
    readonly description: string;
    /** Detailed explanation revealed by a real, clickable info button. */
    readonly info?: string;
    /** Overrides the control inferred from the Vencord setting definition. */
    readonly control?: SettingControlKind;
    readonly badge?: string;
    readonly badgeTone?: BadgeTone;
    readonly width?: "full" | "half";
    /** Divides the stored value before display and multiplies it again on write. */
    readonly valueScale?: number;
    readonly unit?: string;
    /** Only used for `control: "custom"`; keeps component rows inside the same grid. */
    readonly render?: ReactNode;
}

export interface SettingsActionDefinition {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly info?: string;
    readonly variant?: "primary" | "secondary" | "dangerPrimary" | "dangerSecondary";
    readonly badge?: string;
    readonly badgeTone?: BadgeTone;
    readonly run: () => void | Promise<void>;
    readonly menu?: readonly {
        readonly id: string;
        readonly label: string;
        readonly run: () => void | Promise<void>;
        readonly danger?: boolean;
    }[];
}

export interface SettingsGroupDefinition {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly fields?: readonly SettingFieldDefinition[];
    readonly actions?: readonly SettingsActionDefinition[];
    /** Component references are rendered lazily during settings render, not at module load. */
    readonly render?: ReactNode | ComponentType;
}

export interface SettingsCategoryDefinition {
    readonly id: SettingsCategoryId;
    readonly title: string;
    readonly description: string;
    readonly groups: readonly SettingsGroupDefinition[];
}

export interface UnifiedSettingsConfig {
    readonly pluginName: string;
    readonly version: string;
    readonly tagline: string;
    readonly license: string;
    /** Repository URL used by the original Vencord "View source code" button. */
    readonly sourceUrl?: string;
    /** Release feeds checked by the shared Updates tab. */
    readonly updates?: readonly UpdateTarget[];
    readonly settings: DefinedSettings;
    /** `definition.definition` from defineFoundationSettings, used for type/default metadata. */
    readonly definition: Readonly<Record<string, SettingDefinitionLike>>;
    readonly categories: readonly SettingsCategoryDefinition[];
    /** COMPONENT rows that are rendered by an equivalent custom panel instead of a store control. */
    readonly componentKeys?: readonly string[];
}
