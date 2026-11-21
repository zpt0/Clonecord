import { useSettings } from "@api/Settings";
import { Card } from "@components/Card";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { openContributorModal } from "@components/settings/tabs";
import { FavoriteButton, GithubButton } from "@components/settings/tabs/plugins/PluginModalButtons";
import { Text } from "@components/Text";
import { search } from "@webpack";
import { React, showToast, UserStore } from "@webpack/common";
import type { ComponentType, ReactNode } from "react";

import type { BridgeCapability } from "../bridge/contract";
import {
    clearLogHistory,
    getLogHistory,
    subscribeToLogHistory,
    type LogEntry,
    type LogLevelName,
} from "../core/logging";
import type { PatchManifest } from "../core/patches";
import { validatePatchManifest } from "../core/patches";
import {
    getUpdateResults,
    runUpdateChecks,
    subscribeToUpdates,
    updateStatusLabel,
    type UpdateResult,
    type UpdateTarget,
} from "../core/updates";
import type { FoundationSettingsDefinition, SettingSection } from "../settings/types";
import { SETTING_SECTIONS } from "../settings/types";
import { foundationClass } from "../utils";

export interface FoundationCardProps {
    readonly title: string;
    readonly variant?: "normal" | "warning" | "danger" | "info" | "success";
    readonly className?: string;
    readonly children?: ReactNode;
}

export function FoundationCard({
    title,
    variant = "normal",
    className,
    children,
}: FoundationCardProps) {
    return (
        <Card variant={variant} className={foundationClass("vpf-card", className)}>
            <Heading tag="h4" className="vpf-card-title">
                {title}
            </Heading>
            {children === undefined ? null : <div className="vpf-card-body">{children}</div>}
        </Card>
    );
}

export interface FoundationStatusItem {
    readonly label: string;
    readonly value: string;
    readonly tone?: "neutral" | "ok" | "warn" | "error";
}

export interface FoundationStatusListProps {
    readonly items: readonly FoundationStatusItem[];
}

export function FoundationStatusList({ items }: FoundationStatusListProps) {
    return (
        <div className="vpf-status-list">
            {items.map((item) => (
                <div className="vpf-status-row" key={`${item.label}:${item.value}`}>
                    <Text tag="span" className="vpf-status-label">
                        {item.label}
                    </Text>
                    <Text
                        tag="span"
                        className={foundationClass(
                            "vpf-status-value",
                            `vpf-tone-${item.tone ?? "neutral"}`
                        )}
                    >
                        {item.value}
                    </Text>
                </div>
            ))}
        </div>
    );
}

export interface FoundationSettingsOutlineProps {
    readonly definition: FoundationSettingsDefinition;
    readonly title?: string;
}

function groupBySection(
    definition: FoundationSettingsDefinition
): Readonly<Record<SettingSection, readonly string[]>> {
    const grouped = Object.fromEntries(
        SETTING_SECTIONS.map((section) => [section, [] as string[]])
    ) as Record<SettingSection, string[]>;

    for (const key of Object.keys(definition)) {
        const meta = definition[key]?.foundation;
        if (meta) grouped[meta.section].push(key);
    }

    for (const section of SETTING_SECTIONS) grouped[section].sort();
    return grouped;
}

export function FoundationSettingsOutline({
    definition,
    title = "Settings map",
}: FoundationSettingsOutlineProps) {
    const grouped = groupBySection(definition);
    return (
        <div className="vpf-settings-outline">
            <Heading tag="h5" className="vpf-outline-title">
                {title}
            </Heading>
            {SETTING_SECTIONS.map((section) => (
                <div className="vpf-outline-section" key={section}>
                    <Text tag="span" className="vpf-outline-section-name">
                        {section}
                    </Text>
                    <Text tag="span" className="vpf-outline-section-keys">
                        {grouped[section].length === 0 ? "None" : grouped[section].join(", ")}
                    </Text>
                </div>
            ))}
        </div>
    );
}

export interface FoundationAboutPanelProps {
    readonly pluginName: string;
    readonly version?: string;
    readonly capabilities?: readonly BridgeCapability[];
    readonly lifecycleState?: string;
    readonly diagnosticSummary?: string;
    readonly definition?: FoundationSettingsDefinition;
}

