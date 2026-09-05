export interface CloneGap {
    title: string;
    detail: string;
    howToFix: string;
}

export interface GapCheckInput {
    source: any;
    targetTier: number;
    sourceTier: number;
    sourceStickerCount?: number;
    sourceSoundboardCount?: number;
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
    const { source, targetTier, sourceTier, sourceStickerCount, sourceSoundboardCount, options, stats } = input;
    if (!source) return gaps;

    if (source.vanity_url_code) {
        gaps.push({
            title: "Vanity URL",
            detail: `discord.gg/${source.vanity_url_code} cannot be transferred.`,
            howToFix: "Server Settings → Vanity URL: re-apply manually (Boost Level 3 required).",
        });
    }

    if (sourceTier > targetTier) {
        const lost: string[] = [];
        if (sourceTier >= 1 && targetTier < 1)
            lost.push("sticker slots, 128kbps voice, invite background");
        if (sourceTier >= 2 && targetTier < 2)
            lost.push("role icons, 256kbps voice");
        if (sourceTier >= 3 && targetTier < 3)
            lost.push("384kbps voice, animated banner");
        gaps.push({
            title: "Boost Level",
            detail: `Source tier ${sourceTier} → target tier ${targetTier}: ${lost.join(", ")}.`,
            howToFix: "Boost target server to restore features.",
        });
    }

    if (!options.cloneOnboarding && source.description) {
        gaps.push({
            title: "Server Description",
            detail: "Onboarding was disabled — description not copied.",
            howToFix: "Copy via Server Settings → Overview manually.",
        });
    }

    if (options.cloneStickers && sourceStickerCount && sourceStickerCount > 0 && stats.stickersCloned === 0) {
        gaps.push({
            title: "Stickers",
            detail: "No stickers could be cloned — slots may be full.",
            howToFix: "Server Settings → Stickers: free up slots and retry.",
        });
    }

    if (options.cloneSoundboard && sourceSoundboardCount && sourceSoundboardCount > 0 && stats.soundboardCloned === 0) {
        gaps.push({
            title: "Soundboard",
            detail: "No sounds could be cloned — slots may be full.",
            howToFix: "Server Settings → Soundboard: free up slots and retry.",
        });
    }

    if (!options.cloneChannels) {
        gaps.push({
            title: "Channels",
            detail: "Channel cloning was disabled.",
            howToFix: "Re-run with channels enabled.",
        });
    }

    if (!options.cloneRoles) {
        gaps.push({
            title: "Roles",
            detail: "Role cloning was disabled.",
            howToFix: "Re-run with roles enabled.",
        });
    }

    return gaps;
}