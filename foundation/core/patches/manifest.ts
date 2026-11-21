import type { Patch, PatchReplacement, PluginPatch } from "@utils/types";

import { PatchManifestError } from "../errors";

export interface MatchExpectation {
    readonly min: number;
    readonly max?: number;
}

export interface PatchExpectations {
    readonly find?: MatchExpectation;
    /** Applied to each replacement individually. */
    readonly replacements?: MatchExpectation;
}

export interface PatchManifestEntry {
    readonly id: string;
    readonly description: string;
    readonly module: string;
    readonly patch: PluginPatch;
    readonly expectations?: PatchExpectations;
    /** Required when `noWarn` is enabled on the patch or any replacement. */
    readonly noWarnReason?: string;
}

export interface PatchManifest {
    readonly entries: readonly PatchManifestEntry[];
    toVencordPatches(pluginName: string): Patch[];
}

function asReplacements(value: PatchReplacement | PatchReplacement[]): readonly PatchReplacement[] {
    return Array.isArray(value) ? value : [value];
}

export function validatePatchManifest(entries: readonly PatchManifestEntry[]): readonly string[] {
    const issues: string[] = [];
    const seen = new Set<string>();

    for (const [index, entry] of entries.entries()) {
        const where = `entries[${index}]`;
        if (!entry.id) issues.push(`${where}: id must be a non-empty string`);
        if (seen.has(entry.id)) issues.push(`${where}: duplicate patch id '${entry.id}'`);
        seen.add(entry.id);
        if (!entry.description) issues.push(`${where}: description is required`);
        if (!entry.module) issues.push(`${where}: module is required`);

        const patch = entry.patch;
        if (!patch || (typeof patch.find !== "string" && !(patch.find instanceof RegExp))) {
            issues.push(`${where}: patch.find must be a string or RegExp`);
        }

        const replacements = patch ? asReplacements(patch.replacement) : [];
        if (replacements.length === 0) {
            issues.push(`${where}: patch.replacement must contain at least one entry`);
        }

        for (const [replacementIndex, replacement] of replacements.entries()) {
            const label = `${where}.replacement[${replacementIndex}]`;
            if (!replacement || typeof replacement !== "object") {
                issues.push(`${label}: must be a patch replacement object`);
                continue;
            }
            if (typeof replacement.match !== "string" && !(replacement.match instanceof RegExp)) {
                issues.push(`${label}.match must be a string or RegExp`);
            }
            if (
                typeof replacement.replace !== "string" &&
                typeof replacement.replace !== "function"
            ) {
                issues.push(`${label}.replace must be a string or function`);
            }
            if (
                replacement.fromBuild !== undefined &&
                replacement.toBuild !== undefined &&
                replacement.fromBuild > replacement.toBuild
            ) {
                issues.push(`${label}: fromBuild must be <= toBuild`);
            }
        }

        const usesNoWarn =
            patch?.noWarn === true ||
            replacements.some((replacement) => replacement?.noWarn === true);
        if (usesNoWarn && !entry.noWarnReason?.trim()) {
            issues.push(`${where}: noWarn requires a non-empty noWarnReason`);
        }

        if (
            patch?.fromBuild !== undefined &&
            patch.toBuild !== undefined &&
            patch.fromBuild > patch.toBuild
        ) {
            issues.push(`${where}: fromBuild must be <= toBuild`);
        }
    }

    return issues;
}

export function definePatchManifest(entries: readonly PatchManifestEntry[]): PatchManifest {
    const issues = validatePatchManifest(entries);
    if (issues.length > 0) {
        throw new PatchManifestError("Invalid patch manifest", { details: { issues } });
    }

    return {
        entries: Object.freeze([...entries]),
        toVencordPatches(pluginName) {
            return entries.map((entry) => {
                const patch = entry.patch;
                const result: Patch = {
                    plugin: pluginName,
                    find: patch.find,
                    replacement: Array.isArray(patch.replacement)
                        ? [...patch.replacement]
                        : { ...patch.replacement },
                };

                if (patch.all !== undefined) result.all = patch.all;
                if (patch.noWarn !== undefined) result.noWarn = patch.noWarn;
                if (patch.group !== undefined) result.group = patch.group;
                if (patch.predicate !== undefined) result.predicate = patch.predicate;
                if (patch.fromBuild !== undefined) result.fromBuild = patch.fromBuild;
                if (patch.toBuild !== undefined) result.toBuild = patch.toBuild;

                return result;
            });
        },
    };
}
