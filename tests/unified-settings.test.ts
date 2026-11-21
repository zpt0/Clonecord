import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { OptionType } from "@utils/types";
import { describe, expect, it } from "vitest";

import { SETTINGS_CATEGORY_ORDER, validateUnifiedSettingsConfig } from "../platform/settings";
import { config } from "../components/UnifiedSettings";

const source = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("Clonecord unified settings", () => {
    it("uses the shared category order without empty sections", () => {
        expect(validateUnifiedSettingsConfig(config)).toEqual([]);
        expect(config.categories.map((category) => category.id)).toEqual(
            SETTINGS_CATEGORY_ORDER.filter((id) =>
                config.categories.some((category) => category.id === id)
            )
        );
        for (const category of config.categories) {
            expect(category.groups.length).toBeGreaterThan(0);
        }
    });

    it("defers custom panels until render time", () => {
        for (const category of config.categories) {
            for (const group of category.groups) {
                if (group.render !== undefined) {
                    expect(typeof group.render, group.id).toBe("function");
                }
            }
        }
    });

    it("covers every stored setting with a real control", () => {
        const keys = config.categories.flatMap((category) =>
            category.groups.flatMap((group) => (group.fields ?? []).map((field) => field.key))
        );
        for (const key of Object.keys(config.definition)) {
            if (
                config.definition[key].type === OptionType.COMPONENT ||
                config.definition[key].type === OptionType.CUSTOM
            ) {
                continue;
            }
            expect(keys).toContain(key);
        }
        expect(config.componentKeys).toEqual(["toastSettings"]);
    });

    it("gives every field and action a working info panel", () => {
        for (const category of config.categories) {
            for (const group of category.groups) {
                for (const field of group.fields ?? []) {
                    expect(field.info, field.key).toBeTruthy();
                }
                for (const action of group.actions ?? []) {
                    expect(action.info, action.id).toBeTruthy();
                    expect(typeof action.run).toBe("function");
                }
            }
        }
    });

    it("keeps the native Vencord settings entry", () => {
        const index = source("index.tsx");
        expect(index).toContain("settings,");
        expect(index).toContain("settingsAboutComponent: () => <ClonecordUnifiedSettings />");
    });
});
