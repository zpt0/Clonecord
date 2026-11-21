import * as DataStore from "@api/DataStore";

import { isErr, type Result } from "./errors";
import type { Disposable, DisposeReason } from "./lifecycle";
import type { FoundationLogger } from "./logging";

export type DiagnosticSeverity = "info" | "warning" | "error";
export type DiagnosticContextValue = string | number | boolean | null;

export interface DiagnosticEntry {
    readonly id: string;
    readonly severity: DiagnosticSeverity;
    readonly message: string;
    readonly context: Readonly<Record<string, DiagnosticContextValue>>;
    readonly timestamp: number;
}

export interface DiagnosticSnapshot {
    readonly pluginName: string;
    readonly entries: readonly DiagnosticEntry[];
    readonly createdAt: number;
}

export interface DiagnosticCollectorOptions {
    readonly limit?: number;
    readonly idFactory?: (index: number) => string;
}

export type DiagnosticListener = (entry: DiagnosticEntry) => void;

export class DiagnosticCollector implements Disposable {
    private entries: DiagnosticEntry[] = [];
    private readonly listeners = new Set<DiagnosticListener>();
    private disposed = false;
    private sequence = 0;

    constructor(
        readonly pluginName: string,
        private readonly options: DiagnosticCollectorOptions = {}
    ) {}

    get size(): number {
        return this.entries.length;
    }

    record(
        severity: DiagnosticSeverity,
        message: string,
        context: Readonly<Record<string, DiagnosticContextValue>> = {}
    ): DiagnosticEntry {
        if (this.disposed) throw new Error("DiagnosticCollector has been disposed");

        const entry: DiagnosticEntry = {
            id:
                this.options.idFactory?.(this.sequence++) ??
                `${this.pluginName}:${this.sequence++}`,
            severity,
            message,
            context: Object.freeze({ ...context }),
            timestamp: Date.now(),
        };

        this.entries.push(entry);
        const limit = this.options.limit ?? 100;
        if (this.entries.length > limit) this.entries.splice(0, this.entries.length - limit);

        for (const listener of Array.from(this.listeners)) listener(entry);
        return entry;
    }

    info(
        message: string,
        context?: Readonly<Record<string, DiagnosticContextValue>>
    ): DiagnosticEntry {
        return this.record("info", message, context);
    }

    warn(
        message: string,
        context?: Readonly<Record<string, DiagnosticContextValue>>
    ): DiagnosticEntry {
        return this.record("warning", message, context);
    }

    error(
        message: string,
        context?: Readonly<Record<string, DiagnosticContextValue>>
    ): DiagnosticEntry {
        return this.record("error", message, context);
    }

    recordResult<T>(
        result: Result<T, unknown>,
        successMessage: string,
        context?: Readonly<Record<string, DiagnosticContextValue>>
    ): void {
        if (isErr(result)) {
            const detail =
                result.error instanceof Error ? result.error.message : String(result.error);
            this.error(detail, { ...context, outcome: "error" });
            return;
        }
        this.info(successMessage, { ...context, outcome: "ok" });
    }

    list(): readonly DiagnosticEntry[] {
        return Object.freeze([...this.entries]);
    }

    snapshot(): DiagnosticSnapshot {
        return {
            pluginName: this.pluginName,
            entries: this.list(),
            createdAt: Date.now(),
        };
    }

    subscribe(listener: DiagnosticListener): () => void {
        if (this.disposed) return () => undefined;
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    clear(): void {
        this.entries = [];
    }

    formatSummary(): string {
        if (this.entries.length === 0) return `${this.pluginName}: no diagnostics recorded`;
        const counts = { info: 0, warning: 0, error: 0 };
        for (const entry of this.entries) counts[entry.severity]++;
        return `${this.pluginName}: ${counts.info} info, ${counts.warning} warning, ${counts.error} error`;
    }

    dispose(_reason?: DisposeReason): void {
        if (this.disposed) return;
        this.disposed = true;
        this.listeners.clear();
    }
}

export function createDiagnosticReporter(
    collector: DiagnosticCollector,
    logger: FoundationLogger,
    isEnabled: () => boolean
): () => void {
    return collector.subscribe((entry) => {
        if (!isEnabled()) return;
        const context = Object.entries(entry.context)
            .map(([key, value]) => `${key}=${String(value)}`)
            .join(" ");
        const message = context ? `${entry.message} (${context})` : entry.message;
        switch (entry.severity) {
            case "error":
                logger.error(message);
                break;
            case "warning":
                logger.warn(message);
                break;
            case "info":
                logger.info(message);
                break;
        }
    });
}

export interface DiagnosticPersistence {
    save(snapshot: DiagnosticSnapshot): Promise<void>;
    load(): Promise<DiagnosticSnapshot | undefined>;
    clear(): Promise<void>;
}

export interface DiagnosticDataStoreLike {
    get<T = unknown>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown): Promise<void>;
    del(key: string): Promise<void>;
}

export function createDiagnosticPersistence(
    pluginName: string,
    store: DiagnosticDataStoreLike = DataStore
): DiagnosticPersistence {
    const key = `vpf:diagnostics:${pluginName}`;

    return {
        async save(snapshot) {
            await store.set(key, JSON.stringify(snapshot));
        },
        async load() {
            const raw = await store.get<string>(key);
            if (!raw) return undefined;
            try {
                const parsed: unknown = JSON.parse(raw);
                if (
                    typeof parsed === "object" &&
                    parsed !== null &&
                    "pluginName" in parsed &&
                    "entries" in parsed &&
                    Array.isArray(parsed.entries)
                ) {
                    return parsed as DiagnosticSnapshot;
                }
                return undefined;
            } catch {
                return undefined;
            }
        },
        clear() {
            return store.del(key);
        },
    };
}
