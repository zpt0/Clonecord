import { describe, it, expect, vi } from "vitest";

// Mock Vencord internal modules that errorHandler depends on transitively
vi.mock("../notifications", () => ({ notify: vi.fn() }));
vi.mock("@webpack/common", () => ({ RestAPI: {} }));

import { translateError } from "../errorHandler";

describe("translateError", () => {
    it("returns 'Unknown error' for null/undefined", () => {
        expect(translateError(null)).toBe("Unknown error");
        expect(translateError(undefined)).toBe("Unknown error");
    });

    it("returns the string itself when given a string", () => {
        expect(translateError("something went wrong")).toBe("something went wrong");
    });

    it("returns empty string for Cancelled errors", () => {
        expect(translateError({ message: "Cancelled" })).toBe("");
        expect(translateError({ message: "Request Cancelled" })).toBe("");
    });

    it("returns empty string for Skipped errors", () => {
        expect(translateError({ message: "Skipped" })).toBe("");
    });

    it("translates known Discord error codes", () => {
        expect(translateError({ body: { code: 10003 } })).toBe(
            "Channel not found — it may have been deleted"
        );
        expect(translateError({ body: { code: 50013 } })).toBe(
            "Missing Permissions — your role can't do this"
        );
        expect(translateError({ body: { code: 30002 } })).toBe(
            "Max server limit reached — you own too many servers"
        );
    });

    it("translates known Discord error codes from error.code", () => {
        expect(translateError({ code: 40001 })).toBe("Unauthorized — your token may have expired");
    });

    it("translates HTTP status codes", () => {
        expect(translateError({ status: 429 })).toBe(
            "Rate Limited — too many requests, slowing down"
        );
        expect(translateError({ status: 500 })).toBe("Discord Server Error — try again later");
    });

    it("extracts message from error.body.message", () => {
        expect(translateError({ body: { message: "Custom error" } })).toBe("Custom error");
    });

    it("extracts message from error.message", () => {
        expect(translateError({ message: "Something broke" })).toBe("Something broke");
    });

    it("truncates long messages to 120 characters", () => {
        const longMessage = "A".repeat(200);
        const result = translateError({ message: longMessage });
        expect(result.length).toBe(120);
        expect(result.endsWith("...")).toBe(true);
    });

    it("returns 'Unknown error occurred' when no message is available", () => {
        expect(translateError({})).toBe("Unknown error occurred");
    });

    it("parses error from text field (JSON string)", () => {
        const error = { text: JSON.stringify({ code: 50035, message: "Invalid form body" }) };
        expect(translateError(error)).toBe("Invalid data sent to Discord");
    });
});
