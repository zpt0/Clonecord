import { state } from "../store";
import { escapeHtml, replaceEmojis, arrayBufferToBase64 } from "./helpers";
import { NotificationAction, CloneStats, CloneFailure } from "../types";
import { RestAPI, GuildStore } from "@webpack/common";
import { findByPropsLazy } from "@webpack";
import { TaskQueue } from "./TaskQueue";
import { cloneOnboarding } from "../core/cloneOnboarding";
import { CloneContext } from "../core/types";
import type { RateLimitStatus } from "./TaskQueue";

export function formatElapsed(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
}

function formatEta(ms: number): string {
    if (ms <= 0) return "";
    const totalSeconds = Math.ceil(ms / 1000);
    if (totalSeconds < 60) return `~${totalSeconds}s left`;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins < 60) return secs > 0 ? `~${mins}m ${secs}s left` : `~${mins}m left`;
    const hours = Math.floor(mins / 60);
    return `~${hours}h ${mins % 60}m left`;
}

function startProgressTimer(notificationId: string) {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.cloneStartTime = Date.now();

    state.timerInterval = setInterval(() => {
        if (!state.cloneStartTime) return;
        const elapsed = Date.now() - state.cloneStartTime;
        const formatted = formatElapsed(elapsed);

        const pill = document.getElementById(notificationId);
        if (!pill || pill.classList.contains("completed")) {
            clearInterval(state.timerInterval!);
            state.timerInterval = null;
            return;
        }

        const timerCompact = pill.querySelector(".cloner-pill-timer");
        if (timerCompact) timerCompact.textContent = formatted;
    }, 1000);
}

export function cleanupContainer() {
    const container = document.getElementById("vc-pill-container");
    if (!container) return;
    container.querySelectorAll(".cloner-pill, .cloner-sub-pill").forEach((el) => el.remove());
    if (container.children.length === 0) container.remove();
}

export function getPillContainer(): HTMLElement {
    const existing = document.getElementById("vc-pill-container");
    if (existing) {
        state.pillContainer = existing;
        return existing;
    }
    if (!state.pillContainer || !document.body.contains(state.pillContainer)) {
        state.pillContainer = document.createElement("div");
        state.pillContainer.id = "vc-pill-container";
        state.pillContainer.className = "vc-pill-container";
        document.body.appendChild(state.pillContainer);
    }
    return state.pillContainer;
}

export function closePill(id: string) {
    const pill = document.getElementById(id);
    if (pill && !pill.classList.contains("hiding")) {
        pill.classList.add("hiding");
        setTimeout(() => pill.remove(), 900);
    }
}

