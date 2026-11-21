import { Card } from "@components/Card";
import { Heading } from "@components/Heading";
import { describe, expect, it } from "vitest";

import { FoundationCard } from "../foundation/ui/components";
import type { StubElement } from "./helpers/jsx-runtime";

function child(element: StubElement, index: number): StubElement {
    const value = element.children[index];
    expect(typeof value).toBe("object");
    return value as StubElement;
}

describe("Clonecord foundation component wrapper", () => {
    it("renders the foundation card with its title, body, and caller class", () => {
        const element = FoundationCard({
            title: "Reset options",
            variant: "info",
            className: "vc-clonecord-settings-foundation-card",
            children: "card body",
        }) as unknown as StubElement;

        expect(element.type).toBe(Card);
        expect(element.props.className).toContain("vpf-card");
        expect(element.props.className).toContain("vc-clonecord-settings-foundation-card");
        expect(element.props.variant).toBe("info");

        const heading = child(element, 0);
        expect(heading.type).toBe(Heading);
        expect(heading.props.className).toBe("vpf-card-title");
        expect(heading.children).toEqual(["Reset options"]);

        const body = child(element, 1);
        expect(body.props.className).toBe("vpf-card-body");
        expect(body.children).toEqual(["card body"]);
    });

    it("omits the body container when there are no children", () => {
        const element = FoundationCard({ title: "Empty card" }) as unknown as StubElement;
        expect(element.children).toHaveLength(2);
        expect(child(element, 0).children).toEqual(["Empty card"]);
        expect(element.children[1]).toBeNull();
    });
});
