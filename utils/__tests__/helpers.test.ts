import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    sleep,
    randomDelay,
    compareVersions,
    arrayBufferToBase64,
    escapeHtml,
    isSafeReleaseUrl,
    parseReleaseBlocks,
    parseReleaseInline,
} from "../helpers";

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

describe("isSafeReleaseUrl", () => {
    it("allows http and https links", () => {
        expect(isSafeReleaseUrl("https://github.com/zpt0/Clonecord")).toBe(true);
        expect(isSafeReleaseUrl("http://example.com/a?b=c")).toBe(true);
    });

    it("rejects javascript and other schemes", () => {
        expect(isSafeReleaseUrl("javascript:alert(1)")).toBe(false);
        expect(isSafeReleaseUrl("data:text/plain,hi")).toBe(false);
        expect(isSafeReleaseUrl("not a url")).toBe(false);
    });
});

describe("parseReleaseInline", () => {
    it("parses bold text", () => {
        expect(parseReleaseInline("a **bold** move")).toEqual([
            { kind: "text", text: "a " },
            { kind: "bold", children: [{ kind: "text", text: "bold" }] },
            { kind: "text", text: " move" },
        ]);
    });

    it("parses italic, strikethrough and code spans", () => {
        expect(parseReleaseInline("*italic* and _also_")).toEqual([
            { kind: "italic", children: [{ kind: "text", text: "italic" }] },
            { kind: "text", text: " and " },
            { kind: "italic", children: [{ kind: "text", text: "also" }] },
        ]);
        expect(parseReleaseInline("~~gone~~")).toEqual([
            { kind: "strike", children: [{ kind: "text", text: "gone" }] },
        ]);
        expect(parseReleaseInline("run `npm test` now")).toEqual([
            { kind: "text", text: "run " },
            { kind: "code", text: "npm test" },
            { kind: "text", text: " now" },
        ]);
    });

    it("keeps code span content literal", () => {
        expect(parseReleaseInline("`## not bold **[x](y)**`")).toEqual([
            { kind: "code", text: "## not bold **[x](y)**" },
        ]);
    });

    it("parses markdown links with safe urls", () => {
        expect(parseReleaseInline("see [releases](https://github.com/a/b)")).toEqual([
            { kind: "text", text: "see " },
            { kind: "link", text: "releases", url: "https://github.com/a/b" },
        ]);
    });

    it("leaves unsafe links as plain text", () => {
        const nodes = parseReleaseInline("[x](javascript:alert(1))");
        expect(nodes.some((node) => node.kind === "link")).toBe(false);
        expect(nodes.map((node) => (node.kind === "text" ? node.text : "")).join("")).toBe(
            "[x](javascript:alert(1))"
        );
    });

    it("ignores intraword underscores like snake_case", () => {
        expect(parseReleaseInline("the roleIdMap helper")).toEqual([
            { kind: "text", text: "the roleIdMap helper" },
        ]);
        expect(parseReleaseInline("some_var stays")).toEqual([
            { kind: "text", text: "some_var stays" },
        ]);
    });

    it("leaves unmatched markers as plain text", () => {
        expect(parseReleaseInline("a ** broken [link](nospace here)")).toEqual([
            { kind: "text", text: "a ** broken [link](nospace here)" },
        ]);
    });

    it("autolinks bare urls", () => {
        expect(parseReleaseInline("see https://example.com/a for details")).toEqual([
            { kind: "text", text: "see " },
            { kind: "link", text: "https://example.com/a", url: "https://example.com/a" },
            { kind: "text", text: " for details" },
        ]);
    });

    it("trims trailing punctuation from bare urls", () => {
        expect(parseReleaseInline("visit https://example.com/a.")).toEqual([
            { kind: "text", text: "visit " },
            { kind: "link", text: "https://example.com/a", url: "https://example.com/a" },
            { kind: "text", text: "." },
        ]);
    });

    it("does not autolink inside code spans", () => {
        expect(parseReleaseInline("`https://example.com/a`")).toEqual([
            { kind: "code", text: "https://example.com/a" },
        ]);
    });

    it("autolinks inside bold text", () => {
        expect(parseReleaseInline("**see https://example.com/a**")).toEqual([
            {
                kind: "bold",
                children: [
                    { kind: "text", text: "see " },
                    { kind: "link", text: "https://example.com/a", url: "https://example.com/a" },
                ],
            },
        ]);
    });
});

describe("parseReleaseBlocks", () => {
    it("returns no blocks for empty input", () => {
        expect(parseReleaseBlocks("")).toEqual([]);
        expect(parseReleaseBlocks("   \r\n  ")).toEqual([]);
    });

    it("parses headings with levels", () => {
        expect(parseReleaseBlocks("## What's Changed")).toEqual([
            { kind: "heading", level: 2, text: "What's Changed" },
        ]);
        expect(parseReleaseBlocks("# Top\n### Deep")).toEqual([
            { kind: "heading", level: 1, text: "Top" },
            { kind: "heading", level: 3, text: "Deep" },
        ]);
    });

    it("keeps single newlines as paragraph lines", () => {
        expect(parseReleaseBlocks("line one\nline two")).toEqual([
            { kind: "paragraph", lines: ["line one", "line two"] },
        ]);
    });

    it("splits paragraphs on blank lines", () => {
        expect(parseReleaseBlocks("para one\n\npara two")).toEqual([
            { kind: "paragraph", lines: ["para one"] },
            { kind: "paragraph", lines: ["para two"] },
        ]);
    });

    it("drops horizontal rules", () => {
        expect(parseReleaseBlocks("above\n---\nbelow")).toEqual([
            { kind: "paragraph", lines: ["above"] },
            { kind: "paragraph", lines: ["below"] },
        ]);
    });

    it("groups consecutive list items and splits on type change", () => {
        expect(parseReleaseBlocks("- a\n- b\n\n1. one\n2. two")).toEqual([
            { kind: "list", ordered: false, items: ["a", "b"] },
            { kind: "list", ordered: true, items: ["one", "two"] },
        ]);
    });

    it("parses quotes and fenced code blocks untouched", () => {
        expect(
            parseReleaseBlocks("> note this\n\n```\n## not a heading\n**no bold**\n```")
        ).toEqual([
            { kind: "quote", lines: ["note this"] },
            { kind: "code", text: "## not a heading\n**no bold**" },
        ]);
    });

    it("normalizes CRLF", () => {
        expect(parseReleaseBlocks("\r\n## Title\r\nbody\r\n")).toEqual([
            { kind: "heading", level: 2, text: "Title" },
            { kind: "paragraph", lines: ["body"] },
        ]);
    });

    it("parses a realistic release body", () => {
        const input =
            "## What's Changed\n\n### Clone engine\n\nFixed the **queue** for big servers.\nSee [releases](https://github.com/a/b) for details.\n\n- item one\n- item two\n\n---\n\n**Full Changelog**: https://github.com/a/b/compare";
        expect(parseReleaseBlocks(input)).toEqual([
            { kind: "heading", level: 2, text: "What's Changed" },
            { kind: "heading", level: 3, text: "Clone engine" },
            {
                kind: "paragraph",
                lines: [
                    "Fixed the **queue** for big servers.",
                    "See [releases](https://github.com/a/b) for details.",
                ],
            },
            { kind: "list", ordered: false, items: ["item one", "item two"] },
            { kind: "paragraph", lines: ["**Full Changelog**: https://github.com/a/b/compare"] },
        ]);
    });
});
