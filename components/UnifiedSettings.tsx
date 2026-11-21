import { GITHUB_RELEASE_URL, PLUGIN_AUTHOR, PLUGIN_VERSION, UPDATE_CHECK_URL } from "../constants";
import type { UpdateTarget } from "../foundation/core/updates";
import {
    FoundationAboutPanel,
    FoundationAuthorPanel,
    FoundationLogViewer,
    FoundationPatchStatus,
    FoundationUpdatePanel,
} from "../foundation/ui/components";
import { patchManifest } from "../patches";
import { getActiveRuntime } from "../pluginRuntime";
import {
    type SettingFieldDefinition,
    SettingsApp,
    type UnifiedSettingsConfig,
    resetSettingKeys,
} from "../platform/settings";
import { definition, settings } from "../settings";
import { DesignPreview } from "./DesignPreview";

function field(
    key: string,
    label: string,
    description: string,
    info: string,
    extra: Partial<SettingFieldDefinition> = {}
): SettingFieldDefinition {
    return { key, label, description, info, ...extra };
}

const TOAST_CUSTOMIZATION_KEYS = [
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
    // legacy key retained so older profiles are cleaned up as before
    "toastCustomColor",
];

const ALL_KEYS = Object.keys(definition.definition);

const UPDATE_TARGETS: readonly UpdateTarget[] = [
    {
        pluginName: "Clonecord",
        version: PLUGIN_VERSION,
        checkUrl: UPDATE_CHECK_URL,
        releasesUrl: GITHUB_RELEASE_URL,
        changelogUrl: "https://github.com/zpt0/Clonecord/blob/main/CHANGELOG.md",
    },
];

function ClonecordAbout() {
    return (
        <div className="vc-platform-settings-about-stack">
            <FoundationAboutPanel
                pluginName="Clonecord"
                version={PLUGIN_VERSION}
                definition={definition.definition}
                lifecycleState={getActiveRuntime() ? "started" : "idle"}
            />
            <FoundationAuthorPanel authors={[PLUGIN_AUTHOR]} />
        </div>
    );
}

