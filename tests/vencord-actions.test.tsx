import { describe, expect, it } from "vitest";

import { config } from "../components/UnifiedSettings";
import { FoundationPluginActions } from "../foundation/ui/components";
import { SettingsApp } from "../platform/settings";
import {
    __settingsStore,
    FavoriteButton,
    GithubButton,
    setPluginSettings,
    toasts,
} from "./helpers/vencord-mocks";
import type { StubElement } from "./helpers/jsx-runtime";

function findElement(
    node: unknown,
    predicate: (element: StubElement) => boolean
): StubElement | undefined {
    if (node === null || typeof node !== "object") return undefined;
    const element = node as StubElement;
    if (!Array.isArray(element.children)) return undefined;
    if (predicate(element)) return element;
    for (const child of element.children) {
        const found = findElement(child, predicate);
        if (found) return found;
    }
    return undefined;
}

describe("Clonecord Vencord plugin actions", () => {
    it("exposes the source repository in the settings config", () => {
        expect(config.sourceUrl).toBe("https://github.com/zpt0/Clonecord");
    });

    it("renders the original buttons in the settings header", () => {
        const tree = SettingsApp({ config }) as unknown as StubElement;
        const actions = findElement(tree, (element) => element.type === FoundationPluginActions);
        expect(actions).toBeDefined();
        expect(actions!.props.pluginName).toBe("Clonecord");
        expect(actions!.props.sourceUrl).toBe(config.sourceUrl);

        const rendered = (actions!.type as typeof FoundationPluginActions)(
            actions!.props as unknown as Parameters<typeof FoundationPluginActions>[0]
        ) as unknown as StubElement;

        expect(findElement(rendered, (element) => element.type === FavoriteButton)).toBeDefined();
        const github = findElement(rendered, (element) => element.type === GithubButton);
        expect(github).toBeDefined();
        expect(github!.props.href).toBe("https://github.com/zpt0/Clonecord");
        expect(github!.props.text).toBe("View source code");
    });

    it("toggles Vencord's native favorite setting", () => {
        setPluginSettings("Clonecord", { isFavorite: false });

        const rendered = FoundationPluginActions({
            pluginName: "Clonecord",
            sourceUrl: config.sourceUrl!,
        }) as unknown as StubElement;
        const favorite = findElement(rendered, (element) => element.type === FavoriteButton);
        expect(favorite!.props.isFavorite).toBe(false);

        (favorite!.props.onClick as () => void)();

        const plugins = __settingsStore.plain.plugins as Record<string, { isFavorite?: boolean }>;
        expect(plugins.Clonecord?.isFavorite).toBe(true);
        expect(toasts.at(-1)?.text).toBe("Pinned to favorites");

        const rerendered = FoundationPluginActions({
            pluginName: "Clonecord",
            sourceUrl: config.sourceUrl!,
        }) as unknown as StubElement;
        const favoriteAfterRerender = findElement(
            rerendered,
            (element) => element.type === FavoriteButton
        );
        expect(favoriteAfterRerender!.props.isFavorite).toBe(true);

        (favoriteAfterRerender!.props.onClick as () => void)();
        expect(plugins.Clonecord?.isFavorite).toBe(false);
        expect(toasts.at(-1)?.text).toBe("Removed from favorites");
    });
});
