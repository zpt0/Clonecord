import * as VencordWebpack from "@webpack";

import type { ValidationResult } from "./validators";

export type ModuleFilter = (module: unknown) => boolean;

export interface WebpackAdapter {
    find(filter: ModuleFilter): unknown;
    waitFor(filter: ModuleFilter, callback: (module: unknown) => void): void;
}

export interface ModuleDescriptor<T> {
    readonly id: string;
    readonly description: string;
    readonly filter: ModuleFilter;
    validate(value: unknown): ValidationResult<T>;
    readonly wait?: boolean;
    readonly timeoutMs?: number;
}

export interface DiscoveryFailure {
    readonly id: string;
    readonly description: string;
    readonly issues: readonly string[];
}

export interface DiscoveryResult {
    readonly modules: Readonly<Record<string, unknown>>;
    readonly failures: readonly DiscoveryFailure[];
    readonly ok: boolean;
}

const defaultAdapter: WebpackAdapter = {
    find: (filter) => VencordWebpack.find(filter),
    waitFor: (filter, callback) => VencordWebpack.waitFor(filter, callback),
};

export class ModuleRegistry {
    private readonly descriptors = new Map<string, ModuleDescriptor<unknown>>();
    private modules: Record<string, unknown> = {};

    constructor(private readonly adapter: WebpackAdapter = defaultAdapter) {}

    register<T>(descriptor: ModuleDescriptor<T>): void {
        if (!descriptor.id) throw new Error("Module descriptor id must be a non-empty string");
        if (this.descriptors.has(descriptor.id)) {
            throw new Error(`Module descriptor is already registered: ${descriptor.id}`);
        }
        this.descriptors.set(descriptor.id, descriptor as ModuleDescriptor<unknown>);
    }

    has(id: string): boolean {
        return this.descriptors.has(id);
    }

    get<T>(id: string): T | undefined {
        return this.modules[id] as T | undefined;
    }

    discover(): DiscoveryResult {
        const modules: Record<string, unknown> = {};
        const failures: DiscoveryFailure[] = [];

        for (const descriptor of this.descriptors.values()) {
            if (descriptor.wait) continue;

            const candidate = this.adapter.find(descriptor.filter);
            const validation = descriptor.validate(candidate);
            if (validation.ok) {
                modules[descriptor.id] = validation.value;
            } else {
                failures.push({
                    id: descriptor.id,
                    description: descriptor.description,
                    issues: validation.issues,
                });
            }
        }

        this.modules = modules;
        return { modules, failures, ok: failures.length === 0 };
    }

    async discoverAsync(): Promise<DiscoveryResult> {
        const result = this.discover();
        const modules = { ...result.modules };
        const failures = [...result.failures];

        for (const descriptor of this.descriptors.values()) {
            if (!descriptor.wait) continue;

            try {
                const candidate = await this.waitForModule(descriptor);
                const validation = descriptor.validate(candidate);
                if (validation.ok) {
                    modules[descriptor.id] = validation.value;
                } else {
                    failures.push({
                        id: descriptor.id,
                        description: descriptor.description,
                        issues: validation.issues,
                    });
                }
            } catch (error) {
                failures.push({
                    id: descriptor.id,
                    description: descriptor.description,
                    issues: [error instanceof Error ? error.message : String(error)],
                });
            }
        }

        this.modules = modules;
        return { modules, failures, ok: failures.length === 0 };
    }

    reset(): void {
        this.modules = {};
    }

    private waitForModule(descriptor: ModuleDescriptor<unknown>): Promise<unknown> {
        return new Promise((resolve, reject) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error(`Timed out waiting for module ${descriptor.id}`));
            }, descriptor.timeoutMs ?? 5000);

            this.adapter.waitFor(descriptor.filter, (module) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                resolve(module);
            });
        });
    }
}

export function createModuleRegistry(adapter?: WebpackAdapter): ModuleRegistry {
    return new ModuleRegistry(adapter);
}
