declare module "@components/settings/tabs/plugins/PluginModalButtons" {
    import type { ComponentType } from "react";

    export const FavoriteButton: ComponentType<{ isFavorite: boolean; onClick(): void }>;
    export const GithubButton: ComponentType<{ text: string; href: string }>;
}