export const config: UnifiedSettingsConfig = {
    pluginName: "Clonecord",
    version: PLUGIN_VERSION,
    tagline: "Clone servers with channels, roles, permissions and community features.",
    license: "AGPL-3.0-only · zpt0.dev",
    sourceUrl: "https://github.com/zpt0/Clonecord",
    updates: UPDATE_TARGETS,
    settings,
    definition: definition.definition,
    componentKeys: ["toastSettings"],
    categories: [
        {
            id: "essential",
            title: "Essential",
            description: "The primary Clonecord behavior control.",
            groups: [
                {
                    id: "clonecord-update",
                    title: "Updates",
                    fields: [
                        field(
                            "updateNotifications",
                            "Update notifications",
                            "Show update notifications on startup.",
                            "This only controls the in-app notification. It does not open a browser tab by itself."
                        ),
                    ],
                },
            ],
        },
        {
            id: "general",
            title: "General",
            description: "Community and update-channel preferences.",
            groups: [
                {
                    id: "clonecord-community",
                    title: "Community",
                    fields: [
                        field(
                            "discordServerJoin",
                            "Join support server",
                            "Join the Discord support server once.",
                            "Stored once per browser profile; after the first join Clonecord stops prompting."
                        ),
                        field(
                            "goToUpdateChannel",
                            "Updates channel",
                            "Navigate to the updates channel on start.",
                            "Only used when the support server has not already been joined."
                        ),
                    ],
                },
            ],
        },
        {
            id: "updates",
            title: "Updates",
            description: "Release feed status and the current changelog.",
            groups: [
                {
                    id: "clonecord-release-feed",
                    title: "Release feed",
                    description: "Checks GitHub Releases on demand and links to the changelog.",
                    render: () => <FoundationUpdatePanel targets={UPDATE_TARGETS} />,
                },
            ],
        },
        {
            id: "design",
            title: "Design",
            description: "Clone notification toast placement, style, colors and geometry.",
            groups: [
                {
                    id: "clonecord-design-preview",
                    title: "Live preview",
                    description: "Every clone toast bubble using the current Design values.",
                    render: DesignPreview,
                },
                {
                    id: "clonecord-toast-layout",
                    title: "Toast layout",
                    fields: [
                        field(
                            "toastPosition",
                            "Position",
                            "Where clone notification toasts appear.",
                            "Six anchor points are supported. The default is top right."
                        ),
                        field(
                            "toastStyle",
                            "Style",
                            "Toast appearance.",
                            "Glass uses a blur, solid uses a flat dark background and minimal removes the surface treatment."
                        ),
                    ],
                },
                {
                    id: "clonecord-toast-colors",
                    title: "Colors",
                    description: "Values accept hex or rgba() syntax used by the toast renderer.",
                    fields: [
                        field(
                            "toastBgColor",
                            "Background",
                            "Toast background color.",
                            "Applied to the toast container."
                        ),
                        field(
                            "toastAccentColor",
                            "Accent",
                            "Progress bar, spinner and highlight color.",
                            "Used for animated progress elements."
                        ),
                        field(
                            "toastTextColor",
                            "Text",
                            "Toast title text color.",
                            "Applies to the primary label."
                        ),
                        field(
                            "toastPercentColor",
                            "Percent",
                            "Progress percentage text color.",
                            "Applies only to the numeric progress label."
                        ),
                        field(
                            "toastBarBgColor",
                            "Bar track",
                            "Progress bar background color.",
                            "This is the unfilled portion of the progress bar."
                        ),
                        field(
                            "toastBorderColor",
                            "Border",
                            "Toast border color.",
                            "Use transparent to remove the border without changing layout."
                        ),
                    ],
                },
                {
                    id: "clonecord-toast-geometry",
                    title: "Geometry",
                    fields: [
                        field(
                            "toastBorderRadius",
                            "Corner radius",
                            "Toast corner roundness.",
                            "Measured in pixels."
                        ),
                        field(
                            "toastFontSize",
                            "Font size",
                            "Toast text size.",
                            "Measured in pixels."
                        ),
                        field(
                            "toastOpacity",
                            "Opacity",
                            "Toast background opacity.",
                            "Measured as a percentage."
                        ),
                        field(
                            "toastPadding",
                            "Padding",
                            "Toast inner spacing.",
                            "Measured in pixels."
                        ),
                        field(
                            "toastMaxWidth",
                            "Max width",
                            "Maximum toast width.",
                            "Measured in pixels.",
                            {
                                width: "full",
                            }
                        ),
                    ],
                },
            ],
        },
        {
            id: "notifications",
            title: "Notifications",
            description: "Auto-dismiss, timing and stacking behavior for clone toasts.",
            groups: [
                {
                    id: "clonecord-toast-behavior",
                    title: "Toast behavior",
                    fields: [
                        field(
                            "toastAutoDismiss",
                            "Auto-dismiss",
                            "Dismiss toasts automatically after the set delay.",
                            "Hovering a toast pauses its timer, as in the previous implementation."
                        ),
                        field(
                            "toastDismissDelayMs",
                            "Dismiss delay",
                            "How long toasts stay on screen.",
                            "Stored in milliseconds; this control shows seconds.",
                            { width: "full", valueScale: 1000, unit: "s" }
                        ),
                        field(
                            "toastMaxStack",
                            "Stack limit",
                            "Maximum number of visible toasts.",
                            "Older toasts are removed when this limit is reached."
                        ),
                        field(
                            "toastShowTimer",
                            "Show timer",
                            "Show elapsed time on the progress toast.",
                            "Only affects the progress toast during a clone operation."
                        ),
                    ],
                },
            ],
        },
        {
            id: "advanced",
            title: "Advanced",
            description: "Reset controls for the customization surface.",
            groups: [
                {
                    id: "clonecord-reset",
                    title: "Reset",
                    description:
                        "All reset actions ask for confirmation before changing saved values.",
                    actions: [
                        {
                            id: "reset-toast-customization",
                            label: "Reset toast customization",
                            description:
                                "Restore the original toast position, style, colors and geometry.",
                            info: "Also removes the legacy toastCustomColor key from older profiles. Notification timing is not changed.",
                            variant: "secondary",
                            run: () =>
                                resetSettingKeys(
                                    settings,
                                    definition.definition,
                                    TOAST_CUSTOMIZATION_KEYS
                                ),
                        },
                        {
                            id: "reset-all-settings",
                            label: "Reset all settings",
                            description: "Restore every Clonecord setting to its shipped default.",
                            info: "This changes only settings; it does not cancel an in-progress clone operation.",
                            variant: "dangerSecondary",
                            run: () => resetSettingKeys(settings, definition.definition, ALL_KEYS),
                        },
                    ],
                },
            ],
        },
        {
            id: "developer",
            title: "Developer",
            description: "Foundation bridge, diagnostics and log verbosity.",
            groups: [
                {
                    id: "clonecord-foundation",
                    title: "Foundation",
                    fields: [
                        field(
                            "foundationDiagnosticsEnabled",
                            "Diagnostics",
                            "Record and log foundation diagnostic events.",
                            "Records lifecycle and bridge events. This does not change clone behavior."
                        ),
                        field(
                            "foundationLogLevel",
                            "Log level",
                            "Minimum severity written to the Vencord log.",
                            "Warn is the shipped default. Debug is only useful together with diagnostic reporting.",
                            { width: "full" }
                        ),
                        field(
                            "foundationBridgeEnabled",
                            "Bridge",
                            "Allow registration with the optional plugin bridge.",
                            "Off by default. Clonecord works without any other plugin.",
                            { badge: "Off by default", width: "full" }
                        ),
                    ],
                },
                {
                    id: "clonecord-patch-status",
                    title: "Patch status",
                    description: "Load-time match status for every manifest patch.",
                    render: () => (
                        <FoundationPatchStatus
                            manifest={patchManifest}
                            pluginName="Clonecord"
                            version={PLUGIN_VERSION}
                        />
                    ),
                },
                {
                    id: "clonecord-log-viewer",
                    title: "Log viewer",
                    description: "Recent FoundationLogger entries with a level filter.",
                    render: FoundationLogViewer,
                },
            ],
        },
        {
            id: "about",
            title: "About",
            description: "Version, foundation and author information.",
            groups: [
                {
                    id: "clonecord-about",
                    title: "Clonecord",
                    render: ClonecordAbout,
                },
            ],
        },
    ],
};

export function ClonecordUnifiedSettings() {
    return <SettingsApp config={config} />;
}
