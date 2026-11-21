import type { PatchReplacement, PluginPatch, ReplaceFn } from "@utils/types";

import type { PatchManifestEntry } from "./manifest";

export interface PatchFixtureOptions {
    /** Test-only substitutions for `#{intl::key}` tokens. */
    intl?: Readonly<Record<string, string>>;
    /** Test-only replacement for `$self`. */
    pluginPath?: string;
}

export interface PatchFixture {
    readonly name: string;
    readonly source: string;
    readonly expectedOutput?: string;
    readonly options?: PatchFixtureOptions;
}

export interface PatchFixtureResult {
    readonly ok: boolean;
    readonly issues: readonly string[];
    readonly findMatches: number;
    readonly replacementMatches: readonly number[];
    readonly output: string;
}

function substituteIntl(source: string, intl: Readonly<Record<string, string>> = {}): string {
    return source.replace(
        /#\{intl::([\w$+/]*)(?:::(\w+))?\}/g,
        (_whole, key: string, modifier?: string) => {
            return modifier === "raw" ? key : (intl[key] ?? key);
        }
    );
}

function expandIdentifierTokens(source: string): string {
    return source.replace(/(\\*)\\i/g, (whole, leading: string) =>
        leading.length % 2 === 0 ? `${leading}(?:[A-Za-z_$][\\w$]*)` : whole.slice(1)
    );
}

function toRegExp(value: string | RegExp, intl: Readonly<Record<string, string>>): RegExp {
    const source = expandIdentifierTokens(
        substituteIntl(typeof value === "string" ? value : value.source, intl)
    );
    const flags =
        typeof value === "string"
            ? "g"
            : value.flags.includes("g")
              ? value.flags
              : `${value.flags}g`;
    return new RegExp(source, flags);
}

function countMatches(source: string, pattern: RegExp): number {
    return Array.from(source.matchAll(pattern)).length;
}

function replacementString(replacement: string, pluginPath: string | undefined): string {
    return pluginPath === undefined ? replacement : replacement.replaceAll("$self", pluginPath);
}

function applyReplacement(
    source: string,
    replacement: PatchReplacement,
    options: PatchFixtureOptions
): { output: string; matches: number } {
    const regex = toRegExp(replacement.match, options.intl ?? {});
    const matches = countMatches(source, regex);

    const replaceValue: string | ((match: string, ...groups: string[]) => string) =
        typeof replacement.replace === "function"
            ? (match: string, ...rest: unknown[]) => {
                  const groups = rest
                      .slice(0, Math.max(0, rest.length - 2))
                      .filter((value): value is string => typeof value === "string");
                  return (replacement.replace as ReplaceFn)(match, ...groups);
              }
            : replacementString(replacement.replace, options.pluginPath);

    const output =
        typeof replaceValue === "function"
            ? source.replace(regex, replaceValue)
            : source.replace(regex, replaceValue);
    return { output, matches };
}

function toPatch(value: PluginPatch | PatchManifestEntry): PluginPatch {
    return "patch" in value ? value.patch : value;
}

function expectationIssue(
    label: string,
    count: number,
    expectation: { min: number; max?: number } | undefined
): string | undefined {
    if (!expectation) return count === 0 ? `${label} did not match` : undefined;
    if (count < expectation.min)
        return `${label} matched ${count} times; expected at least ${expectation.min}`;
    if (expectation.max !== undefined && count > expectation.max) {
        return `${label} matched ${count} times; expected at most ${expectation.max}`;
    }
    return undefined;
}

export function runPatchFixture(
    value: PluginPatch | PatchManifestEntry,
    fixture: PatchFixture
): PatchFixtureResult {
    const patch = toPatch(value);
    const entry = "patch" in value ? value : undefined;
    const options = { ...fixture.options };
    const issues: string[] = [];

    const findRegex = toRegExp(patch.find, options.intl ?? {});
    const findMatches = countMatches(fixture.source, findRegex);
    const findIssue = expectationIssue("patch.find", findMatches, entry?.expectations?.find);
    if (findIssue) issues.push(findIssue);

    const replacements = Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement];
    const replacementMatches: number[] = [];
    let output = fixture.source;
    let groupFailed = false;

    for (const [index, replacement] of replacements.entries()) {
        const result = applyReplacement(output, replacement, options);
        replacementMatches.push(result.matches);
        output = result.output;

        const issue = expectationIssue(
            `replacement[${index}]`,
            result.matches,
            entry?.expectations?.replacements
        );
        if (issue && replacement.noWarn !== true) {
            issues.push(issue);
            groupFailed = true;
        }
    }

    if (patch.group === true && replacementMatches.some((count) => count === 0)) {
        issues.push("group patch requires every replacement to match");
        groupFailed = true;
    }

    if (groupFailed) output = fixture.source;

    if (fixture.expectedOutput !== undefined && output !== fixture.expectedOutput) {
        issues.push("output did not match expectedOutput");
    }

    return {
        ok: issues.length === 0,
        issues,
        findMatches,
        replacementMatches,
        output,
    };
}