export function FoundationAboutPanel({
    pluginName,
    version = "unspecified",
    capabilities = [],
    lifecycleState = "idle",
    diagnosticSummary = "no diagnostics recorded",
    definition,
}: FoundationAboutPanelProps) {
    const statuses: FoundationStatusItem[] = [
        { label: "Plugin", value: pluginName },
        { label: "Foundation version", value: version },
        {
            label: "Lifecycle",
            value: lifecycleState,
            tone: lifecycleState === "started" ? "ok" : "neutral",
        },
        {
            label: "Bridge capabilities",
            value: capabilities.length === 0 ? "disabled" : capabilities.join(", "),
        },
        { label: "Diagnostics", value: diagnosticSummary },
    ];

    return (
        <div className="vpf-about">
            <FoundationCard title="Plugin foundation">
                <FoundationStatusList items={statuses} />
                {definition === undefined ? null : (
                    <FoundationSettingsOutline definition={definition} />
                )}
                <Paragraph className="vpf-about-note">
                    The bridge is optional. This plugin does not require any other plugin to run.
                </Paragraph>
            </FoundationCard>
        </div>
    );
}

export function createFoundationAboutComponent(
    props: FoundationAboutPanelProps
): ComponentType<Record<string, never>> {
    return function FoundationAboutComponent() {
        return <FoundationAboutPanel {...props} />;
    };
}

export interface FoundationPluginActionsProps {
    readonly pluginName: string;
    readonly sourceUrl: string;
}

/**
 * Reuses Vencord's own PluginModal buttons so our settings header gets the same
 * favorite star and "View source code" link as built-in plugins.
 */
export function FoundationPluginActions({ pluginName, sourceUrl }: FoundationPluginActionsProps) {
    const plugins = (useSettings() as { plugins?: Record<string, { isFavorite?: boolean }> })
        .plugins;
    const pluginSettings = plugins?.[pluginName];
    const isFavorite = pluginSettings?.isFavorite ?? false;

    return (
        <div className="vc-settings-modal-links vpf-plugin-actions">
            <FavoriteButton
                isFavorite={isFavorite}
                onClick={() => {
                    const next = !isFavorite;
                    if (pluginSettings) pluginSettings.isFavorite = next;
                    showToast({
                        text: next ? "Pinned to favorites" : "Removed from favorites",
                        variant: "success",
                    });
                }}
            />
            <GithubButton text="View source code" href={sourceUrl} />
        </div>
    );
}

async function copyText(text: string): Promise<boolean> {
    try {
        const clipboard = globalThis.navigator?.clipboard;
        if (clipboard?.writeText) {
            await clipboard.writeText(text);
            return true;
        }
    } catch {
        // Clipboard access can be blocked by the host; the toast still reports it.
    }
    return false;
}

function formatLogValue(value: unknown): string {
    if (typeof value === "string") return value;
    try {
        return (
            JSON.stringify(value, (_key, item) => {
                if (typeof item === "bigint") return `${item}n`;
                if (item instanceof Error) return { name: item.name, message: item.message };
                return item;
            }) ?? String(value)
        );
    } catch {
        return String(value);
    }
}

function formatLogTime(entry: LogEntry): string {
    return new Date(entry.timestamp).toLocaleTimeString();
}

type LogFilterName = "all" | Exclude<LogLevelName, "none">;

const LOG_FILTERS: readonly LogFilterName[] = ["all", "debug", "info", "warn", "error"];

