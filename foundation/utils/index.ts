export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function clamp(value: number, min: number, max: number): number {
    if (min > max) throw new RangeError("clamp requires min <= max");
    return Math.min(max, Math.max(min, value));
}

export function uniqueStrings(values: readonly string[]): string[] {
    return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

export function foundationClass(
    ...parts: ReadonlyArray<string | false | null | undefined>
): string {
    return parts
        .filter((part): part is string => typeof part === "string" && part.length > 0)
        .join(" ");
}

export function freezeRecord<T extends Record<string, unknown>>(value: T): Readonly<T> {
    return Object.freeze({ ...value });
}

export function errorText(value: unknown): string {
    if (value instanceof Error) return value.message;
    if (typeof value === "string") return value;
    return String(value);
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        function onAbort() {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        }
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}
