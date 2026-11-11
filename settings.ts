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
});
