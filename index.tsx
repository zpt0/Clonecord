import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { ModalProps, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { Guild } from "@vencord/discord-types";
import { Menu, React, GuildStore } from "@webpack/common";
import { DataStore } from "@api/index";

import "./styles.css";

import { PLUGIN_VERSION, UPDATE_CHECK_ENABLED, UPDATE_CHECK_URL } from "./constants";
import { settings } from "./settings";
import { showUpdateModal, navigateToUpdatesChannel } from "./components/UpdateModal";
import { CloneModal } from "./components/CloneModal";
import { cloneServer, resumeClone } from "./core/clone";
import { loadCheckpoint, clearCheckpoint } from "./core/checkpoints";
import { state } from "./store";
import { cleanupContainer, notify, closePill } from "./utils/notifications";
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
            | string
            | undefined;

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
    } catch {
    }
}

async function checkForUnfinishedClone(): Promise<void> {
    if (state.isCloning) return;
    try {
        const checkpoint = await loadCheckpoint();
        if (!checkpoint) return;

        const sourceStillExists = !!GuildStore.getGuild(checkpoint.sourceGuildId);
        const targetStillExists = !!GuildStore.getGuild(checkpoint.targetGuildId);
        if (!sourceStillExists || !targetStillExists) {
            await clearCheckpoint();
            return;
        }

        const p = checkpoint.progress;
        const totalCloned =
            p.channelsCloned + p.categoriesCloned + p.rolesCloned +
            p.emojisCloned + p.stickersCloned + p.soundboardCloned;

        const opts = checkpoint.options as any;
        const expectedWork =
            (opts.cloneChannels ? 1 : 0) +
            (opts.cloneRoles ? 1 : 0) +
            (opts.cloneOnboarding ? 1 : 0) +
            (opts.cloneStickers ? 1 : 0) +
            (opts.cloneSoundboard ? 1 : 0);

        if (expectedWork === 0) {
            await clearCheckpoint();
            return;
        }

        const ago = Math.round((Date.now() - checkpoint.updatedAt) / 60000);
        const agoText = ago < 1 ? "just now" : ago === 1 ? "1 min ago" : `${ago} min ago`;
        const summary = totalCloned > 0
            ? `${checkpoint.sourceGuildName}: ${totalCloned} items cloned (${agoText})`
            : `${checkpoint.sourceGuildName} (${agoText})`;

        notify(
            "Unfinished Clone Found",
            `${summary}. Resume or discard?`,
            "info",
            0,
            [
                {
                    label: "Resume",
                    type: "default",
                    onClick: (id) => {
                        closePill(id);
                        resumeClone(checkpoint.runId).catch(() => {});
                    },
                },
                {
                    label: "Discard",
                    type: "danger",
                    onClick: (id) => {
                        closePill(id);
                        clearCheckpoint().catch(() => {});
                    },
                },
            ]
        );
    } catch {
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
