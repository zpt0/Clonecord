import { Logger as VencordLogger } from "@utils/Logger";

export const LogLevel = {
    DEBUG: 10,
    INFO: 20,
    WARN: 30,
    ERROR: 40,
    NONE: 100,
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export type LogLevelName = "debug" | "info" | "warn" | "error" | "none";

type EmittedLevel = Exclude<LogLevelName, "none">;

const LEVEL_NAMES: Record<LogLevelName, LogLevel> = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
    none: LogLevel.NONE,
};

const LEVEL_BY_VALUE: Record<LogLevel, LogLevelName> = {
    [LogLevel.DEBUG]: "debug",
    [LogLevel.INFO]: "info",
    [LogLevel.WARN]: "warn",
    [LogLevel.ERROR]: "error",
    [LogLevel.NONE]: "none",
};

const LEVEL_COLORS: Record<EmittedLevel, string> = {
    debug: "#6c7086",
    info: "#a6d189",
    warn: "#e5c890",
    error: "#e78284",
};

const BADGE_BASE = "color:#11111b;font-weight:700;border-radius:4px;padding:1px 6px;";
const SCOPE_BADGE_STYLE = `${BADGE_BASE}background:#313244;color:#cdd6f4;`;

export function parseLogLevel(value: unknown, fallback: LogLevelName = "warn"): LogLevelName {
    return typeof value === "string" && Object.hasOwn(LEVEL_NAMES, value)
        ? (value as LogLevelName)
        : fallback;
}

export interface LogEntry {
    readonly level: LogLevelName;
    readonly scope: string;
    readonly message: string;
    readonly details: readonly unknown[];
    readonly timestamp: number;
    /** Number of messages folded into this line by deduplication/rate limiting. */
    readonly suppressed?: number;
}

export interface LogSink {
    write(entry: LogEntry): void;
}

/** Tuning knobs for noise control. All values are optional and safely clamped. */
export interface LoggerOptions {
    /** Rate-limit window in milliseconds. Default: 5000. */
    windowMs?: number;
    /** Identical messages inside this window are folded. Default: 1500. */
    dedupWindowMs?: number;
    /** Maximum emitted lines per window before folding the rest. Default: 10. */
    maxPerWindow?: number;
    /** Injectable clock, mainly for deterministic tests. */
    now?: () => number;
}

interface DedupRecord {
    at: number;
    emitted: boolean;
    count: number;
}

interface LogGovernor {
    now: () => number;
    windowMs: number;
    dedupWindowMs: number;
    maxPerWindow: number;
    windowStart: number;
    windowCount: number;
    suppressed: number;
    suppressedLevel: number;
    recent: Map<string, DedupRecord>;
    onceKeys: Set<string>;
}