export function notify(
    title: string,
    body: string,
    type: "success" | "info" | "error" = "info",
    duration = 3000,
    actions: NotificationAction[] = []
): string {
    const container = getPillContainer();
    const actualDuration = type === "error" ? Math.max(duration, 8000) : duration;
    const notificationId = `cloner-sub-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    if (duration !== 0) {
        const existingNotifications = container.querySelectorAll(".cloner-sub-pill:not(.hiding)");
        if (existingNotifications.length > 4) {
            const oldest = existingNotifications[0];
            oldest.classList.add("hiding");
            setTimeout(() => oldest.remove(), 500);
        }
    }

    const notification = document.createElement("div");
    notification.className = `cloner-sub-pill ${type}`;
    notification.id = notificationId;

    const icons: Record<string, string> = { success: "\u2713", error: "\u2715", info: "i" };

    const actionButtons = actions
        .map((action, index) => {
            const safeId = `btn-${notificationId}-${index}`;
            return `<button id="${safeId}" class="cloner-btn ${action.type || "default"}" style="padding: 4px 10px; font-size: 11px;">${escapeHtml(action.label)}</button>`;
        })
        .join("");

    notification.innerHTML = `
        <div class="cloner-sub-pill-icon ${type}">${icons[type]}</div>
        <div class="cloner-sub-pill-content">
            <div class="cloner-sub-pill-title">${escapeHtml(title)}</div>
            ${body ? `<div class="cloner-sub-pill-body">${escapeHtml(body)}</div>` : ""}
            ${actions.length > 0 ? `<div style="display:flex; gap: 6px; margin-top: 6px;">${actionButtons}</div>` : ""}
        </div>
    `;

    container.appendChild(notification);

    actions.forEach((action, index) => {
        const safeId = `btn-${notificationId}-${index}`;
        const btn = document.getElementById(safeId);
        if (btn) {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                action.onClick(notificationId);
            });
        }
    });

    if (duration !== 0) {
        setTimeout(() => {
            closePill(notificationId);
        }, actualDuration);
    }

    return notificationId;
}

export function createMainProgressNotification(
    title: string,
    initialBody: string,
    onSkipRoles?: () => void,
    isExistingServer: boolean = false,
    showSkipRoles: boolean = true
): string {
    state.skipRolesCallback = onSkipRoles || null;
    const container = getPillContainer();
    const notificationId = `cloner-main-${Date.now()}`;

    const pill = document.createElement("div");
    pill.className = "cloner-pill";
    pill.id = notificationId;

    const cancelBtnText = isExistingServer ? "Cancel" : "Cancel & Delete";
    const cancelBtnClass = isExistingServer ? "cloner-btn" : "cloner-btn danger";
    const skipRolesBtnHtml = showSkipRoles
        ? `<button class="cloner-btn cloner-skip-roles-btn" style="display:none">Skip Roles</button>`
        : "";

    pill.innerHTML = `
        <div class="cloner-pill-compact">
            <div class="cloner-pill-spinner"></div>
            <span class="cloner-pill-title">${escapeHtml(title)}</span>
            <span class="cloner-pill-timer">0s</span>
            <span class="cloner-pill-percent">0%</span>
        </div>
        <div class="cloner-pill-expanded">
            <div class="cloner-pill-expanded-inner">
                <div class="cloner-pill-body">${escapeHtml(initialBody)}</div>
                <div class="cloner-pill-progress-bar">
                    <div class="cloner-pill-progress-fill"></div>
                </div>
                <div class="cloner-pill-actions">
                    ${skipRolesBtnHtml}
                    <button class="${cancelBtnClass} cloner-cancel-btn">${cancelBtnText}</button>
                </div>
            </div>
        </div>
    `;

    container.insertBefore(pill, container.firstChild);

    const skipRolesBtn = pill.querySelector(".cloner-skip-roles-btn");
    if (skipRolesBtn) {
        skipRolesBtn.addEventListener("click", () => {
            if (state.skipRolesCallback) state.skipRolesCallback();
            (skipRolesBtn as HTMLButtonElement).disabled = true;
            (skipRolesBtn as HTMLButtonElement).textContent = "Skipped";
        });
    }

    const cancelBtn = pill.querySelector(".cloner-cancel-btn");
    if (cancelBtn) {
        cancelBtn.addEventListener("click", async () => {
            state.isCloning = false;
            if (state.abortController) {
                state.abortController.abort();
                state.abortController = null;
            }

            pill.classList.add("completed");

            if (!isExistingServer && state.currentCloneGuildId) {
                try {
                    await RestAPI.del({ url: `/guilds/${state.currentCloneGuildId}` });
                    completeMainProgress(notificationId, "Server deleted", false, "Cancelled");
                } catch {
                    completeMainProgress(
                        notificationId,
                        "Could not delete server",
                        false,
                        "Cancelled"
                    );
                }
                state.currentCloneGuildId = null;
            } else {
                completeMainProgress(notificationId, "Clone Cancelled", false, "Cancelled");
            }
        });
    }

    startProgressTimer(notificationId);

    return notificationId;
}

export function updateMainProgress(id: string, body: string, percent: number) {
    const safePercent = isNaN(percent) ? 0 : Math.min(100, Math.max(0, Math.round(percent)));
    const pill = document.getElementById(id);
    if (!pill || pill.classList.contains("completed")) return;

    const bodyEl = pill.querySelector(".cloner-pill-body");
    if (bodyEl) bodyEl.textContent = body;

    const percentEl = pill.querySelector(".cloner-pill-percent");
    if (percentEl) percentEl.textContent = `${safePercent}%`;

    const progressBar = pill.querySelector(".cloner-pill-progress-fill") as HTMLElement;
    if (progressBar) {
        progressBar.style.transform = `scaleX(${safePercent / 100})`;
    }
}

export function completeMainProgress(
    id: string,
    body: string,
    success: boolean,
    customPercentText?: string
) {
    const pill = document.getElementById(id);
    if (!pill) return;

    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }

    const elapsedText = state.cloneStartTime
        ? ` \u2022 ${formatElapsed(Date.now() - state.cloneStartTime)}`
        : "";
    state.cloneStartTime = null;

    pill.classList.add("completed");

    const titleEl = pill.querySelector(".cloner-pill-title");
    if (titleEl) titleEl.textContent = body;

    const timerCompact = pill.querySelector(".cloner-pill-timer") as HTMLElement;
    if (timerCompact) timerCompact.style.display = "none";

    const percentEl = pill.querySelector(".cloner-pill-percent");
    if (percentEl)
        percentEl.textContent = customPercentText
            ? customPercentText
            : success
              ? `Done${elapsedText}`
              : "Error";

    const progressBar = pill.querySelector(".cloner-pill-progress-fill") as HTMLElement;
    if (progressBar) {
        progressBar.style.transform = "scaleX(1)";
    }

    pill.classList.add(success ? "success" : "error");

    const delay = customPercentText === "Cancelled" ? 3000 : 6000;
    setTimeout(() => closePill(id), delay);
}

export function updateProgress(percent: number, message?: string) {
    if (state.mainProgressNotificationId) {
        updateMainProgress(
            state.mainProgressNotificationId,
            message || `Progress: ${Math.round(percent)}%`,
            percent
        );
    }
}

export interface ThrottleProgressInfo {
    status: RateLimitStatus;
    percent: number;
    remainingItems: number;
}

export function updateThrottledProgress(info: ThrottleProgressInfo) {
    if (!state.mainProgressNotificationId) return;
    const { status, percent, remainingItems } = info;
    const pill = document.getElementById(state.mainProgressNotificationId);
    if (!pill || pill.classList.contains("completed")) return;

    const bodyEl = pill.querySelector(".cloner-pill-body");
    if (status.throttled) {
        const msg =
            `Rate limited — continuing in ~${status.throttledSecondsLeft}s` +
            (status.currentConcurrency < status.maxConcurrency
                ? ` (speed reduced ${status.maxConcurrency} → ${status.currentConcurrency})`
                : "");
        if (bodyEl) bodyEl.textContent = msg;
    } else if (status.avgRequestMs > 0 && remainingItems > 0 && percent < 100) {
        const etaMs =
            (remainingItems * status.avgRequestMs) / Math.max(1, status.currentConcurrency);
        const eta = formatEta(etaMs);
        if (eta) {
            const percentEl = pill.querySelector(".cloner-pill-percent");
            if (percentEl && !percentEl.textContent?.includes("left")) {
                percentEl.textContent = `${Math.min(100, Math.max(0, Math.round(percent)))}% • ${eta}`;
            }
        }
    }
}

export const updateWithTime = (msg: string, percent: number, remainingItems?: number) => {
    if (!state.mainProgressNotificationId) return;
    const queue = state.taskQueue;
    if (queue) {
        const status = queue.getStatus();
        if (status.throttled) {
            updateThrottledProgress({ status, percent, remainingItems: remainingItems ?? 0 });
            return;
        }
        updateMainProgress(state.mainProgressNotificationId, msg, percent);
        if (remainingItems !== undefined && remainingItems > 0) {
            updateThrottledProgress({ status, percent, remainingItems });
        }
        return;
    }
    updateMainProgress(state.mainProgressNotificationId, msg, percent);
};

export function showCloneSummary(
    stats: CloneStats,
    failures: CloneFailure[],
    gaps: { title: string; detail: string; howToFix: string }[] = []
): void {
    const hasFailures = failures.length > 0;
    const container = getPillContainer();

    const notificationId = `cloner-sub-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const pill = document.createElement("div");
    pill.className = `cloner-sub-pill cloner-summary ${hasFailures ? "error" : "success"}`;
    pill.id = notificationId;

    // stat rows \u2014 only show what was actually cloned
    const statRows: { label: string; value: number | boolean }[] = [
        { label: "Channels", value: stats.channelsCloned },
        { label: "Categories", value: stats.categoriesCloned },
        { label: "Roles", value: stats.rolesCloned },
        { label: "Emojis", value: stats.emojisCloned },
        { label: "Stickers", value: stats.stickersCloned },
        { label: "Sounds", value: stats.soundboardCloned },
    ].filter((r) => typeof r.value === "number" && r.value > 0);

    const statsHtml =
        statRows.length > 0
            ? `<div class="cloner-summary-stats">` +
              statRows
                  .map(
                      (r) =>
                          `<span class="cloner-summary-stat"><span class="cloner-summary-stat-num">${r.value}</span> ${escapeHtml(r.label)}</span>`
                  )
                  .join("") +
              (stats.onboardingCloned
                  ? `<span class="cloner-summary-stat cloner-summary-stat-tag">Onboarding \u2713</span>`
                  : "") +
              `</div>`
            : `<div class="cloner-summary-empty">Nothing was cloned</div>`;

    const failuresHtml = hasFailures
        ? `<div class="cloner-summary-failures">` +
          `<div class="cloner-summary-section-label">Failed (${failures.length})</div>` +
          failures
              .slice(0, 5)
              .map(
                  (f) =>
                      `<div class="cloner-summary-failure-row"><span class="cloner-summary-failure-ctx">${escapeHtml(f.context)}</span><span class="cloner-summary-failure-name">${escapeHtml(f.name)}</span><span class="cloner-summary-failure-err">${escapeHtml(f.error)}</span></div>`
              )
              .join("") +
          (failures.length > 5
              ? `<div class="cloner-summary-failure-more">+${failures.length - 5} more</div>`
              : "") +
          `</div>`
        : "";

    const titleText = hasFailures ? "Cloned with errors" : "Clone complete";
    const iconHtml = `<div class="cloner-sub-pill-icon ${hasFailures ? "error" : "success"}">${hasFailures ? "\u2715" : "\u2713"}</div>`;

    // action buttons
    const btnIds = {
        retry: `btn-retry-${notificationId}`,
        gaps: `btn-gaps-${notificationId}`,
        close: `btn-close-${notificationId}`,
    };

    const actionsHtml =
        `<div class="cloner-summary-actions">` +
        (hasFailures
            ? `<button id="${btnIds.retry}" class="cloner-btn">Retry failed</button>`
            : "") +
        (gaps.length > 0
            ? `<button id="${btnIds.gaps}" class="cloner-btn">Not cloned (${gaps.length})</button>`
            : "") +
        `<button id="${btnIds.close}" class="cloner-btn">Dismiss</button>` +
        `</div>`;

    pill.innerHTML =
        iconHtml +
        `<div class="cloner-sub-pill-content">` +
        `<div class="cloner-sub-pill-title">${escapeHtml(titleText)}</div>` +
        statsHtml +
        failuresHtml +
        actionsHtml +
        `</div>`;

    container.appendChild(pill);

    document.getElementById(btnIds.close)?.addEventListener("click", () => closePill(notificationId));

    if (hasFailures) {
        document.getElementById(btnIds.retry)?.addEventListener("click", async () => {
            closePill(notificationId);
            notify("Retrying", "Re-attempting failed items...", "info", 5000);
            await retryFailedItems(failures);
        });
    }

    if (gaps.length > 0) {
        document.getElementById(btnIds.gaps)?.addEventListener("click", () => {
            closePill(notificationId);
            const gapPillId = notify("Not transferred", "", "info", 0);
            const gapPill = document.getElementById(gapPillId);
            if (gapPill) {
                const content = gapPill.querySelector(".cloner-sub-pill-content");
                if (content) {
                    const listHtml =
                        `<div class="cloner-summary-failures">` +
                        gaps
                            .map(
                                (g) =>
                                    `<div class="cloner-summary-failure-row"><span class="cloner-summary-failure-name">${escapeHtml(g.title)}</span><span class="cloner-summary-failure-err">${escapeHtml(g.detail)}</span></div>`
                            )
                            .join("") +
                        `</div>` +
                        `<div class="cloner-summary-actions"><button class="cloner-btn cloner-gap-dismiss">Dismiss</button></div>`;
                    content.insertAdjacentHTML("beforeend", listHtml);
                    gapPill
                        .querySelector(".cloner-gap-dismiss")
                        ?.addEventListener("click", () => closePill(gapPillId));
                }
            }
        });
    }

    // auto-dismiss so the summary is temporary; failures stay a bit longer so the user can retry
    setTimeout(() => closePill(notificationId), hasFailures ? 25000 : 8000);
}

