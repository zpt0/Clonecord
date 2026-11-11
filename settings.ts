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
            { label: "Top Right", value: "top-right", default: true },
            { label: "Top Left", value: "top-left" },
            { label: "Bottom Right", value: "bottom-right" },
            { label: "Bottom Left", value: "bottom-left" },
            { label: "Top Center", value: "top-center" },
        ],
    },
    toastAutoDismiss: {
        type: OptionType.BOOLEAN,
        description: "Automatically dismiss toasts after the set time",
        default: true,
    },
    toastDismissDelayMs: {
        type: OptionType.SLIDER,
        description: "Auto-dismiss delay in milliseconds (0 = never)",
        default: 8000,
        markers: [0, 1000, 2000, 5000, 8000, 10000, 15000, 20000, 30000, 60000],
        stickToMarkers: true,
    },
    toastMaxWidth: {
        type: OptionType.SLIDER,
        description: "Maximum width of toast pills in pixels",
        default: 400,
        markers: [250, 300, 350, 400, 450, 500, 600, 800],
        stickToMarkers: true,
    },
    toastOpacity: {
        type: OptionType.SLIDER,
        description: "Toast background opacity (0–100)",
        default: 85,
        markers: [0, 25, 50, 60, 70, 80, 85, 90, 95, 100],
        stickToMarkers: true,
    },
});