function positive(value: number | undefined, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function createGovernor(options: LoggerOptions = {}): LogGovernor {
    const now = typeof options.now === "function" ? options.now : Date.now;
    return {
        now,
        windowMs: positive(options.windowMs, 5000),
        dedupWindowMs: positive(options.dedupWindowMs, 1500),
        maxPerWindow: positive(options.maxPerWindow, 10),
        windowStart: now(),
        windowCount: 0,
        suppressed: 0,
        suppressedLevel: 0,
        recent: new Map(),
        onceKeys: new Set(),
    };
}

function formatConsoleArgs(entry: LogEntry): unknown[] {
    const level: EmittedLevel = entry.level === "none" ? "info" : entry.level;
    const folded = entry.suppressed ? ` · +${entry.suppressed} folded` : "";
    return [
        `%c ${level.toUpperCase()} %c ${entry.scope} %c${entry.message}${folded}`,
        `${BADGE_BASE}background:${LEVEL_COLORS[level]};`,
        SCOPE_BADGE_STYLE,
        "",
        ...entry.details,
    ];
}

export function createConsoleLogSink(): LogSink {
    return {
        write(entry) {
            if (entry.level === "none") return;
            const args = formatConsoleArgs(entry);
            switch (entry.level) {
                case "debug":
                    console.debug(...args);
                    break;
                case "info":
                    console.info(...args);
                    break;
                case "warn":
                    console.warn(...args);
                    break;
                case "error":
                    console.error(...args);
                    break;
            }
        },
    };
}

export function createCollectingLogSink(): LogSink & { entries: LogEntry[] } {
    const entries: LogEntry[] = [];
    return {
        entries,
        write(entry) {
            entries.push(entry);
        },
    };
}

const MAX_HISTORY_ENTRIES = 200;
const history: LogEntry[] = [];
const historyListeners = new Set<() => void>();

function notifyHistory(): void {
    for (const listener of [...historyListeners]) listener();
}

/** Bounded in-memory history of every line actually emitted by a FoundationLogger. */
export function getLogHistory(): readonly LogEntry[] {
    return history;
}

export function clearLogHistory(): void {
    history.length = 0;
    notifyHistory();
}

export function subscribeToLogHistory(listener: () => void): () => void {
    historyListeners.add(listener);
    return () => {
        historyListeners.delete(listener);
    };
}

function recordLogHistory(entry: LogEntry): void {
    history.push(entry);
    if (history.length > MAX_HISTORY_ENTRIES)
        history.splice(0, history.length - MAX_HISTORY_ENTRIES);
    notifyHistory();
}

export function createVencordLogSink(color = "#cba6f7", name = "Plugins"): LogSink {
    const logger = new VencordLogger(name, color);
    return {
        write(entry) {
            if (entry.level === "none") return;
            const args = formatConsoleArgs(entry);
            switch (entry.level) {
                case "debug":
                    logger.debug(...args);
                    break;
                case "info":
                    logger.info(...args);
                    break;
                case "warn":
                    logger.warn(...args);
                    break;
                case "error":
                    logger.error(...args);
                    break;
            }
        },
    };
}

interface InternalLoggerOptions extends LoggerOptions {
    governor?: LogGovernor;
    levelProvider?: () => LogLevelName;
}

/**
 * Bounded logger: identical messages are folded, excessive volume is capped per
 * window, and at most one summary line per window is emitted. No timers are used,
 * so shutting a plugin down never leaves pending console work behind.
 */
export class FoundationLogger {
    private levelValue: LogLevel;
    private readonly governor: LogGovernor;
    private readonly levelProvider?: () => LogLevelName;

    constructor(
        readonly scope: string,
        readonly sink: LogSink,
        level: LogLevelName = "warn",
        options: InternalLoggerOptions = {}
    ) {
        this.levelValue = LEVEL_NAMES[level];
        this.governor = options.governor ?? createGovernor(options);
        this.levelProvider = options.levelProvider;
    }

    get level(): LogLevelName {
        return this.levelProvider?.() ?? LEVEL_BY_VALUE[this.levelValue];
    }

    private get activeLevel(): LogLevel {
        return LEVEL_NAMES[this.level];
    }

    setLevel(level: LogLevelName): void {
        this.levelValue = LEVEL_NAMES[level];
        if (level === "none") return;
        this.governor.recent.clear();
        this.governor.windowCount = 0;
        this.governor.suppressed = 0;
        this.governor.suppressedLevel = 0;
    }

    child(scope: string): FoundationLogger {
        return new FoundationLogger(`${this.scope}:${scope}`, this.sink, this.level, {
            governor: this.governor,
            levelProvider: this.levelProvider,
        });
    }

    debug(message: string, ...details: unknown[]): void {
        this.write("debug", message, details);
    }

    info(message: string, ...details: unknown[]): void {
        this.write("info", message, details);
    }

    warn(message: string, ...details: unknown[]): void {
        this.write("warn", message, details);
    }

    error(message: string, ...details: unknown[]): void {
        this.write("error", message, details);
    }

    /** Logs a warning only once per scope and message for the lifetime of the governor. */
    once(message: string, ...details: unknown[]): void {
        const key = `once\u0000${message}`;
        if (this.governor.onceKeys.has(key)) return;
        this.governor.onceKeys.add(key);
        this.write("warn", message, details);
    }

    /** Emits a pending "N folded" summary immediately, e.g. before a plugin stops. */
    flush(): void {
        const now = this.governor.now();
        this.emitSummary(now);
        this.governor.windowStart = now;
        this.governor.suppressed = 0;
        this.governor.suppressedLevel = 0;
    }

    private write(level: LogLevelName, message: string, details: readonly unknown[]): void {
        if (level === "none") return;
        const severity = LEVEL_NAMES[level];
        if (severity === LogLevel.NONE || severity < this.activeLevel) return;

        this.prepareWindow();
        const now = this.governor.now();
        const key = `${level}\u0000${message}`;
        const seen = this.governor.recent.get(key);

        if (seen && now - seen.at <= this.governor.dedupWindowMs) {
            seen.count++;
            this.noteSuppressed(severity);
            return;
        }

        this.governor.recent.set(key, { at: now, emitted: true, count: 1 });
        this.pruneRecent(now);

        if (this.governor.windowCount >= this.governor.maxPerWindow) {
            const pending = this.governor.recent.get(key);
            if (pending) pending.emitted = false;
            this.noteSuppressed(severity);
            return;
        }

        this.governor.windowCount++;
        this.emit(level, message, details, now, 0);
    }

    private prepareWindow(): void {
        const now = this.governor.now();
        if (now - this.governor.windowStart < this.governor.windowMs) return;
        this.emitSummary(now);
        this.governor.windowStart = now;
        this.governor.windowCount = 0;
        this.governor.suppressed = 0;
        this.governor.suppressedLevel = 0;
    }

    private noteSuppressed(severity: number): void {
        this.governor.suppressed++;
        this.governor.suppressedLevel = Math.max(this.governor.suppressedLevel, severity);
    }

    private emitSummary(now: number): void {
        const count = this.governor.suppressed;
        if (count === 0) return;
        const level: EmittedLevel =
            this.governor.suppressedLevel >= LogLevel.ERROR
                ? "error"
                : this.governor.suppressedLevel >= LogLevel.WARN
                  ? "warn"
                  : "info";
        if (LEVEL_NAMES[level] >= this.activeLevel) {
            this.emit(
                level,
                `${count} additional message${count === 1 ? "" : "s"} folded`,
                [],
                now,
                count
            );
        }
    }

    private pruneRecent(now: number): void {
        if (this.governor.recent.size <= 128) return;
        const cutoff = Math.max(this.governor.dedupWindowMs, this.governor.windowMs);
        for (const [key, record] of this.governor.recent) {
            if (now - record.at > cutoff) this.governor.recent.delete(key);
        }
    }

    private emit(
        level: LogLevelName,
        message: string,
        details: readonly unknown[],
        timestamp: number,
        suppressed: number
    ): void {
        const entry: LogEntry = {
            level,
            scope: this.scope,
            message,
            details,
            timestamp,
            ...(suppressed > 0 ? { suppressed } : {}),
        };
        recordLogHistory(entry);
        this.sink.write(entry);
    }
}

let sharedSink: LogSink | undefined;
let sharedLevel: LogLevelName = "warn";
let sharedGovernor: LogGovernor | undefined;

/** The single sink used by all module-level scoped loggers of a plugin. */
export function getSharedLogSink(): LogSink {
    if (!sharedSink) {
        try {
            sharedSink = createVencordLogSink();
        } catch {
            // Vencord's Logger can be unavailable in partial test setups.
            sharedSink = createConsoleLogSink();
        }
    }
    return sharedSink;
}

/** Keeps module-level scoped loggers in sync with the runtime log-level setting. */
export function setSharedLogLevel(level: LogLevelName): void {
    sharedLevel = parseLogLevel(level);
    sharedGovernor = undefined;
}

/** Drops shared state, e.g. when a plugin is reloaded. */
export function resetSharedLogging(): void {
    sharedSink = undefined;
    sharedLevel = "warn";
    sharedGovernor = undefined;
    clearLogHistory();
}

/** Logger for a single module. Every logger shares one sink and one noise budget. */
export function createScopedLogger(scope: string): FoundationLogger {
    sharedGovernor ??= createGovernor();
    return new FoundationLogger(scope, getSharedLogSink(), sharedLevel, {
        governor: sharedGovernor,
        levelProvider: () => sharedLevel,
    });
}