const AuthStore = findByPropsLazy("getToken");

const retryHelpers = {
    async fetchBase64(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`CDN returned ${response.status}`);
        const buffer = await response.arrayBuffer();
        return arrayBufferToBase64(buffer);
    },
};

async function retryRole(failure: CloneFailure, targetGuildId: string): Promise<boolean> {
    const role = failure.sourceData;
    const rolePayload: any = {
        name: replaceEmojis(role?.name) || failure.name,
        permissions: role?.permissions?.toString() ?? "0",
        color: role?.color ?? 0,
        hoist: role?.hoist ?? false,
        mentionable: role?.mentionable ?? false,
    };

    const targetGuild = GuildStore.getGuild(targetGuildId);
    const targetTier = (targetGuild as any)?.premiumTier || 0;
    if (targetTier >= 2) {
        rolePayload.unicode_emoji = role?.unicodeEmoji || role?.unicode_emoji || null;
        const roleIcon = role?.icon;
        if (roleIcon) {
            try {
                rolePayload.icon = `data:image/png;base64,${await retryHelpers.fetchBase64(
                    `https://cdn.discordapp.com/role-icons/${role.id}/${roleIcon}.png?size=128`
                )}`;
            } catch {
                // icon fetch failed — proceed without it
            }
        }
    }

    const resp = await RestAPI.post({
        url: `/guilds/${targetGuildId}/roles`,
        body: rolePayload,
    });
    if (resp?.body?.id && role?.id) state.lastCloneRoleIdMap[role.id] = resp.body.id;
    return true;
}

function mapOverwrites(overwrites: any[], targetGuildId: string): any[] {
    return (overwrites || [])
        .filter(
            (ow: any) =>
                ow.type === 0 &&
                (state.lastCloneRoleIdMap[ow.id] || ow.id === state.lastCloneSourceGuildId)
        )
        .map((ow: any) => ({
            id:
                ow.id === state.lastCloneSourceGuildId
                    ? targetGuildId
                    : state.lastCloneRoleIdMap[ow.id],
            type: 0,
            allow: ow.allow,
            deny: ow.deny,
        }));
}

async function retryCategory(failure: CloneFailure, targetGuildId: string): Promise<boolean> {
    const cat = failure.sourceData;
    const catPayload: any = {
        name: cat?.name || failure.name,
        type: 4,
        position: cat?.position ?? 0,
        permission_overwrites: [],
    };
    const mappedOverwrites = mapOverwrites(cat?.permission_overwrites, targetGuildId);
    if (mappedOverwrites.length > 0) catPayload.permission_overwrites = mappedOverwrites;

    const resp = await RestAPI.post({ url: `/guilds/${targetGuildId}/channels`, body: catPayload });
    if (resp?.body?.id && cat?.id) state.lastCloneChannelIdMap[cat.id] = resp.body.id;
    return true;
}

async function retryChannel(failure: CloneFailure, targetGuildId: string): Promise<boolean> {
    const ch = failure.sourceData;
    const chPayload: any = {
        name: replaceEmojis(ch?.name) || failure.name,
        type: ch?.type ?? 0,
        position: ch?.position ?? 0,
        topic: replaceEmojis(ch?.topic) ?? undefined,
        nsfw: ch?.nsfw ?? false,
        rate_limit_per_user: ch?.rate_limit_per_user ?? 0,
        permission_overwrites: [],
    };

    if (ch?.parent_id && state.lastCloneChannelIdMap[ch.parent_id]) {
        chPayload.parent_id = state.lastCloneChannelIdMap[ch.parent_id];
    }

    if (ch?.type === 2 || ch?.type === 13) {
        const targetGuild = GuildStore.getGuild(targetGuildId);
        const targetTier = (targetGuild as any)?.premiumTier || 0;
        const maxBitrate =
            targetTier >= 3 ? 384000 : targetTier >= 2 ? 256000 : targetTier >= 1 ? 128000 : 96000;
        chPayload.bitrate = Math.min(ch?.bitrate || 64000, maxBitrate);
        chPayload.user_limit = ch?.user_limit || 0;
    }

    if (ch?.type === 15 || ch?.type === 16) {
        if (ch?.available_tags && Array.isArray(ch.available_tags)) {
            chPayload.available_tags = ch.available_tags.map((tag: any) => ({
                name: replaceEmojis(tag.name),
                emoji_id:
                    tag.emoji_id && state.lastCloneEmojiIdMap[tag.emoji_id]
                        ? state.lastCloneEmojiIdMap[tag.emoji_id]
                        : null,
                emoji_name: tag.emoji_name || null,
                moderated: tag.moderated || false,
            }));
        }
        if (ch?.default_reaction_emoji) {
            if (
                ch.default_reaction_emoji.emoji_id &&
                state.lastCloneEmojiIdMap[ch.default_reaction_emoji.emoji_id]
            ) {
                chPayload.default_reaction_emoji = {
                    emoji_id: state.lastCloneEmojiIdMap[ch.default_reaction_emoji.emoji_id],
                    emoji_name: ch.default_reaction_emoji.emoji_name || null,
                };
            } else if (
                ch.default_reaction_emoji.emoji_name &&
                !ch.default_reaction_emoji.emoji_id
            ) {
                chPayload.default_reaction_emoji = {
                    emoji_id: null,
                    emoji_name: ch.default_reaction_emoji.emoji_name,
                };
            }
        }
        if (ch?.default_sort_order !== undefined) chPayload.default_sort_order = ch.default_sort_order;
        if (ch?.default_forum_layout !== undefined)
            chPayload.default_forum_layout = ch.default_forum_layout;
    }

    const mappedOverwrites = mapOverwrites(ch?.permission_overwrites, targetGuildId);
    if (mappedOverwrites.length > 0) chPayload.permission_overwrites = mappedOverwrites;

    const resp = await RestAPI.post({ url: `/guilds/${targetGuildId}/channels`, body: chPayload });
    if (resp?.body?.id && ch?.id) state.lastCloneChannelIdMap[ch.id] = resp.body.id;
    return true;
}

async function retryEmoji(failure: CloneFailure, targetGuildId: string): Promise<boolean> {
    const emoji = failure.sourceData;
    const ext = emoji?.animated ? "gif" : "png";
    const imageStr = `data:image/${ext};base64,${await retryHelpers.fetchBase64(
        `https://cdn.discordapp.com/emojis/${emoji?.id}.${ext}?size=256`
    )}`;

    const createResp = await RestAPI.post({
        url: `/guilds/${targetGuildId}/emojis`,
        body: { name: emoji?.name || failure.name, image: imageStr, roles: [] },
    });
    if (createResp?.body?.id && emoji?.id) state.lastCloneEmojiIdMap[emoji.id] = createResp.body.id;
    return true;
}

async function retrySticker(failure: CloneFailure, targetGuildId: string): Promise<boolean> {
    const sticker = failure.sourceData;
    const formatExt: Record<number, string> = { 1: "png", 2: "png", 3: "json", 4: "gif" };
    const ext = formatExt[sticker?.format_type] || "png";
    const stickerUrl = `https://media.discordapp.net/stickers/${sticker?.id}.${ext}`;

    const response = await fetch(stickerUrl);
    if (!response.ok) throw new Error(`CDN returned ${response.status}`);
    const blob = await response.blob();

    const mimeTypes: Record<number, string> = {
        1: "image/png",
        2: "image/apng",
        3: "application/json",
        4: "image/gif",
    };
    const mime = mimeTypes[sticker?.format_type] || "image/png";
    const file = new File([blob], `${sticker?.name || failure.name}.${ext}`, { type: mime });

    const formData = new FormData();
    formData.append("name", sticker?.name || failure.name);
    formData.append("description", sticker?.description || "");
    formData.append("tags", sticker?.tags || "");
    formData.append("file", file);

    const authToken = AuthStore?.getToken?.();
    if (!authToken) throw new Error("Could not get auth token");

    const resp = await fetch(`/api/v9/guilds/${targetGuildId}/stickers`, {
        method: "POST",
        headers: { Authorization: authToken },
        body: formData,
    });
    if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.message || `Sticker upload failed: ${resp.status}`);
    }
    return true;
}

