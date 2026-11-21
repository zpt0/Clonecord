import { err, ok, ResourceError, StartupError, type Result } from "./errors";

export type DisposeReason = "shutdown" | "startup-failure" | "scope-reset";

export interface Disposable {
    dispose(): void | Promise<void>;
}

export interface DisposalRecord {
    readonly id: string;
    readonly ok: boolean;
    readonly error?: unknown;
}

export interface DisposalReport {
    readonly reason: DisposeReason;
    readonly records: readonly DisposalRecord[];
    readonly errors: readonly unknown[];
    readonly ok: boolean;
}

export interface ResourceOptions {
    /** Replace an existing resource with the same id instead of throwing. */
    replace?: boolean;
    /** Tags allow callers to dispose a related group of resources. */
    tags?: readonly string[];
}

export interface ResourceHandle<T> {
    readonly id: string;
    readonly value: T;
    readonly tags: readonly string[];
    readonly disposed: boolean;
    dispose(): Promise<void>;
}

interface ResourceEntry<T> {
    id: string;
    value: T;
    dispose: (value: T) => void | Promise<void>;
    tags: readonly string[];
    disposed: boolean;
}

const EMPTY_REPORT = (reason: DisposeReason): DisposalReport => ({
    reason,
    records: [],
    errors: [],
    ok: true,
});

export class ResourceScope {
    private readonly entries = new Map<string, ResourceEntry<unknown>>();
    private disposing = false;
    private disposed = false;

    get isDisposed(): boolean {
        return this.disposed;
    }

    get size(): number {
        return this.entries.size;
    }

    register<T>(
        id: string,
        value: T,
        dispose: (value: T) => void | Promise<void>,
        options: ResourceOptions = {}
    ): ResourceHandle<T> {
        if (this.disposed || this.disposing) {
            throw new ResourceError("Cannot register a resource on a disposed scope", {
                details: { id },
            });
        }
        if (!id) {
            throw new ResourceError("Resource id must be a non-empty string");
        }
        if (this.entries.has(id) && !options.replace) {
            throw new ResourceError(`Resource id is already registered: ${id}`, {
                details: { id },
            });
        }

        if (this.entries.has(id)) {
            const existing = this.entries.get(id);
            if (existing && !existing.disposed) {
                existing.disposed = true;
                this.entries.delete(id);
                void Promise.resolve(existing.dispose(existing.value)).catch(() => undefined);
            }
        }

        const entry: ResourceEntry<T> = {
            id,
            value,
            dispose,
            tags: Object.freeze([...(options.tags ?? [])]),
            disposed: false,
        };
        this.entries.set(id, entry as ResourceEntry<unknown>);

        return this.createHandle(entry);
    }

    async acquire<T>(
        id: string,
        acquire: () => T | Promise<T>,
        dispose: (value: T) => void | Promise<void>,
        options: ResourceOptions = {}
    ): Promise<ResourceHandle<T>> {
        const value = await acquire();
        return this.register(id, value, dispose, options);
    }

    has(id: string): boolean {
        const entry = this.entries.get(id);
        return entry !== undefined && !entry.disposed;
    }

    get<T>(id: string): T | undefined {
        const entry = this.entries.get(id);
        return entry?.disposed ? undefined : (entry?.value as T | undefined);
    }

    async dispose(id: string, reason: DisposeReason = "scope-reset"): Promise<DisposalReport> {
        const entry = this.entries.get(id);
        if (!entry || entry.disposed) return EMPTY_REPORT(reason);

        return this.disposeEntries([entry], reason);
    }

    async disposeTag(tag: string, reason: DisposeReason = "scope-reset"): Promise<DisposalReport> {
        const matches = Array.from(this.entries.values()).filter(
            (entry) => !entry.disposed && entry.tags.includes(tag)
        );
        return this.disposeEntries(matches, reason);
    }

    async disposeAll(reason: DisposeReason = "shutdown"): Promise<DisposalReport> {
        if (this.disposed) return EMPTY_REPORT(reason);
        if (this.entries.size === 0) {
            this.disposed = true;
            return EMPTY_REPORT(reason);
        }

        const entries = Array.from(this.entries.values()).reverse();
        return this.disposeEntries(entries, reason);
    }

    private createHandle<T>(entry: ResourceEntry<T>): ResourceHandle<T> {
        return {
            get id() {
                return entry.id;
            },
            get value() {
                return entry.value;
            },
            get tags() {
                return entry.tags;
            },
            get disposed() {
                return entry.disposed;
            },
            dispose: async () => {
                if (entry.disposed) return;
                await this.dispose(entry.id, "scope-reset");
            },
        };
    }

    private async disposeEntries(
        entries: readonly ResourceEntry<unknown>[],
        reason: DisposeReason
    ): Promise<DisposalReport> {
        this.disposing = true;
        const records: DisposalRecord[] = [];
        const errors: unknown[] = [];

        try {
            for (const entry of entries) {
                if (entry.disposed) continue;
                entry.disposed = true;
                this.entries.delete(entry.id);

                try {
                    await entry.dispose(entry.value);
                    records.push({ id: entry.id, ok: true });
                } catch (error) {
                    records.push({ id: entry.id, ok: false, error });
                    errors.push(error);
                }
            }
        } finally {
            this.disposing = false;
            if (this.entries.size === 0) this.disposed = true;
        }

        return { reason, records, errors, ok: errors.length === 0 };
    }
}

