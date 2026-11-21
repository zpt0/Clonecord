declare module "@utils/css" {
    export function classNameFactory(prefix: string): (name: string) => string;
    export function className(prefix: string, ...names: string[]): string;
}
