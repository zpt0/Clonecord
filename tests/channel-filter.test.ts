import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cloneChannels } from "../core/cloneChannels";
import { state } from "../store";
import { isInternalPseudoChannel } from "../utils/channelVisibility";
import { GuildStore, RestAPI } from "./helpers/vencord-mocks";

describe("internal server-hub channel filter", () => {
    let postSpy: ReturnType<typeof vi.spyOn>;
    let guildSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        postSpy = vi
            .spyOn(RestAPI, "post")
            .mockImplementation(async () => ({ body: { id: "created-channel" } }) as any);
        guildSpy = vi.spyOn(GuildStore, "getGuild").mockImplementation(() => ({}) as any);

        state.isCloning = true;
        state.mainProgressNotificationId = null;
        state.hiddenChannelsSkipped = 0;
        state.failedItems = [];
    });

    afterEach(() => {
        postSpy.mockRestore();
        guildSpy.mockRestore();
        state.isCloning = false;
        state.hiddenChannelsSkipped = 0;
        state.failedItems = [];
    });

    it("recognises Discord's internal server-hub pseudo-channel", () => {
        expect(isInternalPseudoChannel({ name: "server-hub", type: 18 })).toBe(true);
        expect(isInternalPseudoChannel({ name: "  SERVER-HUB  ", type: 18 })).toBe(true);
        expect(isInternalPseudoChannel({ name: "general", type: 0 })).toBe(false);
        expect(isInternalPseudoChannel({ name: "server-hub-links", type: 0 })).toBe(false);
        expect(isInternalPseudoChannel(null)).toBe(false);
    });

    it("does not create a server-hub channel while cloning other channels", async () => {
        const result = await cloneChannels({
            sourceGuild: { id: "source-guild" },
            fullGuildData: {},
            newGuildId: "target-guild",
            options: {
                cloneChannels: true,
                cloneRoles: false,
                cloneOnboarding: false,
                cloneSystemFlags: false,
                resumeMode: false,
                targetGuildId: "target-guild",
            },
            roleIdMap: {},
            channelIdMap: {},
            taskQueue: { execute: async (fn: () => Promise<unknown>) => fn() } as any,
            estimateChannels: [
                {
                    id: "general-id",
                    name: "general",
                    type: 0,
                    position: 0,
                    permission_overwrites: [],
                },
                {
                    id: "server-hub-id",
                    name: "server-hub",
                    type: 18,
                    position: 1,
                    permission_overwrites: [],
                },
            ],
            estimateRoles: [],
            rolesProgressStart: 0,
            rolesProgressEnd: 30,
            channelsProgressStart: 30,
            channelsProgressEnd: 80,
            settingsProgressEnd: 85,
            onboardingProgressStart: 85,
            stickersProgressStart: 85,
            stickersProgressEnd: 90,
            soundboardProgressStart: 90,
            soundboardProgressEnd: 95,
        } as any);

        const createdNames = postSpy.mock.calls.map((call: any[]) => call[0]?.body?.name);
        expect(createdNames).toContain("general");
        expect(createdNames).not.toContain("server-hub");
        expect(result.channelsCloned).toBe(1);
        expect(state.failedItems).toHaveLength(0);
    });
});
