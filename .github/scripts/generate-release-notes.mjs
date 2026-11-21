/* global process, URL, fetch, console */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const repoRoot = process.cwd();
const packageJson = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8")
);
const repoSlug = String(packageJson.name ?? "plugin")
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
const repositoryUrl = String(packageJson.repository?.url ?? "");
const urlMatch = repositoryUrl.match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/);
const [envOwner, envRepo] = String(process.env.GITHUB_REPOSITORY ?? "").split("/");
const owner = envOwner || urlMatch?.[1];
const repo = envRepo || urlMatch?.[2];

const now = new Date();
const date = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
].join("");
const dateLabel = now.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "2-digit",
});
const releaseKind = process.env.RELEASE_KIND === "stable" ? "stable" : "nightly";
const isStable = releaseKind === "stable";
const currentTag =
    process.env.RELEASE_TAG ||
    process.env.NIGHTLY_TAG ||
    (isStable ? `v${packageJson.version}` : `nightly-${date}`);
const notesFile =
    process.env.NOTES_FILE || (isStable ? "release-notes.md" : "nightly-release-notes.md");

function git(args) {
    try {
        return execFileSync("git", args, {
            cwd: repoRoot,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
    } catch (error) {
        const detail = error.stderr?.toString().trim() || error.message;
        throw new Error(`git ${args.join(" ")} failed: ${detail}`);
    }
}

function writeOutput(name, value) {
    if (!process.env.GITHUB_OUTPUT) return;
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function count(value, singular, plural = `${singular}s`) {
    return `${value} ${value === 1 ? singular : plural}`;
}

const shortSha = git(["rev-parse", "--short", "HEAD"]).trim();

let baseRef;
let baseLabel;
try {
    baseRef = git([
        "describe",
        "--tags",
        "--abbrev=0",
        "--match",
        "v[0-9]*.[0-9]*.[0-9]*",
        "--exclude",
        currentTag,
        "--exclude",
        "*-*",
    ]).trim();
    baseLabel = baseRef;
    try {
        git(["merge-base", "--is-ancestor", baseRef, "HEAD"]);
    } catch {
        throw new Error(
            `Base tag ${baseRef} is not reachable from HEAD; refusing to generate notes.`
        );
    }
} catch (error) {
    if (String(error.message).includes("not reachable")) throw error;
    baseRef = git(["rev-list", "--max-parents=0", "HEAD"]).trim().split("\n")[0];
    baseLabel = `${baseRef.slice(0, 7)} (initial commit)`;
}

const rawCommits = git([
    "log",
    "--no-merges",
    `--pretty=format:%H%x1f%an%x1f%ae%x1f%s%x1e`,
    `${baseRef}..HEAD`,
]);
const commits = rawCommits
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
        const [hash, name, email, ...subjectParts] = record.split("\x1f");
        return { hash, name, email, subject: subjectParts.join("\x1f") };
    });

const prRefs = new Set();
for (const commit of commits) {
    const match = commit.subject.match(/\(#(\d+)\)$/);
    if (match) prRefs.add(match[1]);
}

const fileCache = new Map();
function filesFor(commit) {
    if (!fileCache.has(commit.hash)) {
        const files = git([
            "diff-tree",
            "--no-commit-id",
            "--name-only",
            "-r",
            "--root",
            commit.hash,
        ])
            .split("\n")
            .map((file) => file.trim())
            .filter(Boolean);
        fileCache.set(commit.hash, files);
    }
    return fileCache.get(commit.hash);
}

const shortstat = git(["diff", "--shortstat", baseRef, "HEAD"]).trim();
const statMatch = shortstat.match(
    /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/
);
const filesChanged = statMatch ? Number(statMatch[1]) : 0;
const insertions = statMatch?.[2] ? Number(statMatch[2]) : 0;
const deletions = statMatch?.[3] ? Number(statMatch[3]) : 0;

const botPattern = /(\[bot\]|github-actions|dependabot|renovate)/i;
const contributorMap = new Map();
for (const commit of commits) {
    if (botPattern.test(commit.name) || botPattern.test(commit.email)) continue;
    const key = commit.email || commit.name;
    if (!contributorMap.has(key)) {
        contributorMap.set(key, { name: commit.name, count: 0, sha: commit.hash });
    }
    contributorMap.get(key).count += 1;
}
const contributors = [...contributorMap.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
);
const botNames = new Set(
    commits
        .filter((commit) => botPattern.test(commit.name) || botPattern.test(commit.email))
        .map((commit) => commit.name)
);

async function resolveHandle(contributor) {
    if (!owner || !repo || !process.env.GITHUB_TOKEN) return null;
    try {
        const response = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
                repo
            )}/commits/${contributor.sha}`,
            {
                headers: {
                    Accept: "application/vnd.github+json",
                    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                    "User-Agent": "vencord-nightly-notes",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            }
        );
        if (!response.ok) return null;
        const data = await response.json();
        return data.author?.login ?? data.committer?.login ?? null;
    } catch {
        return null;
    }
}

const contributorLabels = [];
for (const contributor of contributors) {
    const handle = await resolveHandle(contributor);
    contributorLabels.push(handle ? `@${handle}` : contributor.name);
}

const domains = [
    {
        key: "tooling",
        title: "🛠️ Tooling",
        match: (files) =>
            files.some((file) =>
                /^(\.github\/|package|tsconfig|eslint|vitest|scripts\/|tests\/)/.test(file)
            ),
    },
    {
        key: "docs",
        title: "📚 Documentation",
        match: (files) => files.some((file) => /^docs\//.test(file) || /\.mdx?$/.test(file)),
    },
    {
        key: "core",
        title: "🧩 Core Plugin",
        match: (files) =>
            files.some((file) =>
                /^(index\.|pluginRuntime\.|devTools\.|patches\.|store\.|constants\.|core\/|quests\/)/.test(
                    file
                )
            ),
    },
    {
        key: "platform",
        title: "🔌 Platform & Foundation",
        match: (files) =>
            files.some((file) => /^(platform\/|foundation\/|stubs\/|types\/)/.test(file)),
    },
    {
        key: "ui",
        title: "🎛️ Settings & UI",
        match: (files) =>
            files.some((file) => /^(components\/|ui\/|settings\.|.*\.css$)/.test(file)),
    },
    {
        key: "general",
        title: "🧰 General",
        match: () => true,
    },
];

function subjectParts(commit) {
    const match = commit.subject.match(/^(\w+)(?:\(([^)]+)\))?!?:\s*(.*)$/);
    return {
        type: (match?.[1] ?? "change").toLowerCase(),
        scope: (match?.[2] ?? "").toLowerCase(),
        text: (match?.[3] ?? commit.subject)
            .replace(/\s*\(#\d+\)$/, "")
            .replace(/[`*_]/g, "")
            .trim(),
    };
}

