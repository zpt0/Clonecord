export const PLUGIN_VERSION = "1.1.0";
export const GITHUB_REPO = "6jt8/Clonecord";
export const UPDATE_CHECK_URL = GITHUB_REPO
    ? `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
    : "";
export const GITHUB_RELEASE_URL = GITHUB_REPO
    ? `https://github.com/${GITHUB_REPO}/releases/latest`
    : "";
export const UPDATE_CHECK_ENABLED = !!GITHUB_REPO;
export const UPDATES_CHANNEL_ID = ""; // TODO: Discord Channel-ID eintrragen
export const SUPPORT_INVITE_CODE = "SY8f5xPxBj";
