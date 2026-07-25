import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sleep, randomDelay, compareVersions, arrayBufferToBase64, escapeHtml } from "../helpers";

describe("sleep", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("resolves after the specified time", async () => {
        const callback = vi.fn();
        const promise = sleep(1000).then(callback);

        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);
        await promise;

        expect(callback).toHaveBeenCalledOnce();
    });
});

describe("randomDelay", () => {
    it("returns a number within the specified range", () => {
        for (let i = 0; i < 50; i++) {
            const result = randomDelay(100, 500);
            expect(result).toBeGreaterThanOrEqual(100);
            expect(result).toBeLessThanOrEqual(500);
            expect(Number.isInteger(result)).toBe(true);
        }
    });

    it("returns min when min equals max", () => {
        expect(randomDelay(250, 250)).toBe(250);
    });
});

describe("compareVersions", () => {
    it("returns 0 for equal versions", () => {
        expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    });

    it("returns 1 when v1 is greater (major)", () => {
        expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
    });

    it("returns -1 when v1 is lesser (major)", () => {
        expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
    });

    it("returns 1 when v1 is greater (minor)", () => {
        expect(compareVersions("1.2.0", "1.1.0")).toBe(1);
    });

    it("returns -1 when v1 is lesser (patch)", () => {
        expect(compareVersions("1.0.1", "1.0.2")).toBe(-1);
    });

    it("handles versions with different segment counts", () => {
        expect(compareVersions("1.0", "1.0.0")).toBe(0);
        expect(compareVersions("1.0.1", "1.0")).toBe(1);
    });

    it("strips non-numeric prefixes", () => {
        expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
        expect(compareVersions("v2.0.0", "v1.9.9")).toBe(1);
    });
});

describe("arrayBufferToBase64", () => {
    it("encodes an empty buffer", () => {
        const buffer = new ArrayBuffer(0);
        expect(arrayBufferToBase64(buffer)).toBe("");
    });

    it("encodes a simple ASCII string", () => {
        const encoder = new TextEncoder();
        const data = encoder.encode("Hello, World!");
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        expect(arrayBufferToBase64(buffer)).toBe("SGVsbG8sIFdvcmxkIQ==");
    });

    it("encodes binary data correctly", () => {
        const bytes = new Uint8Array([0x00, 0xff, 0x80, 0x7f]);
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        const result = arrayBufferToBase64(buffer);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
    });
});

describe("escapeHtml", () => {
    it("escapes ampersands", () => {
        expect(escapeHtml("a & b")).toBe("a &amp; b");
    });

    it("escapes less-than signs", () => {
        expect(escapeHtml("a < b")).toBe("a &lt; b");
    });

    it("escapes greater-than signs", () => {
        expect(escapeHtml("a > b")).toBe("a &gt; b");
    });

    it("escapes double quotes", () => {
        expect(escapeHtml('a "b" c')).toBe("a &quot;b&quot; c");
    });

    it("escapes single quotes", () => {
        expect(escapeHtml("a 'b' c")).toBe("a &#039;b&#039; c");
    });

    it("escapes multiple special characters", () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe(
            "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
        );
    });

    it("returns empty string for empty input", () => {
        expect(escapeHtml("")).toBe("");
    });

    it("returns string unchanged when no special characters", () => {
        expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
    });
});
