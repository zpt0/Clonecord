import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import definePlugin from "@utils/types";
import { Guild } from "@vencord/discord-types";
import { Menu, openModal, type RenderModalProps } from "@webpack/common";

import "./styles.css";
import foundationManagedStyle from "./foundation/ui/styles.css?managed";

import { startRuntime, stopRuntime } from "./pluginRuntime";
import { patchManifest } from "./patches";
import { settings } from "./settings";
import { CloneModal } from "./components/CloneModal";
import { ClonecordUnifiedSettings } from "./components/UnifiedSettings";
import { cloneServer } from "./core/clone";

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
                openModal((modalProps: RenderModalProps) => (
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
    settingsAboutComponent: () => <ClonecordUnifiedSettings />,
    managedStyle: foundationManagedStyle,
    patches: patchManifest.toVencordPatches("Clonecord"),

    start() {
        void startRuntime();
    },

    stop() {
        return stopRuntime();
    },

    contextMenus: {
        "guild-context": guildContextMenuPatch,
        "guild-header-popout": guildContextMenuPatch,
    },
});
