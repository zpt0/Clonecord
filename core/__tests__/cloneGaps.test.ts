import { describe, it, expect } from "vitest";
import { collectCloneGaps, GapCheckInput } from "../cloneGaps";

function baseInput(overrides: Partial<GapCheckInput> = {}): GapCheckInput {
    return {
        source: { features: ["COMMUNITY"], premium_tier: 0 },
        targetTier: 0,
        sourceTier: 0,
        options: { cloneChannels: true, cloneRoles: true, cloneOnboarding: true },
        stats: { stickersCloned: 1, soundboardCloned: 1, onboardingCloned: true },
        ...overrides,
    };
}

describe("collectCloneGaps", () => {
    it("returns no gaps for a clean identical run", () => {
        const gaps = collectCloneGaps(baseInput());
        expect(gaps).toHaveLength(0);
    });

    it("flags a vanity URL on the source", () => {
        const gaps = collectCloneGaps(
            baseInput({ source: { features: [], premium_tier: 0, vanity_url_code: "myserver" } })
        );
        const vanity = gaps.find((g) => g.title.includes("Vanity"));
        expect(vanity).toBeDefined();
        expect(vanity!.detail).toContain("myserver");
        expect(vanity!.howToFix).toContain("Vanity URL");
    });

    it("flags boost tier downgrades", () => {
        const gaps = collectCloneGaps(baseInput({ sourceTier: 3, targetTier: 0 }));
        const boost = gaps.find((g) => g.title.includes("Boost Level"));
        expect(boost).toBeDefined();
        expect(boost!.detail).toContain("384kbps");
    });

    it("flags a skipped server description when onboarding is disabled", () => {
        const gaps = collectCloneGaps(
            baseInput({
                source: { features: [], premium_tier: 0, description: "Hello" },
                options: { cloneChannels: true, cloneRoles: true, cloneOnboarding: false },
            })
        );
        const description = gaps.find((g) => g.title.includes("Description"));
        expect(description).toBeDefined();
        expect(description!.detail).toContain("description not copied");
    });

    it("flags empty sticker/soundboard results when enabled", () => {
        const gaps = collectCloneGaps(
            baseInput({
                sourceStickerCount: 5,
                sourceSoundboardCount: 3,
                options: {
                    cloneChannels: true,
                    cloneRoles: true,
                    cloneOnboarding: true,
                    cloneStickers: true,
                    cloneSoundboard: true,
                },
                stats: { stickersCloned: 0, soundboardCloned: 0, onboardingCloned: true },
            })
        );
        expect(gaps.some((g) => g.title.includes("Stickers"))).toBe(true);
        expect(gaps.some((g) => g.title.includes("Soundboard"))).toBe(true);
    });

    it("flags nothing without source counts even when nothing was cloned", () => {
        const gaps = collectCloneGaps(
            baseInput({
                options: {
                    cloneChannels: true,
                    cloneRoles: true,
                    cloneOnboarding: true,
                    cloneStickers: true,
                    cloneSoundboard: true,
                },
                stats: { stickersCloned: 0, soundboardCloned: 0, onboardingCloned: true },
            })
        );
        expect(gaps.some((g) => g.title.includes("Stickers"))).toBe(false);
        expect(gaps.some((g) => g.title.includes("Soundboard"))).toBe(false);
    });

    it("returns no gaps without source data", () => {
        const gaps = collectCloneGaps(baseInput({ source: null }));
        expect(gaps).toHaveLength(0);
    });
});