async function retrySoundboard(failure: CloneFailure, targetGuildId: string): Promise<boolean> {
    const sound = failure.sourceData;
    const dataUri = `data:audio/ogg;base64,${await retryHelpers.fetchBase64(
        `https://cdn.discordapp.com/soundboard-sounds/${sound?.sound_id}`
    )}`;

    const body: any = {
        name: sound?.name || failure.name,
        sound: dataUri,
        volume: sound?.volume ?? 1,
    };
    if (sound?.emoji_name && !sound?.emoji_id) body.emoji_name = sound.emoji_name;

    await RestAPI.post({ url: `/guilds/${targetGuildId}/soundboard-sounds`, body });
    return true;
}

async function retryOnboarding(): Promise<void> {
    const sourceGuildId = state.lastCloneSourceGuildId;
    const targetGuildId = state.lastCloneTargetGuildId;
    if (!sourceGuildId || !targetGuildId) throw new Error("Missing source or target server");
    const sourceGuild = GuildStore.getGuild(sourceGuildId);
    if (!sourceGuild) throw new Error("Source server no longer available");

    const taskQueue = new TaskQueue(3);
    await cloneOnboarding({
        sourceGuild,
        newGuildId: targetGuildId,
        channelIdMap: state.lastCloneChannelIdMap,
        roleIdMap: state.lastCloneRoleIdMap,
        taskQueue,
        onboardingProgressStart: 85,
    } as unknown as CloneContext);
}

async function retryFailedItems(failures: CloneFailure[]): Promise<void> {
    const targetGuildId = state.lastCloneTargetGuildId;
    if (!targetGuildId) {
        notify("Cannot Retry", "No target server from the last clone found.", "error", 6000);
        return;
    }

    let succeeded = 0;
    let failed = 0;
    const onboardingRetries: CloneFailure[] = [];

    for (const failure of failures) {
        try {
            let ok = false;
            switch (failure.context) {
                case "Role":
                    ok = await retryRole(failure, targetGuildId);
                    break;
                case "Category":
                    ok = await retryCategory(failure, targetGuildId);
                    break;
                case "Channel":
                    ok = await retryChannel(failure, targetGuildId);
                    break;
                case "Emoji":
                    ok = await retryEmoji(failure, targetGuildId);
                    break;
                case "Sticker":
                    ok = await retrySticker(failure, targetGuildId);
                    break;
                case "Soundboard":
                    ok = await retrySoundboard(failure, targetGuildId);
                    break;
                case "Onboarding":
                    onboardingRetries.push(failure);
                    continue;
            }
            if (ok) succeeded++;
            else failed++;
        } catch (e) {
            failed++;
            notify(
                "Retry Failed",
                `${failure.context}: ${failure.name} — ${(e as Error)?.message || "Unknown error"}`,
                "error",
                6000
            );
        }
    }

    if (onboardingRetries.length > 0) {
        try {
            await retryOnboarding();
            succeeded += onboardingRetries.length;
        } catch (e) {
            failed += onboardingRetries.length;
            notify(
                "Retry Failed",
                `Onboarding: ${(e as Error)?.message || "Unknown error"}`,
                "error",
                6000
            );
        }
    }

    notify(
        "Retry Complete",
        `Retried ${failures.length} item(s): ${succeeded} succeeded, ${failed} failed.`,
        failed > 0 ? "error" : "success",
        8000
    );
}
