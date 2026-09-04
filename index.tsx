import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { ModalProps, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { Guild } from "@vencord/discord-types";
import { Menu, React } from "@webpack/common";
import { DataStore } from "@api/index";

import "./styles.css";

import { PLUGIN_VERSION, UPDATE_CHECK_ENABLED, UPDATE_CHECK_URL } from "./constants";
import { settings } from "./settings";
import { showUpdateModal, navigateToUpdatesChannel } from "./components/UpdateModal";
import { CloneModal } from "./components/CloneModal";
import { cloneServer, resumeClone } from "./core/clone";
import { loadCheckpoint, clearCheckpoint } from "./core/checkpoints";
import { state } from "./store";
import { cleanupContainer, notify } from "./utils/notifications";
import { compareVersions } from "./utils/helpers";
import { registerDevTools, unregisterDevTools } from "./devTools";

function ClonecordIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <defs>
                <linearGradient id="cc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
            </defs>
            <path d="M8.5 6L15.5 6L12 14Z" fill="url(#cc-grad)" />
            <path
                d="M12 3L21 12L12 21L3 12Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="3 2"
                opacity="0.5"
                fill="none"
            />
        </svg>
    );
}

async function checkForUpdates(): Promise<void> {
    if (!UPDATE_CHECK_ENABLED) return;
    if (!settings.updateNotifications.value) return;

    try {
        const lastDismissed = (await DataStore.get("Clonecord-dismissed-version")) as
            string | undefined;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(UPDATE_CHECK_URL, {
            signal: controller.signal,
            headers: { Accept: "application/vnd.github.v3+json" },
        });

        clearTimeout(timeoutId);

        if (!response.ok) return;

        const data = await response.json();
        let latestVersion = data.tag_name || data.name || "";
        latestVersion = latestVersion.replace(/^v/i, "").trim();

        if (!latestVersion) return;

        const comparison = compareVersions(latestVersion, PLUGIN_VERSION);

        if (comparison > 0 && lastDismissed !== latestVersion) {
            const releaseNotes = data.body || "No release notes available.";
            showUpdateModal(latestVersion, releaseNotes);
        }
    } catch (e) {
        console.warn("[Clonecord] Update check failed:", e);
    }
}

async function checkForUnfinishedClone(): Promise<void> {
    try {
        const checkpoint = await loadCheckpoint();
        if (!checkpoint) return;
        const done = Object.values(checkpoint.progress).reduce((a, b) => a + b, 0);
        notify(
            "Unfinished Clone Found",
            `${checkpoint.sourceGuildName}: ${done} items already cloned. Resume or discard.`,
            "info",
            15000,
            [
                {
                    label: "Resume",
                    type: "default",
                    onClick: () => resumeClone(checkpoint.runId).catch(() => {}),
                },
                {
                    label: "Discard",
                    type: "danger",
                    onClick: () => clearCheckpoint().catch(() => {}),
                },
            ]
        );
    } catch (e) {
        console.warn("[Clonecord] Checkpoint check failed:", e);
    }
}

const guildContextMenuPatch: NavContextMenuPatchCallback = (
    children: any[],
    props: { guild?: Guild }
) => {
    if (!props?.guild) return;

    const group = findGroupChildrenByChildId("privacy", children);
    const menuItem = (
        <Menu.MenuItem
            id="clonecord-clone"
            label="Clone Server"
            icon={ClonecordIcon}
            action={() => {
                openModal((modalProps: ModalProps) => (
                    <CloneModal
                        props={modalProps}
                        guild={props.guild!}
                        onClone={(options) => cloneServer(props.guild!, options)}
                    />
                ));
            }}
        />
    );

    if (group) {
        group.push(menuItem);
    } else {
        children.push(<Menu.MenuGroup>{menuItem}</Menu.MenuGroup>);
    }
};

export default definePlugin({
    name: "Clonecord",
    description: "Clone servers with channels, roles, permissions, and community features",
    authors: [{ name: "zpt0.dev", id: 299670891875270656n }],
    tags: ["Utility", "Customisation"],
    settings,

    start() {
        state.settings = settings;
        setTimeout(() => checkForUpdates(), 5000);
        setTimeout(() => navigateToUpdatesChannel().catch(() => {}), 3000);
        setTimeout(() => checkForUnfinishedClone(), 8000);
        registerDevTools();
    },

    stop() {
        unregisterDevTools();
        cleanupContainer();

        if (state.abortController) {
            state.abortController.abort();
            state.abortController = null;
        }
        state.isCloning = false;
        state.mainProgressNotificationId = null;
        state.currentCloneGuildId = null;
        state.skipRolesCallback = null;
    },

    patches: [
        {
            find: '"GuildChannelStore"',
            replacement: [
                {
                    match: /isChannelGated\(.+?\)(?=&&)/,
                    replace: (m: string) => `${m}&&false`,
                },
            ],
        },
    ],

    contextMenus: {
        "guild-context": guildContextMenuPatch,
        "guild-header-popout": guildContextMenuPatch,
    },
});
