import { describe, it, expect } from "vitest";
import { collectCloneGaps, GapCheckInput } from "../cloneGaps";

function baseInput(overrides: Partial<GapCheckInput> = {}): GapCheckInput {
    return {
        source: { features: [], premium_tier: 0 },
        targetTier: 0,
        sourceTier: 0,
        options: { cloneChannels: true, cloneRoles: true, cloneOnboarding: true },
        stats: { stickersCloned: 0, soundboardCloned: 0, onboardingCloned: true },
        ...overrides,
    };
}

describe("collectCloneGaps hidden channels", () => {
    it("reports no gap when no channel was skipped", () => {
        expect(collectCloneGaps(baseInput())).toHaveLength(0);
    });

    it("reports a gap when channels were skipped", () => {
        const gaps = collectCloneGaps(baseInput({ skippedChannels: 4 }));

        const hidden = gaps.find((g) => g.title.toLowerCase().includes("hidden"));
        expect(hidden).toBeDefined();
        expect(hidden!.detail).toContain("4");
    });

    it("uses singular wording for one skipped channel", () => {
        const gaps = collectCloneGaps(baseInput({ skippedChannels: 1 }));

        const hidden = gaps.find((g) => g.title.toLowerCase().includes("hidden"));
        expect(hidden!.detail).toContain("1 channel");
        expect(hidden!.detail).not.toContain("1 channels");
    });
});
