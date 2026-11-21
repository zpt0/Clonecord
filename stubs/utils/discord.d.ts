declare module "@utils/discord" {
    export enum Theme {
        Dark = "dark",
        Light = "light",
    }

    export function getTheme(): Theme;
    export function openInviteModal(code: string): void;
}
