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
import { parseReleaseBlocks, parseReleaseInline, type ReleaseInlineNode } from "../utils/helpers";

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

function renderReleaseInline(nodes: ReleaseInlineNode[], keyPrefix: string) {
    return nodes.map((node, index) => {
        const key = `${keyPrefix}-${index}`;
        switch (node.kind) {
            case "bold":
                return <strong key={key}>{renderReleaseInline(node.children, key)}</strong>;
            case "italic":
                return <em key={key}>{renderReleaseInline(node.children, key)}</em>;
            case "strike":
                return <s key={key}>{renderReleaseInline(node.children, key)}</s>;
            case "code":
                return (
                    <code
                        key={key}
                        style={{
                            fontFamily: "Consolas, monospace",
                            backgroundColor: "var(--background-tertiary)",
                            borderRadius: 3,
                            padding: "0 4px",
                        }}
                    >
                        {node.text}
                    </code>
                );
            case "link":
                return (
                    <a
                        key={key}
                        href={node.url}
                        style={{ color: "var(--text-link, #00a8fc)", cursor: "pointer" }}
                        onClick={(e) => {
                            e.preventDefault();
                            window.open(node.url, "_blank");
                        }}
                    >
                        {node.text}
                    </a>
                );
            default:
                return <span key={key}>{node.text}</span>;
        }
    });
}

function renderReleaseNotes(notes: string) {
    const blocks = parseReleaseBlocks(notes);
    if (blocks.length === 0) return "No release notes available.";
    return blocks.map((block, index) => {
        switch (block.kind) {
            case "heading":
                return (
                    <div
                        key={index}
                        style={{ fontWeight: 700, fontSize: "15px", margin: "4px 0 6px" }}
                    >
                        {renderReleaseInline(parseReleaseInline(block.text), `h${index}`)}
                    </div>
                );
            case "list":
                return (
                    <div key={index} style={{ margin: "0 0 8px" }}>
                        {block.items.map((item, itemIndex) => (
                            <div key={itemIndex} style={{ display: "flex", gap: 6 }}>
                                <span>{block.ordered ? `${itemIndex + 1}.` : "•"}</span>
                                <span>
                                    {renderReleaseInline(
                                        parseReleaseInline(item),
                                        `li${index}-${itemIndex}`
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                );
            case "code":
                return (
                    <pre
                        key={index}
                        style={{
                            backgroundColor: "var(--background-tertiary)",
                            borderRadius: 4,
                            padding: 8,
                            overflowX: "auto",
                            whiteSpace: "pre-wrap",
                        }}
                    >
                        {block.text}
                    </pre>
                );
            case "quote":
                return (
                    <div
                        key={index}
                        style={{
                            borderLeft: "2px solid var(--background-modifier-accent)",
                            paddingLeft: 8,
                            opacity: 0.9,
                            margin: "0 0 8px",
                        }}
                    >
                        {block.lines.map((line, lineIndex) => (
                            <div key={lineIndex}>
                                {renderReleaseInline(
                                    parseReleaseInline(line),
                                    `q${index}-${lineIndex}`
                                )}
                            </div>
                        ))}
                    </div>
                );
            default:
                return (
                    <div key={index} style={{ margin: "0 0 8px" }}>
                        {block.lines.map((line, lineIndex) => (
                            <span key={lineIndex}>
                                {lineIndex > 0 && <br />}
                                {renderReleaseInline(
                                    parseReleaseInline(line),
                                    `p${index}-${lineIndex}`
                                )}
                            </span>
                        ))}
                    </div>
                );
        }
    });
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
                                color: "#FFFFFF",
                                lineHeight: "1.5",
                                fontSize: "14px",
                                whiteSpace: "pre-wrap",
                                overflowWrap: "break-word",
                            }}
                        >
                            {renderReleaseNotes(releaseNotes)}
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