/** Shows the emitted FoundationLogger history with a level filter. */
export function FoundationLogViewer({ limit = 50 }: { readonly limit?: number }) {
    const [filter, setFilter] = React.useState<LogFilterName>("all");
    const [, setVersion] = React.useState(0);

    React.useEffect(() => subscribeToLogHistory(() => setVersion((value) => value + 1)), []);

    const entries = getLogHistory()
        .filter((entry) => filter === "all" || entry.level === filter)
        .slice(-Math.max(1, limit))
        .reverse();

    return (
        <FoundationCard title="Log viewer" className="vpf-log-viewer">
            <div className="vpf-log-toolbar">
                <div className="vpf-log-filters">
                    {LOG_FILTERS.map((name) => (
                        <button
                            type="button"
                            key={name}
                            className={foundationClass(
                                "vpf-log-filter",
                                filter === name && "vpf-log-filter-active"
                            )}
                            aria-pressed={filter === name}
                            onClick={() => setFilter(name)}
                        >
                            {name}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className="vpf-log-clear"
                    onClick={() => {
                        clearLogHistory();
                        setVersion((value) => value + 1);
                    }}
                >
                    Clear
                </button>
            </div>
            <div className="vpf-log-list">
                {entries.length === 0 ? (
                    <Text tag="span" className="vpf-log-empty">
                        No log entries for this filter yet.
                    </Text>
                ) : (
                    entries.map((entry, index) => (
                        <div
                            className="vpf-log-row"
                            key={`${entry.timestamp}-${entry.scope}-${index}`}
                        >
                            <span
                                className={foundationClass(
                                    "vpf-log-level",
                                    `vpf-log-level-${entry.level}`
                                )}
                            >
                                {entry.level}
                            </span>
                            <span className="vpf-log-time">{formatLogTime(entry)}</span>
                            <span className="vpf-log-scope">{entry.scope}</span>
                            <span className="vpf-log-message">{entry.message}</span>
                            {entry.suppressed ? (
                                <span className="vpf-log-folded">+{entry.suppressed} folded</span>
                            ) : null}
                            {entry.details.length > 0 ? (
                                <span className="vpf-log-details">
                                    {entry.details.map(formatLogValue).join(" ")}
                                </span>
                            ) : null}
                        </div>
                    ))
                )}
            </div>
        </FoundationCard>
    );
}

export interface PatchStatusEntry {
    readonly id: string;
    readonly description: string;
    readonly module: string;
    readonly status: "active" | "failed";
    readonly version: string;
    readonly reason: string;
    readonly debug: Record<string, unknown>;
}

type SearchFn = (...code: Array<string | RegExp>) => Record<number, unknown>;

/** Derives a human-readable status from the manifest and Vencord's loaded webpack modules. */
export function getPatchStatusEntries(
    manifest: PatchManifest,
    pluginName: string,
    version: string,
    searchFn: SearchFn = search
): readonly PatchStatusEntry[] {
    const issues = validatePatchManifest(manifest.entries);
    const issuesById = new Map<string, string[]>();

    issues.forEach((issue) => {
        const match = /entries\[(\d+)\]/.exec(issue);
        const entry = match ? manifest.entries[Number(match[1])] : undefined;
        if (!entry) return;
        issuesById.set(entry.id, [...(issuesById.get(entry.id) ?? []), issue]);
    });

    return manifest.entries.map((entry) => {
        const patch = entry.patch;
        let matchCount = 0;
        let lookupError: string | undefined;

        try {
            matchCount = Object.keys(searchFn(patch.find)).length;
        } catch (error) {
            lookupError = error instanceof Error ? error.message : String(error);
        }

        const min = entry.expectations?.find?.min ?? 1;
        const max = entry.expectations?.find?.max;
        const ownIssues = issuesById.get(entry.id) ?? [];
        let status: PatchStatusEntry["status"] = "active";
        let reason = `Matched ${matchCount} loaded webpack module${matchCount === 1 ? "" : "s"}`;

        if (ownIssues.length > 0) {
            status = "failed";
            reason = ownIssues.join("; ");
        } else if (lookupError) {
            status = "failed";
            reason = `Module lookup failed: ${lookupError}`;
        } else if (matchCount < min || (max !== undefined && matchCount > max)) {
            status = "failed";
            reason = `Expected ${min}-${max ?? "more"} matches, found ${matchCount}`;
        }

        const replacements = Array.isArray(patch.replacement)
            ? patch.replacement
            : [patch.replacement];
        const buildRange =
            patch.fromBuild !== undefined || patch.toBuild !== undefined
                ? ` · build ${patch.fromBuild ?? "any"}–${patch.toBuild ?? "any"}`
                : "";

        return {
            id: entry.id,
            description: entry.description,
            module: entry.module,
            status,
            version: `v${version}${buildRange}`,
            reason,
            debug: {
                pluginName,
                version,
                patchId: entry.id,
                module: entry.module,
                status,
                reason,
                matchCount,
                expected: entry.expectations?.find ?? { min },
                find: String(patch.find),
                replacements: replacements.map((replacement) => ({
                    match: String(replacement?.match),
                    noWarn: replacement?.noWarn ?? false,
                })),
                buildRange: {
                    from: patch.fromBuild,
                    to: patch.toBuild,
                },
                checkedAt: Date.now(),
            },
        };
    });
}

export interface FoundationPatchStatusProps {
    readonly manifest: PatchManifest;
    readonly pluginName: string;
    readonly version: string;
}

/** One status card per manifest patch, with copyable debug information. */
export function FoundationPatchStatus({
    manifest,
    pluginName,
    version,
}: FoundationPatchStatusProps) {
    const entries = getPatchStatusEntries(manifest, pluginName, version);

    return (
        <div className="vpf-patch-status">
            {entries.map((entry) => (
                <FoundationCard
                    key={entry.id}
                    title={entry.id}
                    className="vpf-patch-card"
                    variant={entry.status === "active" ? "success" : "danger"}
                >
                    <div className="vpf-patch-meta">
                        <span
                            className={foundationClass(
                                "vpf-patch-state",
                                entry.status === "active" ? "vpf-tone-ok" : "vpf-tone-error"
                            )}
                        >
                            {entry.status === "active" ? "Active" : "Failed"}
                        </span>
                        <span className="vpf-patch-version">{entry.version}</span>
                    </div>
                    <Paragraph>{entry.description}</Paragraph>
                    <div className="vpf-patch-row">
                        <span>Module</span>
                        <span>{entry.module}</span>
                    </div>
                    <div className="vpf-patch-row">
                        <span>Reason</span>
                        <span>{entry.reason}</span>
                    </div>
                    <button
                        type="button"
                        className="vpf-copy-button"
                        onClick={() => {
                            void copyText(JSON.stringify(entry.debug, null, 2)).then((copied) => {
                                showToast({
                                    text: copied
                                        ? "Patch debug info copied"
                                        : "Could not copy patch debug info",
                                    variant: copied ? "success" : "critical",
                                });
                            });
                        }}
                    >
                        Copy debug info
                    </button>
                </FoundationCard>
            ))}
        </div>
    );
}

function updateTone(status: UpdateResult["status"]): string {
    switch (status) {
        case "available":
            return "vpf-tone-ok";
        case "failed":
            return "vpf-tone-error";
        case "checking":
            return "vpf-tone-warn";
        default:
            return "vpf-tone-neutral";
    }
}

export interface FoundationUpdatePanelProps {
    readonly targets: readonly UpdateTarget[];
}

/** Shared release check and changelog links for every zpt0 plugin. */
export function FoundationUpdatePanel({ targets }: FoundationUpdatePanelProps) {
    const [results, setResults] = React.useState(getUpdateResults());

    React.useEffect(() => subscribeToUpdates(() => setResults(getUpdateResults())), []);

    const isChecking = targets.some((target) => results[target.pluginName]?.status === "checking");

    return (
        <FoundationCard title="Updates & changelog" className="vpf-update-panel">
            <div className="vpf-update-toolbar">
                <button
                    type="button"
                    className="vpf-check-updates"
                    disabled={isChecking}
                    onClick={() => {
                        void runUpdateChecks(targets);
                    }}
                >
                    {isChecking ? "Checking..." : "Check all for updates"}
                </button>
                <Text tag="span" className="vpf-update-hint">
                    Release feeds are checked on demand. Nothing opens or installs automatically.
                </Text>
            </div>
            <div className="vpf-update-list">
                {targets.map((target) => {
                    const result: UpdateResult = results[target.pluginName] ?? {
                        pluginName: target.pluginName,
                        status: "idle",
                    };

                    return (
                        <div className="vpf-update-row" key={target.pluginName}>
                            <div className="vpf-update-heading">
                                <strong>{target.pluginName}</strong>
                                <span className="vpf-update-version">v{target.version}</span>
                                {result.status === "available" ? (
                                    <span className="vpf-update-badge">What's new</span>
                                ) : null}
                            </div>
                            <div className="vpf-update-row-line">
                                <span>Status</span>
                                <span className={updateTone(result.status)}>
                                    {updateStatusLabel(result.status)}
                                </span>
                            </div>
                            {result.latestVersion ? (
                                <div className="vpf-update-row-line">
                                    <span>Latest</span>
                                    <span>v{result.latestVersion}</span>
                                </div>
                            ) : null}
                            {result.reason ? (
                                <div className="vpf-update-row-line">
                                    <span>Detail</span>
                                    <span>{result.reason}</span>
                                </div>
                            ) : null}
                            <div className="vpf-update-links">
                                {target.releasesUrl ? (
                                    <a
                                        href={target.releasesUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Release notes
                                    </a>
                                ) : null}
                                {target.changelogUrl ? (
                                    <a
                                        href={target.changelogUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Changelog
                                    </a>
                                ) : null}
                            </div>
                            {result.releaseNotes ? (
                                <Paragraph className="vpf-update-notes">
                                    {result.releaseNotes.length > 400
                                        ? `${result.releaseNotes.slice(0, 400)}...`
                                        : result.releaseNotes}
                                </Paragraph>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </FoundationCard>
    );
}

export interface FoundationAuthor {
    readonly name: string;
    readonly id?: bigint | string;
}

export interface FoundationAuthorPanelProps {
    readonly authors: readonly FoundationAuthor[];
    readonly title?: string;
}

interface AuthorUser {
    readonly id?: string;
    readonly username?: string;
    readonly bot?: boolean;
    getAvatarURL(guildId?: string, size?: number, animated?: boolean): string;
}

const DEFAULT_AUTHOR_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

/**
 * Resolves a display user for the author. ContributorModal looks up plugins by
 * `author.name === user.username` (unless the id is a known Vencord dev), so the
 * manifest name is used verbatim. The cached Discord user supplies only the avatar.
 */
function resolveAuthorUser(author: FoundationAuthor): AuthorUser {
    const id = author.id === undefined ? undefined : String(author.id);
    const cached = id === undefined ? undefined : UserStore.getUser(id);
    const current = UserStore.getCurrentUser();
    const real =
        cached ?? (current && id !== undefined && String(current.id) === id ? current : undefined);

    return {
        id: id ?? "0",
        username: author.name,
        bot: true,
        getAvatarURL: (guildId, size, animated) =>
            real?.getAvatarURL?.(guildId, size, animated) ?? DEFAULT_AUTHOR_AVATAR,
    };
}

function AuthorAvatar({
    author,
    user,
    size = 40,
}: {
    author: FoundationAuthor;
    user: AuthorUser;
    size?: number;
}) {
    return (
        <img
            className="vpf-author-avatar"
            src={user.getAvatarURL(undefined, size, true)}
            alt={author.name}
            title={author.name}
            width={size}
            height={size}
        />
    );
}

export function FoundationAuthorPanel({ authors, title = "Author" }: FoundationAuthorPanelProps) {
    const author = authors[0];
    if (author === undefined) return null;

    const user = resolveAuthorUser(author);

    return (
        <FoundationCard title={title} className="vpf-author-card">
            <button
                type="button"
                className="vpf-author-row"
                title={`Show all plugins by ${author.name}`}
                onClick={() => openContributorModal(user)}
            >
                <AuthorAvatar author={author} user={user} />
                <span className="vpf-author-info">
                    <Text tag="span" className="vpf-author-name">
                        {user.username ?? author.name}
                    </Text>
                    <Text tag="span" className="vpf-author-hint">
                        Click to see all plugins by this author
                    </Text>
                </span>
            </button>
            {authors.length > 1 ? (
                <Text tag="span" className="vpf-author-extra">
                    {`Also by ${authors
                        .slice(1)
                        .map((entry) => entry.name)
                        .join(", ")}`}
                </Text>
            ) : null}
        </FoundationCard>
    );
}
