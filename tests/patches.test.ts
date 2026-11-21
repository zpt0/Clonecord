import { describe, expect, it } from "vitest";

import { patchManifest } from "../patches";
import { runPatchFixture } from "../foundation/core/patches";

const FIXTURE_SOURCE = `function renderGuildChannelStore() {
    "GuildChannelStore";
    if (isChannelGated(channel, user)&&channel.locked) return null;
    return isChannelGated(other, user)&&other.locked;
}`;

const EXPECTED_OUTPUT = `function renderGuildChannelStore() {
    "GuildChannelStore";
    if (isChannelGated(channel, user)&&false&&channel.locked) return null;
    return isChannelGated(other, user)&&false&&other.locked;
}`;

describe("Clonecord patch manifest", () => {
    it("emits the original Vencord patch without manifest metadata", () => {
        const patches = patchManifest.toVencordPatches("Clonecord");
        expect(patches).toHaveLength(1);

        const patch = patches[0] as any;
        expect(patch.plugin).toBe("Clonecord");
        expect(patch.find).toBe('"GuildChannelStore"');
        expect(patch.noWarn).toBeUndefined();
        expect(patch.replacement).toHaveLength(1);
        expect(patch.replacement[0].match).toEqual(/isChannelGated\(.+?\)(?=&&)/);
        expect(patch.replacement[0].noWarn).toBeUndefined();
        expect(patch.replacement[0].replace("isChannelGated(channel, user)")).toBe(
            "isChannelGated(channel, user)&&false"
        );
        expect(Object.keys(patch)).not.toContain("id");
        expect(Object.keys(patch)).not.toContain("expectations");
    });

    it("matches the fixture exactly", () => {
        const result = runPatchFixture(patchManifest.entries[0], {
            name: "gated-channel fixture",
            source: FIXTURE_SOURCE,
            expectedOutput: EXPECTED_OUTPUT,
        });

        expect(result.ok, result.issues.join("; ")).toBe(true);
        expect(result.findMatches).toBe(1);
        expect(result.replacementMatches).toEqual([2]);
        expect(result.output).toBe(EXPECTED_OUTPUT);
    });
});
