/** Shared, UI-independent release checking for the zpt0 Vencord plugins. */

export type UpdateStatus = "idle" | "checking" | "available" | "current" | "failed" | "disabled";

export interface UpdateTarget {
    readonly pluginName: string;
    readonly version: string;
    readonly checkUrl?: string;
    readonly releasesUrl?: string;
    readonly changelogUrl?: string;
}

export interface UpdateResult {
    readonly pluginName: string;
    readonly status: UpdateStatus;
    readonly checkedAt?: number;
    readonly latestVersion?: string;
    readonly releaseNotes?: string;
    readonly reason?: string;
}

export type UpdateResults = Readonly<Record<string, UpdateResult>>;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface UpdateCheckOptions {
    readonly fetchFn?: FetchLike;
    readonly now?: () => number;
    readonly timeoutMs?: number;
}

const results: Record<string, UpdateResult> = {};
const listeners = new Set<() => void>();

function notify(): void {
    for (const listener of [...listeners]) listener();
}

/** Subscribe to shared update results. Returns an unsubscribe function. */
export function subscribeToUpdates(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getUpdateResults(): UpdateResults {
    return { ...results };
}

export function setUpdateResult(result: UpdateResult): void {
    results[result.pluginName] = result;
    notify();
}

export function clearUpdateResults(): void {
    for (const key of Object.keys(results)) delete results[key];
    notify();
}

export function normalizeReleaseVersion(value: unknown): string {
    return typeof value === "string" ? value.trim().replace(/^v/i, "").trim() : "";
}

/** Numeric dotted-version comparison. Returns > 0 when `left` is newer. */
export function compareVersions(left: string, right: string): number {
    const parse = (value: string) =>
        normalizeReleaseVersion(value)
            .split(/[.+-]/)
            .map((part) => (Number.isFinite(Number(part)) ? Number(part) : 0));

    const a = parse(left);
    const b = parse(right);
    const length = Math.max(a.length, b.length);

    for (let index = 0; index < length; index++) {
        const difference = (a[index] ?? 0) - (b[index] ?? 0);
        if (difference !== 0) return difference > 0 ? 1 : -1;
    }
    return 0;
}

function reasonFromError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** Checks one release feed. Never opens a browser or modal; callers decide what to show. */
export async function checkPluginUpdate(
    target: UpdateTarget,
    options: UpdateCheckOptions = {}
): Promise<UpdateResult> {
    const now = options.now ?? Date.now;
    const checkedAt = now();

    if (!target.checkUrl) {
        return {
            pluginName: target.pluginName,
            status: "disabled",
            checkedAt,
            reason: "No release feed configured for this build",
        };
    }

    const fetchFn = options.fetchFn ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);

    try {
        const response = await fetchFn(target.checkUrl, {
            signal: controller.signal,
            headers: { Accept: "application/vnd.github.v3+json" },
        });

        if (!response.ok) {
            return {
                pluginName: target.pluginName,
                status: "failed",
                checkedAt,
                reason: `Release feed returned HTTP ${response.status}`,
            };
        }

        const data = (await response.json()) as {
            tag_name?: unknown;
            name?: unknown;
            body?: unknown;
        };
        const latestVersion = normalizeReleaseVersion(data.tag_name ?? data.name);

        if (!latestVersion) {
            return {
                pluginName: target.pluginName,
                status: "failed",
                checkedAt,
                reason: "Release feed did not contain a version",
            };
        }

        const isNewer = compareVersions(latestVersion, target.version) > 0;
        return {
            pluginName: target.pluginName,
            status: isNewer ? "available" : "current",
            checkedAt,
            latestVersion,
            releaseNotes: typeof data.body === "string" ? data.body : "",
            reason: isNewer
                ? `v${latestVersion} is newer than installed v${target.version}`
                : `Installed v${target.version} is current`,
        };
    } catch (error) {
        return {
            pluginName: target.pluginName,
            status: "failed",
            checkedAt,
            reason: reasonFromError(error),
        };
    } finally {
        clearTimeout(timeout);
    }
}

/** Runs all checks and publishes each result to the shared store as it finishes. */
export async function runUpdateChecks(
    targets: readonly UpdateTarget[],
    options: UpdateCheckOptions = {}
): Promise<readonly UpdateResult[]> {
    return Promise.all(
        targets.map(async (target) => {
            setUpdateResult({
                pluginName: target.pluginName,
                status: "checking",
                checkedAt: options.now?.() ?? Date.now(),
            });
            const result = await checkPluginUpdate(target, options);
            setUpdateResult(result);
            return result;
        })
    );
}

export function hasAvailableUpdate(
    results: UpdateResults,
    targets: readonly UpdateTarget[]
): boolean {
    return targets.some((target) => results[target.pluginName]?.status === "available");
}

export function updateStatusLabel(status: UpdateStatus): string {
    switch (status) {
        case "available":
            return "Update available";
        case "checking":
            return "Checking...";
        case "current":
            return "Up to date";
        case "failed":
            return "Check failed";
        case "disabled":
            return "Checks disabled";
        case "idle":
            return "Not checked";
    }
}
