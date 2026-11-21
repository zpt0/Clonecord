declare module "@api/Settings" {
    import type { DefinedSettings, SettingsDefinition } from "@utils/types";

    export interface SettingsStoreLike<T extends object = Record<string, any>> {
        plain: T;
        store: T;
        addChangeListener<P extends string>(path: P, cb: (data: unknown) => void): void;
        removeChangeListener<P extends string>(path: P, cb: (data: unknown) => void): void;
        addPrefixChangeListener(prefix: string, cb: (data: unknown, path: string) => void): void;
        removePrefixChangeListener(prefix: string, cb: (data: unknown, path: string) => void): void;
        addGlobalChangeListener(cb: (data: unknown, path: string) => void): void;
        removeGlobalChangeListener(cb: (data: unknown, path: string) => void): void;
        markAsChanged(): void;
    }

    export type SettingsChecks<D extends SettingsDefinition> = Partial<
        Record<keyof D, Record<string, unknown>>
    >;

    export const SettingsStore: SettingsStoreLike;
    export function useSettings(paths?: string[]): any;

    export function definePluginSettings<D extends SettingsDefinition>(
        settings: D,
        checks?: SettingsChecks<D>
    ): DefinedSettings<D>;
}
