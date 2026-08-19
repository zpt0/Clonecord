import { describe, it, expect } from "vitest";
import {
    PLUGIN_VERSION,
    GITHUB_REPO,
    UPDATE_CHECK_URL,
    GITHUB_RELEASE_URL,
    UPDATE_CHECK_ENABLED,
    UPDATES_CHANNEL_ID,
    SUPPORT_INVITE_CODE,
} from "./constants";

describe("constants", () => {
    it("has a valid PLUGIN_VERSION", () => {
        expect(PLUGIN_VERSION).toBeDefined();
        expect(typeof PLUGIN_VERSION).toBe("string");
        expect(PLUGIN_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("has GITHUB_REPO set", () => {
        expect(GITHUB_REPO).toBe("zpt0/Clonecord");
    });

    it("derives UPDATE_CHECK_URL from GITHUB_REPO", () => {
        expect(UPDATE_CHECK_URL).toBe(
            "https://api.github.com/repos/zpt0/Clonecord/releases/latest"
        );
    });

    it("derives GITHUB_RELEASE_URL from GITHUB_REPO", () => {
        expect(GITHUB_RELEASE_URL).toBe("https://github.com/zpt0/Clonecord/releases/latest");
    });

    it("enables update checks when GITHUB_REPO is set", () => {
        expect(UPDATE_CHECK_ENABLED).toBe(true);
    });

    it("has UPDATES_CHANNEL_ID as string", () => {
        expect(typeof UPDATES_CHANNEL_ID).toBe("string");
    });

    it("has SUPPORT_INVITE_CODE as string", () => {
        expect(typeof SUPPORT_INVITE_CODE).toBe("string");
        expect(SUPPORT_INVITE_CODE).toBe("MKU8zvHBBJ");
    });
});
