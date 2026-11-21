import { describe, expect, it } from "vitest";

import { DesignPreview } from "../components/DesignPreview";
import { LivePreviewSurface } from "../platform/settings";
import type { StubElement } from "./helpers/jsx-runtime";

function isStubElement(value: unknown): value is StubElement {
    return typeof value === "object" && value !== null && "type" in value && "props" in value;
}

function collect(element: StubElement): StubElement[] {
    return [
        element,
        ...element.children.flatMap((child) => (isStubElement(child) ? collect(child) : [])),
    ];
}

describe("Clonecord design preview", () => {
    it("uses the live toast classes and default geometry for every bubble", () => {
        const preview = DesignPreview() as unknown as StubElement;
        expect(preview.type).toBe(LivePreviewSurface);

        const elements = collect(preview);
        const classNames = elements
            .map((element) => element.props.className)
            .filter((value): value is string => typeof value === "string");

        expect(classNames).toContain("cloner-toast-container");
        expect(classNames).toContain("cloner-pill always-expanded");
        expect(classNames).toContain("cloner-pill-spinner");
        expect(classNames).toContain("cloner-pill-progress-bar");
        expect(classNames).toContain("cloner-pill-progress-fill");
        expect(classNames).toContain("cloner-pill-actions");
        expect(classNames).toContain("cloner-sub-pill success");
        expect(classNames).toContain("cloner-sub-pill info");
        expect(classNames).toContain("cloner-sub-pill error");
        expect(classNames.filter((name) => name === "cloner-toast-close")).toHaveLength(3);

        const container = elements.find(
            (element) => element.props.className === "cloner-toast-container"
        );
        expect(container).toBeDefined();
        expect(container!.props["data-style"]).toBe("glass");
        expect(container!.props["data-pos"]).toBe("top-right");

        const style = container!.props.style as Record<string, string | number>;
        expect(style["--cc-toast-max-width"]).toBe("400px");
        expect(style["--cc-toast-radius"]).toBe("10px");
        expect(style["--cc-toast-font-size"]).toBe("13px");
        expect(style["--cc-toast-padding"]).toBe("10px");
        expect(style["--cc-toast-bg"]).toBe("rgba(0,0,0,0.85)");
        expect(style["--cc-accent"]).toBe("#5865f2");
        expect(style["--cc-border"]).toBe("rgba(255,255,255,0.08)");
    });
});