function domainFor(commit) {
    const { type, scope } = subjectParts(commit);
    if (scope === "deps" || ["chore", "ci", "build"].includes(type)) {
        return domains.find((domain) => domain.key === "tooling");
    }
    if (type === "docs") return domains.find((domain) => domain.key === "docs");
    const files = filesFor(commit);
    return (
        domains.find((domain) => domain.key !== "general" && domain.match(files)) ?? domains.at(-1)
    );
}

const impactByType = {
    feat: "new capability landed in this build",
    fix: "regression addressed in this build",
    perf: "performance improvement included in this build",
    refactor: "internal structure simplified without changing behavior",
    docs: "documentation updated for this build",
    chore: "maintenance update included in this build",
    ci: "automation update included in this build",
    build: "build tooling update included in this build",
    test: "test coverage updated for this build",
};

function bulletFor(commit) {
    const { type, text } = subjectParts(commit);
    const pr = commit.subject.match(/\(#(\d+)\)$/)?.[1];
    const impact = impactByType[type] ?? "change included in this build";
    return `- **${text}** — ${impact}.${pr ? ` (#${pr})` : ""}`;
}

const priorityByType = {
    feat: 0,
    fix: 1,
    perf: 2,
    refactor: 3,
    revert: 4,
    style: 5,
    test: 6,
    chore: 7,
    ci: 7,
    build: 7,
    docs: 8,
};
const highlights = [...commits]
    .sort(
        (a, b) =>
            (priorityByType[subjectParts(a).type] ?? 5) -
                (priorityByType[subjectParts(b).type] ?? 5) || a.hash.localeCompare(b.hash)
    )
    .slice(0, 8);

const lines = [];
lines.push(
    isStable ? `# 🚀 ${repoSlug} Release ${currentTag}` : `# 🚀 ${repoSlug} Nightly (${date})`
);
lines.push("");
lines.push(`**Release Date:** ${dateLabel}  `);
lines.push(
    `**Since ${baseLabel}:** ${count(commits.length, "commit")} · ${count(prRefs.size, "merged PR")} · ${count(contributors.length, "contributor")} · ${count(filesChanged, "file")} changed, +${insertions}/−${deletions}`
);
lines.push("");
lines.push(
    isStable
        ? `> Stable ${currentTag} of ${repoSlug} at \`${shortSha}\`: ${count(commits.length, "commit")} since ${baseLabel}, grouped by area below.`
        : `> Nightly snapshot of ${repoSlug} at \`${shortSha}\`: ${count(commits.length, "commit")} since ${baseLabel}, grouped by area below.`
);
lines.push("");
lines.push("---");
lines.push("");
lines.push("## ✨ Highlights");
lines.push("");
if (highlights.length) {
    for (const commit of highlights) lines.push(bulletFor(commit));
} else {
    lines.push(
        isStable
            ? `- No commits since ${baseLabel}; this release verifies the clean baseline.`
            : `- No commits since ${baseLabel}; this nightly verifies the clean baseline.`
    );
}
lines.push("");
lines.push("---");

for (const domain of domains) {
    const group = commits.filter((commit) => domainFor(commit).key === domain.key);
    if (!group.length) continue;
    lines.push("");
    lines.push(`## ${domain.title}`);
    lines.push("");
    for (const commit of group) lines.push(bulletFor(commit));
    lines.push("");
    lines.push("---");
}

lines.push("");
lines.push("## 👥 Contributors");
lines.push("");
if (contributorLabels.length) {
    lines.push(
        `Huge thanks to **${count(contributors.length, "contributor")}** who landed **${count(commits.length, "commit")}** since ${baseLabel}.`
    );
    lines.push("");
    lines.push(contributorLabels.join(" · "));
} else {
    lines.push(`No human commits since ${baseLabel}.`);
}
if (botNames.size) {
    lines.push("");
    lines.push(`Plus ${[...botNames].join(" · ")} for maintenance.`);
}
lines.push("");
lines.push("---");
lines.push("");
lines.push(`**Full Changelog**: ${baseRef.slice(0, 7)}...${currentTag}`);

const body = `${lines.join("\n").trimEnd()}\n`;
const bodyPrs = new Set([...body.matchAll(/#(\d+)/g)].map((match) => match[1]));
const unknownRefs = [...bodyPrs].filter((number) => !prRefs.has(number));
const missingRefs = [...prRefs].filter((number) => !bodyPrs.has(number));
if (unknownRefs.length || missingRefs.length) {
    throw new Error(
        `PR-ref verification failed: unknown=${unknownRefs.join(",") || "none"} missing=${
            missingRefs.join(",") || "none"
        }`
    );
}

writeFileSync(notesFile, body);
writeOutput("kind", releaseKind);
writeOutput("tag", currentTag);
writeOutput("date", date);
writeOutput("title", isStable ? `${repoSlug} ${currentTag}` : `${repoSlug} Nightly (${date})`);
writeOutput(
    "zip_name",
    isStable ? `${packageJson.name}-${currentTag}.zip` : `${packageJson.name}-nightly-${date}.zip`
);
writeOutput("notes_file", notesFile);
writeOutput("short_sha", shortSha);
writeOutput("base_label", baseLabel);
console.log(
    `Generated ${notesFile} for ${currentTag} (${count(commits.length, "commit")} since ${baseLabel}).`
);
