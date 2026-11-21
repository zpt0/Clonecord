import type { Disposable } from "./lifecycle";

export type StateListener<T> = (next: T, previous: T) => void;

export interface StateStore<T> extends Disposable {
    readonly value: T;
    get(): T;
    set(next: T): void;
    update(updater: (current: T) => T): void;
    subscribe(listener: StateListener<T>): () => void;
    readonly listenerCount: number;
}

export function createState<T>(initial: T): StateStore<T> {
    let current = initial;
    let disposed = false;
    const listeners = new Set<StateListener<T>>();

    const store: StateStore<T> = {
        get value() {
            return current;
        },
        get listenerCount() {
            return listeners.size;
        },
        get() {
            return current;
        },
        set(next) {
            if (disposed) return;
            if (Object.is(current, next)) return;
            const previous = current;
            current = next;
            for (const listener of Array.from(listeners)) listener(next, previous);
        },
        update(updater) {
            store.set(updater(current));
        },
        subscribe(listener) {
            if (disposed) return () => undefined;
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            listeners.clear();
        },
    };

    return store;
}
