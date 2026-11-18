import { describe, it, expect } from "vitest";
import { buildHiddenChannelsNote } from "../channelVisibility";

describe("buildHiddenChannelsNote", () => {
    it("returns null when nothing was withheld", () => {
        expect(buildHiddenChannelsNote({ obfuscated: 0, missing: 0 })).toBeNull();
    });

    it("explains that redacted channels cannot be cloned", () => {
        const note = buildHiddenChannelsNote({ obfuscated: 2, missing: 0 });

        expect(note).not.toBeNull();
        expect(note).toContain("2 channel");
        expect(note?.toLowerCase()).toContain("hidden");
    });

    it("mentions channels Discord withheld completely", () => {
        const note = buildHiddenChannelsNote({ obfuscated: 0, missing: 3 });

        expect(note).toContain("3 channel");
    });

    it("uses singular wording for one channel", () => {
        const note = buildHiddenChannelsNote({ obfuscated: 1, missing: 0 });

        expect(note).toContain("1 channel");
        expect(note).not.toContain("1 channels");
    });
});
