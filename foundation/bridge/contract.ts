export const BRIDGE_CONTRACT_VERSION = 1 as const;

export const BRIDGE_CAPABILITIES = Object.freeze([
    "bridge.info",
    "lifecycle.status",
    "settings.describe",
    "diagnostics.summary",
] as const);

export type BridgeCapability = (typeof BRIDGE_CAPABILITIES)[number];
export type BridgeAction = "describe" | "status" | "schema" | "summary";

export const CAPABILITY_ACTIONS: Readonly<Record<BridgeCapability, BridgeAction>> = Object.freeze({
    "bridge.info": "describe",
    "lifecycle.status": "status",
    "settings.describe": "schema",
    "diagnostics.summary": "summary",
});

export type BridgePrimitive = string | number | boolean | null;
export type BridgeJson = BridgePrimitive | BridgeJson[] | { [key: string]: BridgeJson };

export interface BridgeRequest {
    readonly version: typeof BRIDGE_CONTRACT_VERSION;
    readonly capability: BridgeCapability;
    readonly action: BridgeAction;
    readonly requestId?: string;
}

export interface BridgeSuccessResponse {
    readonly version: typeof BRIDGE_CONTRACT_VERSION;
    readonly ok: true;
    readonly data: BridgeJson;
    readonly requestId?: string;
}

export interface BridgeErrorResponse {
    readonly version: typeof BRIDGE_CONTRACT_VERSION;
    readonly ok: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
    };
    readonly requestId?: string;
}

export type BridgeResponse = BridgeSuccessResponse | BridgeErrorResponse;

export interface BridgeDescriptor {
    readonly id: string;
    readonly pluginName: string;
    readonly version: typeof BRIDGE_CONTRACT_VERSION;
    readonly capabilities: readonly BridgeCapability[];
}

export interface BridgeRegistration extends BridgeDescriptor {
    unregister(): void;
}

export type BridgeHandler = (request: BridgeRequest) => BridgeJson | Promise<BridgeJson>;
export type BridgeHandlerMap = Partial<Record<BridgeCapability, BridgeHandler>>;

export interface BridgeRegistrationRequest {
    readonly pluginName: string;
    readonly capabilities: readonly BridgeCapability[];
    readonly handlers: BridgeHandlerMap;
    /** Returning false rejects registration without exposing any plugin state. */
    canRegister?(): boolean;
}

export function isBridgeCapability(value: unknown): value is BridgeCapability {
    return typeof value === "string" && (BRIDGE_CAPABILITIES as readonly string[]).includes(value);
}

export function isBridgeRequest(value: unknown): value is BridgeRequest {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const request = value as Record<string, unknown>;
    if (request.version !== BRIDGE_CONTRACT_VERSION) return false;
    if (!isBridgeCapability(request.capability)) return false;
    if (CAPABILITY_ACTIONS[request.capability] !== request.action) return false;
    return request.requestId === undefined || typeof request.requestId === "string";
}

type SanitizeResult =
    | { readonly ok: true; readonly value: BridgeJson }
    | { readonly ok: false; readonly issue: string };

/** Converts handler output into a JSON-like value and rejects functions, symbols, bigint, and cycles. */
export function sanitizeBridgeValue(value: unknown, seen = new WeakSet<object>()): SanitizeResult {
    if (value === null || typeof value === "string" || typeof value === "boolean")
        return { ok: true, value };
    if (typeof value === "number") {
        return Number.isFinite(value)
            ? { ok: true, value }
            : { ok: false, issue: "non-finite number" };
    }
    if (typeof value === "bigint") return { ok: false, issue: "bigint is not allowed" };
    if (typeof value === "function") return { ok: false, issue: "function is not allowed" };
    if (typeof value === "symbol") return { ok: false, issue: "symbol is not allowed" };
    if (typeof value !== "object") return { ok: false, issue: "unsupported value" };
    if (seen.has(value)) return { ok: false, issue: "circular value" };
    seen.add(value);

    try {
        if (Array.isArray(value)) {
            const output: BridgeJson[] = [];
            for (const item of value) {
                const sanitized = sanitizeBridgeValue(item, seen);
                if (!sanitized.ok) return sanitized;
                output.push(sanitized.value);
            }
            return { ok: true, value: output };
        }

        const output: { [key: string]: BridgeJson } = {};
        for (const [key, item] of Object.entries(value)) {
            const sanitized = sanitizeBridgeValue(item, seen);
            if (!sanitized.ok) return sanitized;
            output[key] = sanitized.value;
        }
        return { ok: true, value: output };
    } finally {
        seen.delete(value);
    }
}

export function bridgeError(
    code: string,
    message: string,
    requestId?: string
): BridgeErrorResponse {
    return {
        version: BRIDGE_CONTRACT_VERSION,
        ok: false,
        error: { code, message },
        ...(requestId === undefined ? {} : { requestId }),
    };
}

export function bridgeSuccess(data: BridgeJson, requestId?: string): BridgeSuccessResponse {
    return {
        version: BRIDGE_CONTRACT_VERSION,
        ok: true,
        data,
        ...(requestId === undefined ? {} : { requestId }),
    };
}
