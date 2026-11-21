export interface ValidationFailure {
    readonly ok: false;
    readonly issues: readonly string[];
}

export interface ValidationSuccess<T> {
    readonly ok: true;
    readonly value: T;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export function fail(...issues: string[]): ValidationFailure {
    return { ok: false, issues };
}

export function pass<T>(value: T): ValidationSuccess<T> {
    return { ok: true, value };
}

export type ExpectedType = "function" | "object" | "string" | "number" | "boolean" | "array";

const TYPE_CHECKS: Record<ExpectedType, (value: unknown) => boolean> = {
    function: (value) => typeof value === "function",
    object: (value) => typeof value === "object" && value !== null && !Array.isArray(value),
    string: (value) => typeof value === "string",
    number: (value) => typeof value === "number" && Number.isFinite(value),
    boolean: (value) => typeof value === "boolean",
    array: (value) => Array.isArray(value),
};

export function validateShape(
    value: unknown,
    shape: Readonly<Record<string, ExpectedType>>
): ValidationResult<Record<string, unknown>> {
    if (!TYPE_CHECKS.object(value)) return fail("Expected an object");
    const record = value as Record<string, unknown>;
    const issues: string[] = [];

    for (const [key, expected] of Object.entries(shape)) {
        if (!TYPE_CHECKS[expected](record[key]))
            issues.push(`Missing or invalid '${key}' (expected ${expected})`);
    }

    return issues.length === 0 ? pass(record) : fail(...issues);
}

export function expectFunctions(
    value: unknown,
    names: readonly string[]
): ValidationResult<Record<string, unknown>> {
    const shape: Record<string, ExpectedType> = {};
    for (const name of names) shape[name] = "function";
    return validateShape(value, shape);
}

export function expectProperties(
    value: unknown,
    names: readonly string[]
): ValidationResult<Record<string, unknown>> {
    if (!TYPE_CHECKS.object(value)) return fail("Expected an object");
    const record = value as Record<string, unknown>;
    const issues = names.filter((name) => !(name in record)).map((name) => `Missing '${name}'`);
    return issues.length === 0 ? pass(record) : fail(...issues);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return TYPE_CHECKS.object(value);
}
