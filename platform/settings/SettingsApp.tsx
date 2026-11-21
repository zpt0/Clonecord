import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { React } from "@webpack/common";

import "./settings.css";

import { Badge, cx, SectionHeader, SettingsGroupCard } from "./components";
import { categorySettingCount, validateUnifiedSettingsConfig } from "./model";
import type { UnifiedSettingsConfig } from "./types";
import { createScopedLogger } from "../../foundation/core/logging";
import {
    getUpdateResults,
    hasAvailableUpdate,
    runUpdateChecks,
    subscribeToUpdates,
} from "../../foundation/core/updates";
import { FoundationPluginActions } from "../../foundation/ui/components";

const log = createScopedLogger("platform/settings/SettingsApp");

export function SettingsApp({ config }: { readonly config: UnifiedSettingsConfig }) {
    const [activeId, setActiveId] = React.useState(config.categories[0]?.id);
    const [updateResults, setUpdateResults] = React.useState(getUpdateResults());

    React.useEffect(() => subscribeToUpdates(() => setUpdateResults(getUpdateResults())), []);
    React.useEffect(() => {
        if (config.updates?.length) void runUpdateChecks(config.updates);
    }, [config]);

    const validation = React.useMemo(() => validateUnifiedSettingsConfig(config), [config]);
    if (validation.length > 0) log.warn("configuration issues:", validation);

    const active =
        config.categories.find((category) => category.id === activeId) ?? config.categories[0];

    if (!active) return null;

    const hasWhatsNew = config.updates ? hasAvailableUpdate(updateResults, config.updates) : false;

    return (
        <div className={cx("root")} data-vpf-settings-root="true" data-plugin={config.pluginName}>
            <div className={cx("header")}>
                <div className={cx("header-copy")}>
                    <div className={cx("header-title-row")}>
                        <Heading tag="h3">{config.pluginName}</Heading>
                        <Badge tone="accent">v{config.version}</Badge>
                    </div>
                    <Paragraph className={cx("header-tagline")}>{config.tagline}</Paragraph>
                </div>
                {config.sourceUrl ? (
                    <FoundationPluginActions
                        pluginName={config.pluginName}
                        sourceUrl={config.sourceUrl}
                    />
                ) : null}
            </div>

            <div className={cx("body")}>
                <nav className={cx("nav")} aria-label={`${config.pluginName} settings categories`}>
                    {config.categories.map((category) => (
                        <button
                            type="button"
                            key={category.id}
                            className={cx(
                                "nav-item",
                                category.id === active.id && "nav-item-active"
                            )}
                            aria-current={category.id === active.id ? "page" : undefined}
                            onClick={() => setActiveId(category.id)}
                        >
                            <span>{category.title}</span>
                            <Badge
                                tone={
                                    category.id === "updates" && hasWhatsNew
                                        ? "success"
                                        : category.id === active.id
                                          ? "accent"
                                          : "neutral"
                                }
                            >
                                {category.id === "updates" && hasWhatsNew
                                    ? "What's new"
                                    : categorySettingCount(category)}
                            </Badge>
                        </button>
                    ))}
                </nav>

                <main className={cx("content")}>
                    <SectionHeader title={active.title} description={active.description} />
                    <div className={cx("groups")}>
                        {active.groups.map((group) => (
                            <SettingsGroupCard
                                key={group.id}
                                group={group}
                                settings={config.settings}
                            />
                        ))}
                    </div>
                </main>
            </div>

            <div className={cx("footer")}>
                <span>{config.license}</span>
                <span>Shared Vencord plugin settings system</span>
            </div>
        </div>
    );
}
