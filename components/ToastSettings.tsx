// ---------------------------------------------------------------------------
// Questcord-style settings page.
//
// All plugin options are declared `hidden: true` in settings.ts so they do
// not show up in Vencord's standard options list. Instead this component is
// mounted via `settingsAboutComponent` (index.tsx) and renders the version
// card, toggles, sliders, selects and real color pickers — mirroring the
// layout of Questcord's settings page 1:1.
//
// UI pattern adapted from Questcord (https://github.com/zpt0/questcord) by
// zpt0, licensed AGPL-3.0 — Clonecord shares the same author.
// ---------------------------------------------------------------------------

import "./toastSettings.css";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Switch } from "@components/Switch";
import { classNameFactory } from "@utils/css";
import { Select, Slider } from "@webpack/common";

import { settings } from "../settings";
import { ColorPicker } from "./ColorPicker";
import { VersionDisplay } from "./VersionDisplay";

const cl = classNameFactory("vc-clonecord-settings-");

// values must match the [data-pos] selectors in styles.css
const POSITION_OPTIONS = [
    { label: "Top Left", value: "top-left" },
    { label: "Top Center", value: "top-center" },
    { label: "Top Right", value: "top-right" },
    { label: "Bottom Left", value: "bottom-left" },
    { label: "Bottom Center", value: "bottom-center" },
    { label: "Bottom Right", value: "bottom-right" },
];

const STYLE_OPTIONS = [
    { label: "Glass (blurred)", value: "glass" },
    { label: "Solid (dark)", value: "solid" },
    { label: "Minimal (flat)", value: "minimal" },
];

// every toast* key, including the legacy one only older builds stored
const TOAST_SETTING_KEYS = [
    "toastPosition",
    "toastStyle",
    "toastBgColor",
    "toastAccentColor",
    "toastTextColor",
    "toastPercentColor",
    "toastBarBgColor",
    "toastBorderColor",
    "toastBorderRadius",
    "toastFontSize",
    "toastPadding",
    "toastOpacity",
    "toastMaxWidth",
    "toastAutoDismiss",
    "toastDismissDelayMs",
    "toastMaxStack",
    "toastShowTimer",
    // legacy key from earlier versions
    "toastCustomColor",
];

function SettingToggle({
    settingKey,
    label,
    note,
}: {
    settingKey: string;
    label: string;
    note?: string;
}) {
    const value = settings.use([settingKey])[settingKey];
    return (
        <div className={cl("setting-item")}>
            <div className={cl("toggle-row")}>
                <div className={cl("toggle-label")}>
                    <Heading style={{ marginBottom: 0 }}>{label}</Heading>
                    {note && <Paragraph>{note}</Paragraph>}
                </div>
                <Switch
                    checked={!!value}
                    onChange={(checked: boolean) => (settings.store[settingKey] = checked)}
                />
            </div>
        </div>
    );
}

function SettingSelect({
    settingKey,
    label,
    note,
    options,
}: {
    settingKey: string;
    label: string;
    note?: string;
    options: Array<{ label: string; value: string }>;
}) {
    const value = settings.use([settingKey])[settingKey];
    return (
        <div className={cl("setting-item")}>
            <Heading>{label}</Heading>
            {note && <Paragraph style={{ marginBottom: 8 }}>{note}</Paragraph>}
            <Select
                options={options}
                select={(v: string) => (settings.store[settingKey] = v)}
                isSelected={(v: string) => v === value}
                serialize={(v: string) => v}
            />
        </div>
    );
}

function SettingSlider({
    settingKey,
    label,
    note,
    min,
    max,
    markers,
    unit = "px",
}: {
    settingKey: string;
    label: string;
    note?: string;
    min: number;
    max: number;
    markers?: number[];
    unit?: string;
}) {
    const value = settings.use([settingKey])[settingKey];
    return (
        <div className={cl("setting-item")}>
            <Heading>{label}</Heading>
            {note && <Paragraph style={{ marginBottom: 8 }}>{note}</Paragraph>}
            <Slider
                initialValue={value}
                onValueChange={(v: number) => (settings.store[settingKey] = v)}
                minValue={min}
                maxValue={max}
                markers={markers}
                onValueRender={(v: number) => `${v}${unit}`}
            />
        </div>
    );
}

/** Like SettingSlider, but stores seconds as milliseconds. */
function SettingSeconds({
    settingKey,
    label,
    note,
    min,
    max,
    markers,
}: {
    settingKey: string;
    label: string;
    note?: string;
    min: number;
    max: number;
    markers?: number[];
}) {
    const valueMs = settings.use([settingKey])[settingKey];
    const seconds = Math.round((Number(valueMs) || 8000) / 1000);
    return (
        <div className={cl("setting-item")}>
            <Heading>{label}</Heading>
            {note && <Paragraph style={{ marginBottom: 8 }}>{note}</Paragraph>}
            <Slider
                initialValue={seconds}
                onValueChange={(v: number) => (settings.store[settingKey] = v * 1000)}
                minValue={min}
                maxValue={max}
                markers={markers}
                onValueRender={(v: number) => `${v}s`}
            />
        </div>
    );
}

function SettingColor({
    settingKey,
    label,
    note,
    fallback,
}: {
    settingKey: string;
    label: string;
    note?: string;
    fallback?: string;
}) {
    const value = settings.use([settingKey])[settingKey];
    return (
        <div className={cl("setting-item")}>
            <div className={cl("color-row")}>
                <div className={cl("color-label")}>
                    <Heading>{label}</Heading>
                    {note && <Paragraph>{note}</Paragraph>}
                </div>
                <ColorPicker
                    value={value}
                    fallback={fallback}
                    onChange={(hex: string) => (settings.store[settingKey] = hex)}
                />
            </div>
        </div>
    );
}

