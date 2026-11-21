declare module "@utils/Logger" {
    export class Logger {
        constructor(name: string, color?: string);
        log(...args: unknown[]): void;
        info(...args: unknown[]): void;
        error(...args: unknown[]): void;
        warn(...args: unknown[]): void;
        debug(...args: unknown[]): void;
    }
}
