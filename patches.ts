import { definePatchManifest } from "./foundation";

/** The original Clonecord patch, expressed through the copied foundation manifest. */
export const patchManifest = definePatchManifest([
    {
        id: "guild-channel-store-gate",
        description: "Allow channel visibility inspection to read gated channels",
        module: "GuildChannelStore",
        patch: {
            find: '"GuildChannelStore"',
            replacement: [
                {
                    match: /isChannelGated\(.+?\)(?=&&)/,
                    replace: (m: string) => `${m}&&false`,
                },
            ],
        },
        expectations: {
            find: { min: 1, max: 1 },
            replacements: { min: 1 },
        },
    },
]);
