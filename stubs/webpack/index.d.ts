declare module "@webpack" {
    export type ModuleFilter = (module: any) => boolean;

    export const filters: {
        byProps(...props: string[]): ModuleFilter;
        byCode(...code: Array<string | RegExp>): ModuleFilter;
        componentByCode(...code: Array<string | RegExp>): ModuleFilter;
    };

    export function findByPropsLazy(...props: string[]): any;
    export function findByProps(...props: string[]): any;
    export function find(module: ModuleFilter): any;
    export function findAll(module: ModuleFilter): any[];
    export function findLazy(module: ModuleFilter): any;
    export function findByCode(...code: Array<string | RegExp>): any;
    export function search(...code: Array<string | RegExp>): Record<number, unknown>;
    export function waitFor(
        module: ModuleFilter | string | string[],
        callback: (m: any) => void
    ): void;
}
