export interface FoundationErrorOptions {
    cause?: unknown;
    details?: Readonly<Record<string, unknown>>;
}

export class FoundationError extends Error {
    readonly code: string;
    readonly details: Readonly<Record<string, unknown>>;

    constructor(code: string, message: string, options: FoundationErrorOptions = {}) {
        super(message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = "FoundationError";
        this.code = code;
        this.details = Object.freeze({ ...options.details });
    }

    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            details: this.details,
        };
    }
}

export class ResourceError extends FoundationError {
    constructor(message: string, options?: FoundationErrorOptions) {
        super("RESOURCE_ERROR", message, options);
        this.name = "ResourceError";
    }
}

export class StartupError extends FoundationError {
    constructor(message: string, options?: FoundationErrorOptions) {
        super("STARTUP_ERROR", message, options);
        this.name = "StartupError";
    }
}

export class SettingsArchitectureError extends FoundationError {
    constructor(message: string, options?: FoundationErrorOptions) {
        super("SETTINGS_ARCHITECTURE_ERROR", message, options);
        this.name = "SettingsArchitectureError";
    }
}

export class DiscoveryError extends FoundationError {
    constructor(message: string, options?: FoundationErrorOptions) {
        super("DISCOVERY_ERROR", message, options);
        this.name = "DiscoveryError";
    }
}

export class PatchManifestError extends FoundationError {
    constructor(message: string, options?: FoundationErrorOptions) {
        super("PATCH_MANIFEST_ERROR", message, options);
        this.name = "PatchManifestError";
    }
}

export class BridgeError extends FoundationError {
    constructor(message: string, options?: FoundationErrorOptions) {
        super("BRIDGE_ERROR", message, options);
        this.name = "BridgeError";
    }
}

export interface Ok<T> {
    readonly ok: true;
    readonly value: T;
}

export interface Err<E> {
    readonly ok: false;
    readonly error: E;
}

export type Result<T, E = FoundationError> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
    return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
    return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
    return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
    return !result.ok;
}

export function unwrap<T, E>(result: Result<T, E>): T {
    if (isOk(result)) return result.value;
    throw result.error instanceof Error ? result.error : new Error(String(result.error));
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
    return isOk(result) ? result.value : fallback;
}

export function mapResult<T, U, E>(result: Result<T, E>, map: (value: T) => U): Result<U, E> {
    return isOk(result) ? ok(map(result.value)) : result;
}

export function tryResult<T>(fn: () => T): Result<T, FoundationError> {
    try {
        return ok(fn());
    } catch (error) {
        return err(toFoundationError("UNEXPECTED_ERROR", "Operation failed", error));
    }
}

export async function tryResultAsync<T>(fn: () => Promise<T>): Promise<Result<T, FoundationError>> {
    try {
        return ok(await fn());
    } catch (error) {
        return err(toFoundationError("UNEXPECTED_ERROR", "Async operation failed", error));
    }
}

export function toFoundationError(
    code: string,
    fallbackMessage: string,
    value: unknown
): FoundationError {
    if (value instanceof FoundationError) return value;
    if (value instanceof Error) {
        return new FoundationError(code, value.message || fallbackMessage, { cause: value });
    }
    return new FoundationError(code, fallbackMessage, { details: { value } });
}

export function errorMessage(value: unknown): string {
    if (value instanceof Error) return value.message;
    if (typeof value === "string") return value;
    return String(value);
}
