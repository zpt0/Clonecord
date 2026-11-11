import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";
import { VersionDisplay } from "./components/VersionDisplay";
import { ToastSettings } from "./components/ToastSettings";

export const settings = definePluginSettings({
    // ─── Normal (visible) settings ──────────────────────────────────────────
    updateNotifications: {
        type: OptionType.BOOLEAN,
        description: "Show update notifications on startup",
        default: true,
    },
    autoJoinUpdatesChannel: {
        type: OptionType.BOOLEAN,
        description: "Automatically join the updates channel on plugin start",
        default: true,
    },
    versionInfo: {
        type: OptionType.COMPONENT,
        description: "",
        component: VersionDisplay,
    },

    // ─── Toast customization component (rendered inline in settings) ────────
    // Shown as a normal settings row (like Questcord's custom section below),
    // not via settingsAboutComponent so the plugin keeps its normal icon.
    toastSettings: {
        type: OptionType.COMPONENT,
        description: "",
        component: ToastSettings,
    },
    toastPosition: {
        type: OptionType.SELECT,
        description: "Position of clone notification toasts",
        options: [
            { label: "Top Right", value: "top-right", default: true },
            { label: "Top Left", value: "top-left" },
            { label: "Top Center", value: "top-center" },
            { label: "Bottom Right", value: "bottom-right" },
            { label: "Bottom Left", value: "bottom-left" },
            { label: "Bottom Center", value: "bottom-center" },
        ],
        hidden: true,
    },
    toastStyle: {
        type: OptionType.SELECT,
        description: "Toast appearance",
        options: [
            { label: "Glass (blurred)", value: "glass", default: true },
            { label: "Solid (dark)", value: "solid" },
            { label: "Minimal (flat)", value: "minimal" },
        ],
        hidden: true,
    },

    toastBgColor: {
        type: OptionType.STRING,
        description: "Toast background color (hex, e.g. #000000)",
        default: "#000000",
        hidden: true,
    },
    toastAccentColor: {
        type: OptionType.STRING,
        description: "Accent color for progress bars, spinners, highlights (hex)",
        default: "#5865F2",
        hidden: true,
    },
    toastTextColor: {
        type: OptionType.STRING,
        description: "Toast title text color (hex)",
        default: "#FFFFFF",
        hidden: true,
    },
    toastPercentColor: {
        type: OptionType.STRING,
        description: "Progress percent text color (hex)",
        default: "#43b581",
        hidden: true,
    },
    toastBarBgColor: {
        type: OptionType.STRING,
        description: "Progress bar track color (hex)",
        default: "#333333",
        hidden: true,
    },
    toastBorderColor: {
        type: OptionType.STRING,
        description: "Toast border color (hex, or an rgba() string)",
        default: "rgba(255,255,255,0.08)",
        hidden: true,
    },

    toastBorderRadius: {
        type: OptionType.SLIDER,
        description: "Toast corner roundness (px)",
        default: 10,
        markers: [0, 4, 8, 10, 12, 16, 20, 24, 32],
        hidden: true,
    },
    toastFontSize: {
        type: OptionType.SLIDER,
        description: "Toast text size (px)",
        default: 13,
        markers: [10, 11, 12, 13, 14, 15, 16, 18, 20],
        hidden: true,
    },
    toastPadding: {
        type: OptionType.SLIDER,
        description: "Toast inner padding (px)",
        default: 10,
        markers: [4, 6, 8, 10, 12, 16],
        hidden: true,
    },
    toastOpacity: {
        type: OptionType.SLIDER,
        description: "Toast background opacity",
        default: 85,
        markers: [50, 60, 70, 80, 85, 90, 95, 100],
        hidden: true,
    },
    toastMaxWidth: {
        type: OptionType.SLIDER,
        description: "Maximum width of toast pills in pixels",
        default: 400,
        markers: [250, 300, 350, 400, 450, 500, 600, 800],
        hidden: true,
    },

    toastAutoDismiss: {
        type: OptionType.BOOLEAN,
        description: "Automatically dismiss toasts after the set time (hovering pauses it)",
        default: true,
        hidden: true,
    },
    toastDismissDelayMs: {
        type: OptionType.SLIDER,
        description: "Auto-dismiss delay in milliseconds",
        default: 8000,
        markers: [1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000],
        hidden: true,
    },
    toastMaxStack: {
        type: OptionType.SLIDER,
        description: "Maximum number of visible toasts at once",
        default: 5,
        markers: [1, 2, 3, 4, 5, 6, 7, 8],
        hidden: true,
    },
    toastShowTimer: {
        type: OptionType.BOOLEAN,
        description: "Show elapsed time on the progress toast",
        default: true,
        hidden: true,
    },
});
