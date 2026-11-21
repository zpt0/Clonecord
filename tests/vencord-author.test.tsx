import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { __contributorModalUsers } from "./helpers/vencord-mocks";
import { describe, expect, it } from "vitest";

import { config } from "../components/UnifiedSettings";
import { PLUGIN_AUTHOR } from "../constants";
import { FoundationAuthorPanel } from "../foundation/ui/components";
import type { StubElement } from "./helpers/jsx-runtime";

const source = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

function findElement(
    node: unknown,
    predicate: (element: StubElement) => boolean
): StubElement | undefined {
    if (node === null || typeof node !== "object") return undefined;
    const element = node as StubElement;
    if (!Array.isArray(element.children)) return undefined;
    if (predicate(element)) return element;
    for (const child of element.children) {
        const found = findElement(child, predicate);
        if (found) return found;
    }
    return undefined;
}

function aboutPanel(): StubElement {
    for (const category of config.categories) {
        for (const group of category.groups) {
            if (group.id === "clonecord-about") {
                expect(group.render).toBeTypeOf("function");
                const render = group.render as unknown as () => StubElement;
                const tree = render();
                const panel = findElement(
                    tree,
                    (element) => element.type === FoundationAuthorPanel
                );
                expect(panel, "About tab must render FoundationAuthorPanel").toBeDefined();
                return panel!;
            }
        }
    }
    throw new Error("Clonecord about group not found");
}

describe("Clonecord Vencord author integration", () => {
    it("wires the manifest author into the About tab", () => {
        expect(aboutPanel().props.authors).toEqual([PLUGIN_AUTHOR]);
    });

    it("opens Vencord's contributor modal with a user that matches the manifest author", () => {
        __contributorModalUsers.length = 0;

        const panel = aboutPanel();
        const component = panel.type as typeof FoundationAuthorPanel;
        const tree = component(
            panel.props as unknown as Parameters<typeof FoundationAuthorPanel>[0]
        ) as unknown as StubElement;
        const button = findElement(
            tree,
            (element) => element.type === "button" && element.props.className === "vpf-author-row"
        );
        expect(button).toBeDefined();

        (button!.props.onClick as () => void)();

        expect(__contributorModalUsers).toHaveLength(1);
        const user = __contributorModalUsers[0] as {
            id?: string;
            username?: string;
            bot?: boolean;
            getAvatarURL(): string;
        };
        expect(user.id).toBe(String(PLUGIN_AUTHOR.id));
        // ContributorModal matches plugins by author name, so this must be the manifest name.
        expect(user.username).toBe(PLUGIN_AUTHOR.name);
        expect(user.bot).toBe(true);
        expect(user.getAvatarURL()).toMatch(/^https:\/\/cdn\.discordapp\.com\/embed\/avatars\//);
    });

    it("keeps the native authors field and uses no custom modal", () => {
        const index = source("index.tsx");
        expect(index).toContain(`name: "${PLUGIN_AUTHOR.name}"`);
        expect(index).toContain(`id: ${PLUGIN_AUTHOR.id}n`);

        const components = source("foundation/ui/components.tsx");
        expect(components).toContain("openContributorModal");
        expect(components).not.toContain("FoundationAuthorModal");
        expect(components).not.toContain("vpf-author-modal-plugin");
    });
});
