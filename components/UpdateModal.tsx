import { DataStore } from "@api/index";
import {
    openModal,
    ModalProps,
    ModalRoot,
    ModalHeader,
    ModalContent,
    ModalFooter,
} from "@utils/modal";
import { Button, ChannelStore, NavigationRouter, InviteActions } from "@webpack/common";
import { openInviteModal } from "@utils/discord";
import {
    GITHUB_RELEASE_URL,
    PLUGIN_VERSION,
    UPDATES_CHANNEL_ID,
    SUPPORT_INVITE_CODE,
} from "../constants";

const DISMISSED_KEY = "Clonecord-dismissed-version";

export function showUpdateModal(latestVersion: string, releaseNotes: string): void {
    if (!openModal) {
        console.error("[Clonecord] Missing openModal");
        return;
    }

    openModal((props: ModalProps) => (
        <UpdateModalInner props={props} latestVersion={latestVersion} releaseNotes={releaseNotes} />
    ));
}

export async function navigateToUpdatesChannel(): Promise<void> {
    // If we have a channel ID, try to navigate directly
    if (UPDATES_CHANNEL_ID) {
        const channel = ChannelStore.getChannel(UPDATES_CHANNEL_ID);
        if (channel?.guild_id) {
            NavigationRouter.transitionTo(`/channels/${channel.guild_id}/${UPDATES_CHANNEL_ID}`);
            return;
        }
    }

    // Try to resolve the invite code to find the guild
    if (SUPPORT_INVITE_CODE) {
        try {
            const { invite } = await InviteActions.resolveInvite(
                SUPPORT_INVITE_CODE,
                "Desktop Modal"
            );
            if (invite?.guild?.id) {
                const channelId = UPDATES_CHANNEL_ID || "";
                NavigationRouter.transitionTo(`/channels/${invite.guild.id}/${channelId}`);
                return;
            }
        } catch (e) {
            console.warn("[Clonecord] Failed to resolve invite:", e);
        }

        // Fallback: open invite modal
        openInviteModal(SUPPORT_INVITE_CODE);
    }
}

function UpdateModalInner({
    props,
    latestVersion,
    releaseNotes,
}: {
    props: ModalProps;
    latestVersion: string;
    releaseNotes: string;
}) {
    const handleDismiss = async () => {
        await DataStore.set(DISMISSED_KEY, latestVersion);
        props.onClose();
    };

    const handleUpdate = async () => {
        await DataStore.set(DISMISSED_KEY, latestVersion);
        window.open(GITHUB_RELEASE_URL, "_blank");
        props.onClose();
    };

    const handleDiscord = async () => {
        await DataStore.set(DISMISSED_KEY, latestVersion);
        await navigateToUpdatesChannel();
        props.onClose();
    };

    const whiteText = { color: "#FFFFFF", fontWeight: 600 };

    return (
        <ModalRoot {...props}>
            <ModalHeader>
                <span style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF" }}>
                    🚀 Update Available
                </span>
            </ModalHeader>
            <ModalContent>
                <div style={{ padding: "12px 0" }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 16,
                            backgroundColor: "var(--background-secondary)",
                            padding: "16px",
                            borderRadius: "8px",
                            gap: "24px",
                        }}
                    >
                        <div style={{ textAlign: "center" }}>
                            <div
                                style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    color: "#FFFFFF",
                                    opacity: 0.7,
                                    textTransform: "uppercase",
                                    marginBottom: "4px",
                                }}
                            >
                                Current
                            </div>
                            <div style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF" }}>
                                v{PLUGIN_VERSION}
                            </div>
                        </div>
                        <div
                            style={{
                                fontSize: "18px",
                                fontWeight: 700,
                                color: "#FFFFFF",
                                opacity: 0.5,
                            }}
                        >
                            →
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div
                                style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    color: "#FFFFFF",
                                    opacity: 0.7,
                                    textTransform: "uppercase",
                                    marginBottom: "4px",
                                }}
                            >
                                New
                            </div>
                            <div style={{ fontSize: "18px", fontWeight: 700, color: "#2dc770" }}>
                                v{latestVersion}
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            backgroundColor: "var(--background-secondary)",
                            borderRadius: 8,
                            padding: 12,
                            border: "1px solid var(--background-modifier-accent)",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                color: "#FFFFFF",
                                opacity: 0.7,
                                marginBottom: 8,
                                textTransform: "uppercase",
                            }}
                        >
                            What's New in v{latestVersion}
                        </div>
                        <div
                            style={{
                                whiteSpace: "pre-wrap",
                                color: "#FFFFFF",
                                lineHeight: "1.5",
                                fontSize: "14px",
                            }}
                        >
                            {releaseNotes}
                        </div>
                    </div>
                </div>
            </ModalContent>
            <ModalFooter>
                <div
                    style={{
                        display: "flex",
                        gap: "12px",
                        width: "100%",
                        alignItems: "center",
                    }}
                >
                    <Button
                        color={Button.Colors.PRIMARY}
                        onClick={handleDismiss}
                        style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)" }}
                    >
                        <span style={whiteText}>Not Now</span>
                    </Button>
                    <Button
                        color={Button.Colors.PRIMARY}
                        onClick={handleDiscord}
                        style={{ flex: 1, backgroundColor: "rgba(88,101,242,0.3)" }}
                    >
                        <span style={whiteText}>💬 Discord</span>
                    </Button>
                    <Button color={Button.Colors.GREEN} onClick={handleUpdate} style={{ flex: 1 }}>
                        <span style={whiteText}>Update Now</span>
                    </Button>
                </div>
            </ModalFooter>
        </ModalRoot>
    );
}
