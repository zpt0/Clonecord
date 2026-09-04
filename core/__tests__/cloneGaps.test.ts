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
    it("returns only the never-cloned note for a clean identical run", () => {
        const gaps = collectCloneGaps(baseInput());
        expect(gaps).toHaveLength(1);
        expect(gaps[0].title).toBe("Never cloned via API");
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
        const boost = gaps.find((g) => g.title.includes("Boost level"));
        expect(boost).toBeDefined();
        expect(boost!.detail).toContain("384kbps");
    });

    it("flags skipped server features", () => {
        const gaps = collectCloneGaps(
            baseInput({
                source: { features: ["COMMUNITY", "VANITY_URL", "BANNER"], premium_tier: 0 },
            })
        );
        const features = gaps.find((g) => g.title.includes("features"));
        expect(features).toBeDefined();
        expect(features!.detail).toContain("VANITY_URL");
        expect(features!.detail).not.toContain("COMMUNITY");
    });

    it("flags empty sticker/soundboard results when enabled", () => {
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
        expect(gaps.some((g) => g.title.includes("stickers"))).toBe(true);
        expect(gaps.some((g) => g.title.includes("soundboard"))).toBe(true);
    });

    it("returns no gaps without source data except the static note", () => {
        const gaps = collectCloneGaps(baseInput({ source: null }));
        expect(gaps).toHaveLength(0);
    });
});
