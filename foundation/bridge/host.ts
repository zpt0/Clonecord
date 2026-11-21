import { BridgeError, err, ok, type Result } from "../core/errors";
import {
    bridgeError,
    bridgeSuccess,
    BRIDGE_CAPABILITIES,
    BRIDGE_CONTRACT_VERSION,
    isBridgeRequest,
    sanitizeBridgeValue,
    type BridgeCapability,
    type BridgeDescriptor,
    type BridgeHandlerMap,
    type BridgeRegistration,
    type BridgeRegistrationRequest,
    type BridgeRequest,
    type BridgeResponse,
} from "./contract";

interface InternalRegistration extends BridgeRegistration {
    readonly handlers: BridgeHandlerMap;
}

export interface BridgeHostOptions {
    /** Optional owner label used only in declarative bridge.info responses. */
    readonly ownerName?: string;
}

export interface BridgeHost {
    readonly version: typeof BRIDGE_CONTRACT_VERSION;
    readonly ownerName: string;
    register(request: BridgeRegistrationRequest): Result<BridgeRegistration, BridgeError>;
    handleRequest(request: unknown): Promise<BridgeResponse>;
    listRegistrations(): readonly BridgeDescriptor[];
    unregisterAll(): void;
}

function rejection(message: string, details?: Record<string, unknown>): Result<never, BridgeError> {
    return err(new BridgeError(message, details === undefined ? undefined : { details }));
}

function validateRegistrationRequest(
    request: BridgeRegistrationRequest
): Result<BridgeRegistrationRequest, BridgeError> {
    if (!request.pluginName || !request.pluginName.trim())
        return rejection("Bridge registration requires a plugin name");
    if (!Array.isArray(request.capabilities) || request.capabilities.length === 0) {
        return rejection("Bridge registration requires at least one capability");
    }
    const capabilities = request.capabilities as readonly BridgeCapability[];
    if (new Set(capabilities).size !== capabilities.length) {
        return rejection("Bridge registration capabilities must be unique");
    }
    if (
        capabilities.some(
            (capability) => !(BRIDGE_CAPABILITIES as readonly string[]).includes(capability)
        )
    ) {
        return rejection("Bridge registration contains an unknown capability");
    }
    if (!request.handlers || typeof request.handlers !== "object") {
        return rejection("Bridge registration requires a handler map");
    }
    for (const capability of capabilities) {
        if (typeof request.handlers[capability] !== "function") {
            return rejection(`Bridge registration requires a handler for ${capability}`);
        }
    }
    for (const [capability, handler] of Object.entries(request.handlers)) {
        if (handler !== undefined && typeof handler !== "function") {
            return rejection(`Bridge handler must be a function for ${capability}`);
        }
    }
    return ok(request);
}

export function createBridgeHost(options: BridgeHostOptions = {}): BridgeHost {
    const registrations = new Map<string, InternalRegistration>();
    const ownerName = options.ownerName ?? "foundation";

    const host: BridgeHost = {
        version: BRIDGE_CONTRACT_VERSION,
        ownerName,

        register(request) {
            if (request.canRegister && !request.canRegister()) {
                return rejection("Bridge registration is disabled");
            }
            const validated = validateRegistrationRequest(request);
            if (!validated.ok) return validated;

            const { pluginName, capabilities, handlers } = validated.value;
            if (registrations.has(pluginName)) {
                return rejection(`Bridge registration already exists for ${pluginName}`);
            }

            let unregistered = false;
            const descriptor: BridgeDescriptor = {
                id: `plugin:${pluginName}`,
                pluginName,
                version: BRIDGE_CONTRACT_VERSION,
                capabilities: Object.freeze([...capabilities]) as readonly BridgeCapability[],
            };

            const registration: InternalRegistration = {
                ...descriptor,
                handlers,
                unregister() {
                    if (unregistered) return;
                    unregistered = true;
                    registrations.delete(pluginName);
                },
            };

            registrations.set(pluginName, registration);
            return ok(registration);
        },

        async handleRequest(value) {
            if (!isBridgeRequest(value)) {
                return bridgeError("INVALID_REQUEST", "Unsupported bridge request");
            }
            const request: BridgeRequest = value;
            const requestId = request.requestId;

            if (request.capability === "bridge.info") {
                return bridgeSuccess(
                    {
                        version: BRIDGE_CONTRACT_VERSION,
                        owner: ownerName,
                        capabilities: [...BRIDGE_CAPABILITIES],
                        registrations: host.listRegistrations().map((registration) => ({
                            pluginName: registration.pluginName,
                            capabilities: [...registration.capabilities],
                        })),
                    },
                    requestId
                );
            }

            const registration = Array.from(registrations.values()).find((candidate) =>
                candidate.capabilities.includes(request.capability)
            );
            if (!registration) {
                return bridgeError(
                    "CAPABILITY_UNAVAILABLE",
                    `No registration provides ${request.capability}`,
                    requestId
                );
            }

            const handler = registration.handlers[request.capability];
            if (!handler) {
                return bridgeError(
                    "CAPABILITY_UNAVAILABLE",
                    `No handler for ${request.capability}`,
                    requestId
                );
            }

            try {
                const raw = await handler(request);
                const sanitized = sanitizeBridgeValue(raw);
                if (!sanitized.ok) {
                    return bridgeError(
                        "INVALID_RESPONSE",
                        `Handler returned ${sanitized.issue}`,
                        requestId
                    );
                }
                return bridgeSuccess(sanitized.value, requestId);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return bridgeError("HANDLER_FAILED", message, requestId);
            }
        },

        listRegistrations() {
            return Object.freeze(
                Array.from(registrations.values()).map(
                    ({ id, pluginName, version, capabilities }) => ({
                        id,
                        pluginName,
                        version,
                        capabilities,
                    })
                )
            );
        },

        unregisterAll() {
            for (const registration of Array.from(registrations.values()))
                registration.unregister();
        },
    };

    return host;
}