function getDefaults(): Record<string, any> {
    const defaults: Record<string, any> = {};
    try {
        for (const [key, def] of Object.entries((settings as any).def ?? {})) {
            const d = (def as any)?.default;
            if (d !== undefined) defaults[key] = d;
        }
    } catch {}
    return defaults;
}

function resetToastCustomization() {
    const defaults = getDefaults();
    const store = settings.store as Record<string, any>;
    for (const key of TOAST_SETTING_KEYS) {
        if (defaults[key] !== undefined) store[key] = defaults[key];
        else delete store[key];
    }
}

function resetAllSettings() {
    const defaults = getDefaults();
    const store = settings.store as Record<string, any>;
    for (const key of Object.keys(defaults)) store[key] = defaults[key];
}

export function ToastSettings() {
    return (
        <div className={cl("root")}>
            <VersionDisplay />

            <section title="Toast behaviour">
                <SettingToggle
                    settingKey="toastAutoDismiss"
                    label="Auto-dismiss"
                    note="Automatically dismiss toasts after the set time (hovering pauses it)"
                />
                <SettingSeconds
                    settingKey="toastDismissDelayMs"
                    label="Dismiss delay"
                    note="How long toasts stay on screen"
                    min={1}
                    max={30}
                    markers={[1, 2, 3, 5, 8, 10, 15, 20, 30]}
                />
                <SettingToggle
                    settingKey="toastShowTimer"
                    label="Show timer"
                    note="Show elapsed time on the progress toast"
                />
                <SettingSlider
                    settingKey="toastMaxStack"
                    label="Stack limit"
                    note="Maximum number of visible toasts at once"
                    min={1}
                    max={8}
                    markers={[1, 2, 3, 4, 5, 6, 7, 8]}
                    unit=""
                />
            </section>

            <section title="Plugin">
                <SettingToggle
                    settingKey="updateNotifications"
                    label="Update notifications"
                    note="Show update notifications on startup"
                />
                <SettingToggle
                    settingKey="autoJoinUpdatesChannel"
                    label="Join updates channel"
                    note="Automatically join the updates channel on plugin start"
                />
            </section>

            <section title="Toast position">
                <SettingSelect
                    settingKey="toastPosition"
                    label="Position"
                    note="Where toast notifications appear on screen"
                    options={POSITION_OPTIONS}
                />
            </section>

            <section title="Toast colors">
                <div className={cl("color-grid")}>
                    <SettingColor
                        settingKey="toastBgColor"
                        label="Background"
                        note="Toast background color"
                    />
                    <SettingColor
                        settingKey="toastAccentColor"
                        label="Accent"
                        note="Progress bars, spinners, highlights"
                    />
                    <SettingColor
                        settingKey="toastTextColor"
                        label="Text"
                        note="Toast title text color"
                    />
                    <SettingColor
                        settingKey="toastPercentColor"
                        label="Percent"
                        note="Progress percent text color"
                    />
                    <SettingColor
                        settingKey="toastBarBgColor"
                        label="Bar Background"
                        note="Progress bar track color"
                    />
                    <SettingColor
                        settingKey="toastBorderColor"
                        label="Border"
                        note="Toast border color"
                        fallback="#FFFFFF"
                    />
                </div>
            </section>

            <section title="Toast appearance">
                <SettingSelect
                    settingKey="toastStyle"
                    label="Style"
                    note="Toast look"
                    options={STYLE_OPTIONS}
                />
                <SettingSlider
                    settingKey="toastBorderRadius"
                    label="Corner radius"
                    note="Toast corner roundness"
                    min={0}
                    max={32}
                    markers={[0, 4, 8, 10, 12, 16, 20, 24, 32]}
                />
                <SettingSlider
                    settingKey="toastFontSize"
                    label="Font size"
                    note="Toast text size"
                    min={10}
                    max={20}
                    markers={[10, 11, 12, 13, 14, 15, 16, 18, 20]}
                />
                <SettingSlider
                    settingKey="toastOpacity"
                    label="Opacity"
                    note="Toast background transparency"
                    min={50}
                    max={100}
                    markers={[50, 60, 70, 80, 85, 90, 95, 100]}
                    unit="%"
                />
                <SettingSlider
                    settingKey="toastPadding"
                    label="Padding"
                    note="Toast inner spacing"
                    min={4}
                    max={16}
                    markers={[4, 6, 8, 10, 12, 16]}
                />
                <SettingSlider
                    settingKey="toastMaxWidth"
                    label="Max width"
                    note="Maximum width of toast pills"
                    min={250}
                    max={800}
                    markers={[250, 300, 350, 400, 450, 500, 600, 800]}
                />
            </section>

            <section title="Reset">
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        className={cl("reset-btn")}
                        style={{ flex: 1 }}
                        onClick={() => {
                            try {
                                resetToastCustomization();
                            } catch (e) {
                                console.warn("[Clonecord] resetToastCustomization failed:", e);
                            }
                        }}
                    >
                        Reset Customization
                    </button>
                    <button
                        className={cl("reset-btn")}
                        style={{ flex: 1 }}
                        onClick={() => {
                            try {
                                resetAllSettings();
                            } catch (e) {
                                console.warn("[Clonecord] resetAllSettings failed:", e);
                            }
                        }}
                    >
                        Reset All Settings
                    </button>
                </div>
            </section>
        </div>
    );
}
