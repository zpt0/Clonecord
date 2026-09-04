export interface CloneGap {
    title: string;
    detail: string;
    howToFix: string;
}

export interface GapCheckInput {
    source: any;
    targetTier: number;
    sourceTier: number;
    options: {
        cloneChannels: boolean;
        cloneRoles: boolean;
        cloneOnboarding: boolean;
        cloneStickers?: boolean;
        cloneSoundboard?: boolean;
    };
    stats: {
        stickersCloned: number;
        soundboardCloned: number;
        onboardingCloned: boolean;
    };
}

export function collectCloneGaps(input: GapCheckInput): CloneGap[] {
    const gaps: CloneGap[] = [];
    const { source, targetTier, sourceTier, options, stats } = input;
    if (!source) return gaps;

    if (source.vanity_url_code) {
        gaps.push({
            title: "Vanity URL not transferred",
            detail: `Source server uses discord.gg/${source.vanity_url_code}. Vanity URLs cannot be moved via API.`,
            howToFix:
                "Server Settings → Vanity URL: re-apply the URL manually (requires Boost Level 3).",
        });
    }

    if (sourceTier > targetTier) {
        const lost: string[] = [];
        if (sourceTier >= 1 && targetTier < 1)
            lost.push("sticker slots, 128kbps voice, custom invite background");
        if (sourceTier >= 2 && targetTier < 2)
            lost.push("role icons, 256kbps voice, more emoji/sticker slots");
        if (sourceTier >= 3 && targetTier < 3)
            lost.push("384kbps voice, vanity URL, animated banner");
        gaps.push({
            title: `Boost level differs (source ${sourceTier} → target ${targetTier})`,
            detail: `Some cloned content may be downgraded: ${lost.join("; ")}.`,
            howToFix: "Boost the target server to the same level to restore full quality.",
        });
    }

    const features: string[] = source.features || [];
    const notApplied = features.filter((f) => !["COMMUNITY", "INVITES_DISABLED"].includes(f));
    if (notApplied.length > 0) {
        gaps.push({
            title: "Server features not applied",
            detail: `These source features were skipped: ${notApplied.join(", ")}.`,
            howToFix:
                "Server Settings → enable Community, Discovery or other features manually as needed.",
        });
    }

    if (source.description && !options.cloneOnboarding) {
        gaps.push({
            title: "Server description not cloned",
            detail: "The source server has a description, but onboarding cloning was disabled.",
            howToFix:
                "Re-run with onboarding enabled, or copy the description via Server Settings → Overview.",
        });
    }

    if (options.cloneStickers && stats.stickersCloned === 0) {
        gaps.push({
            title: "No stickers cloned",
            detail: "Sticker slots may be full on the target server or the source has none accessible.",
            howToFix: "Check Server Settings → Stickers for free slots and retry.",
        });
    }

    if (options.cloneSoundboard && stats.soundboardCloned === 0) {
        gaps.push({
            title: "No soundboard sounds cloned",
            detail: "Soundboard slots may be full on the target server or the source has none accessible.",
            howToFix: "Check Server Settings → Soundboard for free slots and retry.",
        });
    }

    if (!options.cloneChannels) {
        gaps.push({
            title: "Channels skipped by choice",
            detail: "Channel cloning was disabled for this run.",
            howToFix: "Re-run with channels enabled if you need them.",
        });
    }

    if (!options.cloneRoles) {
        gaps.push({
            title: "Roles skipped by choice",
            detail: "Role cloning was disabled for this run.",
            howToFix: "Re-run with roles enabled if you need them.",
        });
    }

    const unmapped = ["webhooks", "integrations", "automod", "scheduled events", "threads"];
    gaps.push({
        title: "Never cloned via API",
        detail: `These are not transferred by any clone run: ${unmapped.join(", ")}.`,
        howToFix:
            "Recreate webhooks (Server Settings → Integrations), re-add bots, and re-configure AutoMod manually.",
    });

    return gaps;
}
