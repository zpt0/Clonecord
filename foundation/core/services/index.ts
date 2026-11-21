import type { Disposable } from "../lifecycle";
import { createScopedLogger } from "../logging";

const log = createScopedLogger("foundation/core/services/index");

export type ServiceFactory<T> = () => T;
export type ServiceDisposer<T> = (service: T) => void | Promise<void>;

interface ServiceRecord<T> {
    instance: T;
    dispose?: ServiceDisposer<T>;
}

export class ServiceRegistry implements Disposable {
    private readonly services = new Map<string, ServiceRecord<unknown>>();
    private disposed = false;

    register<T>(id: string, factory: ServiceFactory<T>, dispose?: ServiceDisposer<T>): T {
        if (this.disposed) throw new Error("ServiceRegistry has been disposed");
        if (!id) throw new Error("Service id must be a non-empty string");
        if (this.services.has(id)) throw new Error(`Service is already registered: ${id}`);

        const instance = factory();
        this.services.set(id, { instance, dispose } as ServiceRecord<unknown>);
        return instance;
    }

    get<T>(id: string): T | undefined {
        return this.services.get(id)?.instance as T | undefined;
    }

    has(id: string): boolean {
        return this.services.has(id);
    }

    async dispose(): Promise<void> {
        if (this.disposed) return;
        this.disposed = true;
        const records = Array.from(this.services.entries()).reverse();
        this.services.clear();

        for (const [id, record] of records) {
            if (!record.dispose) continue;
            try {
                await record.dispose(record.instance);
            } catch (error) {
                log.error(`Failed to dispose service ${id}`, error);
            }
        }
    }
}