export type LifecycleState = "idle" | "starting" | "started" | "stopped";

export class LifecycleOwner {
    readonly scope = new ResourceScope();
    private stateValue: LifecycleState = "idle";

    constructor(readonly name: string) {}

    get state(): LifecycleState {
        return this.stateValue;
    }

    get isStarted(): boolean {
        return this.stateValue === "started";
    }

    async start(
        startup: (scope: ResourceScope) => void | Promise<void>
    ): Promise<Result<void, StartupError>> {
        if (this.stateValue === "started") return ok(undefined);
        if (this.stateValue !== "idle") {
            return err(
                new StartupError(
                    `LifecycleOwner ${this.name} cannot start from state ${this.stateValue}`
                )
            );
        }

        this.stateValue = "starting";
        try {
            await startup(this.scope);
            this.stateValue = "started";
            return ok(undefined);
        } catch (error) {
            const disposal = await this.scope.disposeAll("startup-failure");
            this.stateValue = "stopped";
            return err(
                new StartupError(`Startup failed for ${this.name}`, {
                    cause: error,
                    details: {
                        disposalOk: disposal.ok,
                        disposalErrors: disposal.errors.length,
                    },
                })
            );
        }
    }

    async stop(): Promise<DisposalReport> {
        if (this.stateValue === "stopped") return EMPTY_REPORT("shutdown");
        const report = await this.scope.disposeAll("shutdown");
        this.stateValue = "stopped";
        return report;
    }
}

export function createLifecycleOwner(name: string): LifecycleOwner {
    return new LifecycleOwner(name);
}

export interface FluxSubscriptionLike<Args extends unknown[] = unknown[]> {
    subscribe(event: string, callback: (...args: Args) => void): void;
    unsubscribe(event: string, callback: (...args: Args) => void): void;
}

export interface BridgeRegistrationLike {
    readonly id: string;
    unregister(): void;
}

export function trackTimeout(
    scope: ResourceScope,
    id: string,
    callback: () => void,
    ms: number,
    options?: ResourceOptions
): ResourceHandle<ReturnType<typeof setTimeout>> {
    return scope.register(id, setTimeout(callback, ms), (handle) => clearTimeout(handle), options);
}

export function trackInterval(
    scope: ResourceScope,
    id: string,
    callback: () => void,
    ms: number,
    options?: ResourceOptions
): ResourceHandle<ReturnType<typeof setInterval>> {
    return scope.register(
        id,
        setInterval(callback, ms),
        (handle) => clearInterval(handle),
        options
    );
}

export function trackMutationObserver(
    scope: ResourceScope,
    id: string,
    target: Node,
    callback: MutationCallback,
    observerOptions?: MutationObserverInit,
    options?: ResourceOptions
): ResourceHandle<MutationObserver> {
    const observer = new MutationObserver(callback);
    observer.observe(target, observerOptions);
    return scope.register(id, observer, (value) => value.disconnect(), options);
}

export function trackEventListener<T extends EventTarget>(
    scope: ResourceScope,
    id: string,
    target: T,
    type: string,
    listener: EventListenerOrEventListenerObject,
    listenerOptions?: boolean | AddEventListenerOptions,
    options?: ResourceOptions
): ResourceHandle<EventListenerOrEventListenerObject> {
    target.addEventListener(type, listener, listenerOptions);
    return scope.register(
        id,
        listener,
        (value) => target.removeEventListener(type, value, listenerOptions),
        options
    );
}

export function trackFluxSubscription<E extends string, Args extends unknown[]>(
    scope: ResourceScope,
    id: string,
    dispatcher: FluxSubscriptionLike<Args>,
    event: E,
    handler: (...args: Args) => void,
    options?: ResourceOptions
): ResourceHandle<(...args: Args) => void> {
    dispatcher.subscribe(event, handler);
    return scope.register(id, handler, (value) => dispatcher.unsubscribe(event, value), options);
}

export function trackDomNode(
    scope: ResourceScope,
    id: string,
    node: Node,
    parent?: Node,
    options?: ResourceOptions
): ResourceHandle<Node> {
    if (parent) parent.appendChild(node);
    return scope.register(
        id,
        node,
        (value) => {
            value.parentNode?.removeChild(value);
        },
        options
    );
}

export function trackAbortController(
    scope: ResourceScope,
    id: string,
    controller = new AbortController(),
    options?: ResourceOptions
): ResourceHandle<AbortController> {
    return scope.register(id, controller, (value) => value.abort(), options);
}

export function trackDisposable<T extends Disposable>(
    scope: ResourceScope,
    id: string,
    disposable: T,
    options?: ResourceOptions
): ResourceHandle<T> {
    return scope.register(id, disposable, (value) => value.dispose(), options);
}

export function trackBridgeRegistration<T extends BridgeRegistrationLike>(
    scope: ResourceScope,
    registration: T,
    options?: ResourceOptions
): ResourceHandle<T> {
    return scope.register(
        `bridge:${registration.id}`,
        registration,
        (value) => value.unregister(),
        options
    );
}
