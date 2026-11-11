import { state } from "../store";
import { messages } from "./messages";
import { escapeHtml, replaceEmojis, arrayBufferToBase64 } from "./helpers";
import { NotificationAction, CloneStats, CloneFailure } from "../types";
import { RestAPI, GuildStore } from "@webpack/common";
import { findByPropsLazy } from "@webpack";
import { TaskQueue } from "./TaskQueue";
import { cloneOnboarding } from "../core/cloneOnboarding";
import { CloneContext } from "../core/types";
import type { RateLimitStatus } from "./TaskQueue";

// Clamp helper to keep progress within 0‑100%
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

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

    // Rate‑limit per‑type to avoid spam
    const now = Date.now();
    const key = type;
    const COOLDOWN_MS = 5000;
    if (lastShown[key] && now - lastShown[key] < COOLDOWN_MS) {
        // skip showing this notification
    } else {
        if (duration !== 0) {
            const existingNotifications = container.querySelectorAll(".cloner-sub-pill:not(.hiding)");
            if (existingNotifications.length > 4) {
                const oldest = existingNotifications[0];
                oldest.classList.add("hiding");
                setTimeout(() => oldest.remove(), 500);
            }
        }
        lastShown[key] = now;
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
        setTimeout(() => closePill(notificationId), actualDuration);
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

    const cancelBtnText = isExistingServer
        ? messages.buttons.cancelExisting
        : messages.buttons.cancelNew;
    const skipRolesBtnHtml = showSkipRoles
        ? `<button class="cloner-btn cloner-skip-roles-btn" style="display:none">${messages.buttons.skipRoles}</button>`
        : "";

    const pill = document.createElement("div");
    pill.className = "cloner-pill";
    pill.id = notificationId;

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
                    <button class="${isExistingServer ? "cloner-btn" : "cloner-btn danger"} cloner-cancel-btn">${cancelBtnText}</button>
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
        const safePercent = isNaN(percent) ? 0 : Math.min(100, Math.max(0, Math.round(percent)));
        updateMainProgress(
            state.mainProgressNotificationId,
            message || `Progress: ${Math.round(safePercent)}%`,
            safePercent
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
        const etaMs = (remainingItems * status.avgRequestMs) / Math.max(1, status.currentConcurrency);
        const eta = formatEta(etaMs);
        if (eta) {
            const percentEl = pill.querySelector(".cloner-pill-percent");
            if (percentEl && !percentEl.textContent?.includes("left")) {
                percentEl.textContent = `${Math.min(100, Math.max(0, Math.round(percent)))}% • ${eta}`;
            }
        }
    }
}

export function updateWithTime(msg: string, percent: number, remainingItems?: number) {
    if (!state.mainProgressNotificationId) return;
    const safePercent = isNaN(percent) ? 0 : Math.min(100, Math.max(0, Math.round(percent)));
    const queue = state.taskQueue;
    if (queue) {
        const status = queue.getStatus();
        if (status.throttled) {
            updateThrottledProgress({ status, percent, remainingItems: remainingItems ?? 0 });
            return;
        }
        updateMainProgress(state.mainProgressNotificationId, msg || `Progress: ${Math.round(safePercent)}%`, safePercent);
        if (remainingItems !== undefined && remainingItems > 0) {
            updateThrottledProgress({ status, percent: safePercent, remainingItems });
        }
        return;
    }
    updateMainProgress(state.mainProgressNotificationId, msg || `Progress: ${Math.round(safePercent)}%`, safePercent);
}

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

    // stat rows — only show what was actually cloned
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
                          `<div class="cloner-summary-failure-row"><span class="cloner-summary-failure-ctx">${escapeHtml(
                              f.context
                          )}</span><span class="cloner-summary-failure-name">${escapeHtml(f.name)}</span><span class="cloner-summary-failure-err">${escapeHtml(
                              f.error
                          )}</span></div>`
                  )
                  .join("") +
              (failures.length > 5
                  ? `<div class="cloner-summary-failure-more">+${failures.length - 5} more</div>`
                  : "") +
              `</div>`
        : "";

    const titleText = hasFailures ? messages.summary.errors : messages.summary.success;
    const iconHtml = `<div class="cloner-sub-pill-icon ${hasFailures ? "error" : "success"}>${hasFailures ? "\u2715" : "\u2713"}</div>`;

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

    document
        .getElementById(btnIds.close)
        ?.addEventListener("click", () => closePill(notificationId));

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
                                    `<div class="cloner-summary-failure-row"><span class="cloner-summary-failure-name">${escapeHtml(
                                        g.title
                                    )}</span><span class="cloner-summary-failure-err">${escapeHtml(
                                        g.detail
                                    )}</span></div>`
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

// ---------------------------------------------------------------------------
// Helper functions (unchanged)
// ---------------------------------------------------------------------------

const AuthStore = findByPropsLazy("getToken");

const lastShown: Record<string, number> = {};
const COOLDOWN_MS = 5000; // 5 seconds