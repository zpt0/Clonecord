import { findByPropsLazy } from "@webpack";

import { createModuleRegistry, expectFunctions, fail, pass } from "../foundation/core/discovery";

interface DiscordTokenStore {
    getToken?(): string | undefined;
}

/**
 * Validated lookup for Discord's token store. The lazy Vencord lookup remains
 * the fallback, so this adds discovery validation without changing when a
 * token can be read. The token itself is never logged, cached, or exported.
 */
const tokenStoreRegistry = createModuleRegistry();

tokenStoreRegistry.register({
    id: "discord-token-store",
    description: "Discord token store exposing getToken()",
    filter: (module) => typeof module === "object" && module !== null && "getToken" in module,
    validate: (value) => {
        const result = expectFunctions(value, ["getToken"]);
        return result.ok ? pass(value as DiscordTokenStore) : fail(...result.issues);
    },
});

let cachedStore: DiscordTokenStore | undefined;

function resolveTokenStore(): DiscordTokenStore | undefined {
    if (cachedStore) return cachedStore;

    const discovered = tokenStoreRegistry.discover();
    if (discovered.ok) {
        cachedStore = tokenStoreRegistry.get<DiscordTokenStore>("discord-token-store");
        if (cachedStore) return cachedStore;
    }

    const lazyStore = findByPropsLazy("getToken") as DiscordTokenStore | undefined;
    if (lazyStore && typeof lazyStore.getToken === "function") {
        cachedStore = lazyStore;
        return cachedStore;
    }

    return undefined;
}

export function getDiscordToken(): string | undefined {
    try {
        return resolveTokenStore()?.getToken?.();
    } catch {
        return undefined;
    }
}
