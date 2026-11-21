import { SETTING_SECTIONS, type FoundationSettingMeta, type SettingSection } from "./types";

export function isSettingSection(value: unknown): value is SettingSection {
    return typeof value === "string" && (SETTING_SECTIONS as readonly string[]).includes(value);
}

export function sectionRank(section: SettingSection): number {
    return SETTING_SECTIONS.indexOf(section);
}

export function sortSettingsBySection<
    T extends Record<string, { readonly foundation: FoundationSettingMeta }>,
>(definition: T): T {
    const entries = Object.entries(definition);
    const sorted = entries
        .map(([key, value], index) => ({ key, value, index }))
        .sort((a, b) => {
            const rank =
                sectionRank(a.value.foundation.section) - sectionRank(b.value.foundation.section);
            if (rank !== 0) return rank;
            const order =
                (a.value.foundation.order ?? a.index) - (b.value.foundation.order ?? b.index);
            return order !== 0 ? order : a.index - b.index;
        });

    return Object.fromEntries(sorted.map(({ key, value }) => [key, value])) as T;
}
