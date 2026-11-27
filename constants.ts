export const PLUGIN_VERSION = "0.1.1";
export const GITHUB_REPO = "zpt0/Clonecord";
export const PLUGIN_AUTHOR = { name: "zpt0.dev", id: 299670891875270656n } as const;
export const UPDATE_CHECK_URL = GITHUB_REPO
    ? `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
    : "";
export const GITHUB_RELEASE_URL = GITHUB_REPO
    ? `https://github.com/${GITHUB_REPO}/releases/latest`
    : "";
export const UPDATE_CHECK_ENABLED = !!GITHUB_REPO;
export const UPDATES_CHANNEL_ID = "1532348047697121340";
export const SUPPORT_INVITE_CODE = "sKTrAMctcy";
// Support guild resolved from SUPPORT_INVITE_CODE. Membership is checked by id.
export const SUPPORT_GUILD_ID = "1508481905291558942";
