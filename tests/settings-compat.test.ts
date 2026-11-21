import { OptionType } from "@utils/types";
import { describe, expect, it } from "vitest";

import { definition, settings } from "../settings";

interface ExpectedSetting {
    type: OptionType;
    default?: unknown;
    hidden?: boolean;
    description?: string;
    markers?: number[];
    options?: Array<{ label: string; value: string | number | boolean; default?: boolean }>;
}

const LEGACY_SETTINGS: Record<string, ExpectedSetting> = {
    updateNotifications: { type: OptionType.BOOLEAN, default: true },
    discordServerJoin: { type: OptionType.BOOLEAN, default: true },
    goToUpdateChannel: { type: OptionType.BOOLEAN, default: true },
    toastSettings: { type: OptionType.COMPONENT, description: "" },
    toastPosition: {
        type: OptionType.SELECT,
        hidden: true,
        options: [
            { label: "Top Right", value: "top-right", default: true },
            { label: "Top Left", value: "top-left" },
            { label: "Top Center", value: "top-center" },
            { label: "Bottom Right", value: "bottom-right" },
            { label: "Bottom Left", value: "bottom-left" },
            { label: "Bottom Center", value: "bottom-center" },
        ],
    },
    toastStyle: {
        type: OptionType.SELECT,
        hidden: true,
        options: [
            { label: "Glass (blurred)", value: "glass", default: true },
            { label: "Solid (dark)", value: "solid" },
            { label: "Minimal (flat)", value: "minimal" },
        ],
    },
    toastBgColor: { type: OptionType.STRING, default: "#000000", hidden: true },
    toastAccentColor: { type: OptionType.STRING, default: "#5865F2", hidden: true },
    toastTextColor: { type: OptionType.STRING, default: "#FFFFFF", hidden: true },
    toastPercentColor: { type: OptionType.STRING, default: "#43b581", hidden: true },
    toastBarBgColor: { type: OptionType.STRING, default: "#333333", hidden: true },
    toastBorderColor: {
        type: OptionType.STRING,
        default: "rgba(255,255,255,0.08)",
        hidden: true,
    },
    toastBorderRadius: {
        type: OptionType.SLIDER,
        default: 10,
        hidden: true,
        markers: [0, 4, 8, 10, 12, 16, 20, 24, 32],
    },
    toastFontSize: {
        type: OptionType.SLIDER,
        default: 13,
        hidden: true,
        markers: [10, 11, 12, 13, 14, 15, 16, 18, 20],
    },
    toastPadding: {
        type: OptionType.SLIDER,
        default: 10,
        hidden: true,
        markers: [4, 6, 8, 10, 12, 16],
    },
    toastOpacity: {
        type: OptionType.SLIDER,
        default: 85,
        hidden: true,
        markers: [50, 60, 70, 80, 85, 90, 95, 100],
    },
    toastMaxWidth: {
        type: OptionType.SLIDER,
        default: 400,
        hidden: true,
        markers: [250, 300, 350, 400, 450, 500, 600, 800],
    },
    toastAutoDismiss: { type: OptionType.BOOLEAN, default: true, hidden: true },
    toastDismissDelayMs: {
        type: OptionType.SLIDER,
        default: 8000,
        hidden: true,
        markers: [1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000],
    },
    toastMaxStack: {
        type: OptionType.SLIDER,
        default: 5,
        hidden: true,
        markers: [1, 2, 3, 4, 5, 6, 7, 8],
    },
    toastShowTimer: { type: OptionType.BOOLEAN, default: true, hidden: true },
};

const FOUNDATION_SETTINGS: Record<string, ExpectedSetting> = {
    foundationBridgeEnabled: { type: OptionType.BOOLEAN, default: false },
    foundationDiagnosticsEnabled: { type: OptionType.BOOLEAN, default: false },
    foundationLogLevel: { type: OptionType.SELECT, default: undefined },
};

describe("Clonecord settings compatibility", () => {
    it("exports the foundation definition as the live Vencord settings object", () => {
        expect(settings).toBe(definition.settings);
        expect(settings.def).toBe(definition.definition);
        expect(definition.pluginName).toBe("Clonecord");
    });

    it("preserves all 21 legacy settings exactly", () => {
        const legacyKeys = Object.keys(LEGACY_SETTINGS);
        expect(legacyKeys).toHaveLength(21);
        for (const key of legacyKeys) {
            expect(definition.keys).toContain(key);
            assertSetting(key, LEGACY_SETTINGS[key]);
        }
    });

    it("adds only the three reserved foundation settings", () => {
        expect(definition.keys).toHaveLength(24);
        for (const key of Object.keys(FOUNDATION_SETTINGS)) {
            expect(definition.keys).toContain(key);
            assertSetting(key, FOUNDATION_SETTINGS[key]);
        }
        expect((definition.definition.foundationLogLevel as any).options).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ value: "warn", default: true }),
                expect.objectContaining({ value: "debug" }),
                expect.objectContaining({ value: "info" }),
                expect.objectContaining({ value: "error" }),
                expect.objectContaining({ value: "none" }),
            ])
        );
    });

    it("records foundation metadata for every setting", () => {
        for (const key of definition.keys) {
            const meta = definition.metadata[key];
            expect(meta).toBeDefined();
            expect(meta.section.length).toBeGreaterThan(0);
            expect(Array.isArray(meta.readPaths)).toBe(true);
        }
    });
});

function assertSetting(key: string, expected: ExpectedSetting): void {
    const actual = definition.definition[key] as any;
    expect(actual, `missing setting ${key}`).toBeDefined();
    expect(actual.type, `${key}.type`).toBe(expected.type);

    if ("default" in expected) expect(actual.default, `${key}.default`).toBe(expected.default);
    if (expected.hidden !== undefined)
        expect(Boolean(actual.hidden), `${key}.hidden`).toBe(expected.hidden);
    if (expected.description !== undefined) {
        expect(actual.description, `${key}.description`).toBe(expected.description);
    }
    if (expected.markers) expect(actual.markers, `${key}.markers`).toEqual(expected.markers);
    if (expected.options) expect(actual.options, `${key}.options`).toEqual(expected.options);
}
