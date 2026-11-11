import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";
import { VersionDisplay } from "./components/VersionDisplay";

export const settings = definePluginSettings({
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

    // ─── Toast / Pill Customization ───────────────────────────────────────
    toastPosition: {
        type: OptionType.SELECT,
        description: "Position of clone notification toasts",
        options: [
            { label: "Top Right", value: "top-right" },
            { label: "Top Left", value: "top-left" },
            { label: "Bottom Right", value: "bottom-right" },
            { label: "Bottom Left", value: "bottom-left" },
            { label: "Top Center", value: "top-center" },
        ],
        default: "top-right",
    },
    toastAutoDismiss: {
        type: OptionType.BOOLEAN,
        description: "Automatically dismiss toasts after the set time",
        default: true,
    },
    toastDismissDelayMs: {
        type: OptionType.NUMBER,
        description: "Auto-dismiss delay in milliseconds (0 = never)",
        default: 8000,
        min: 0,
        max: 60000,
        step: 1000,
    },
    toastMaxWidth: {
        type: OptionType.NUMBER,
        description: "Maximum width of toast pills in pixels",
        default: 400,
        min: 250,
        max: 800,
        step: 50,
    },
    toastOpacity: {
        type: OptionType.NUMBER,
        description: "Toast background opacity (0–100)",
        default: 85,
        min: 0,
        max: 100,
        step: 5,
    },
});
