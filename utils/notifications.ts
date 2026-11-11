// ---------------------------------------------------------------------------
// Clonecord toast / notification system
//
// Everything in here is deliberately defensive: a broken toast must never
// break a running clone. Every public entry point swallows its own errors.
//
// Styling is driven by CSS custom properties set on the container:
//   --cc-toast-bg        pill background (rgba, includes the opacity setting)
//   --cc-accent          accent color (hex)
//   --cc-accent-rgb      accent color as "r,g,b" for rgba() usage
//   --cc-toast-text      title/text color (hex)
//   --cc-percent         progress percent text color (hex)
//   --cc-bar-bg          progress bar track color (hex)
//   --cc-border          pill border color (hex or rgba())
//   --cc-toast-radius    pill corner radius (px)
//   --cc-toast-font-size pill title font size (px)
//   --cc-toast-padding   pill inner padding (px)
//   --cc-toast-max-width pill max width (px)
//   --cc-toast-slide     entry/exit slide offset (transform)
//   --cc-toast-origin    transform origin matching the chosen corner
// and the container carries data-pos + data-style="glass" | "solid" | "minimal".
// ---------------------------------------------------------------------------

import { state } from "../store";
import { messages } from "./messages";
import { escapeHtml } from "./helpers";
import { NotificationAction, CloneStats, CloneFailure } from "../types";
import { settings } from "../settings";
import { retryFailedItems } from "../core/retry";
import { RestAPI } from "@webpack/common";
import type { RateLimitStatus } from "./TaskQueue";

// ---------------------------------------------------------------------------
// Settings access
// ---------------------------------------------------------------------------

/**
 * Read a plugin setting defensively.
 *
 * In Vencord, `definePluginSettings` exposes the live values on
 * `settings.store` — there is no `.value` per setting at runtime. This
 * helper always falls back to a default so it can never crash.
 */
function toastSetting<T>(key: string, fallback: T): T {
    try {
        const store = (settings as any).store ?? {};
        const value = store[key];
        return value == null ? fallback : (value as T);
    } catch {
        return fallback;
    }
}

const COLOR_PRESETS: Record<string, string> = {
    blurple: "#5865F2",
    green: "#57F287",
    yellow: "#FEE75C",
    red: "#ED4245",
    fuchsia: "#EB459E",
    cyan: "#00A8FC",
    white: "#FFFFFF",
};

const DEFAULT_ACCENT = "#5865F2";

/** Accepts "#abc", "abc", "#aabbcc", "aabbcc" and returns "#aabbcc" */
function normalizeHex(raw: string | undefined | null, fallback: string): string {
    if (typeof raw !== "string") return fallback;
    const t = raw.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(t)) {
        return "#" + t.split("").map((c) => c + c).join("");
    }
    if (/^[0-9a-fA-F]{6}$/.test(t)) {
        return "#" + t.toLowerCase();
    }
    return fallback;
}

/**
 * Accent color, with migration for values stored by older builds
 * ("blurple", "green", … preset names, or "custom" + toastCustomColor).
 */
function getAccentColor(): string {
    const raw = toastSetting<string>("toastAccentColor", "");
    if (COLOR_PRESETS[raw]) return COLOR_PRESETS[raw];
    if (raw === "custom") {
        // older builds stored the custom accent in a separate setting
        return normalizeHex(toastSetting<string>("toastCustomColor", ""), DEFAULT_ACCENT);
    }
    return normalizeHex(raw, DEFAULT_ACCENT);
}

function getColorSetting(key: string, fallback: string): string {
    return normalizeHex(toastSetting<string>(key, ""), fallback);
}

/** Border color accepts hex; rgb()/rgba() strings pass through untouched. */
function getBorderCss(): string {
    const raw = toastSetting<string>("toastBorderColor", "");
    if (typeof raw === "string" && /^rgba?\(/i.test(raw.trim())) return raw.trim();
    return normalizeHex(raw, "rgba(255,255,255,0.08)");
}

function hexToRgbParts(hex: string): string {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `${r},${g},${b}`;
}

function hexToRgba(hex: string, alpha: number): string {
    const m = hex.replace("#", "").match(/.{2}/g);
    if (!m || m.length < 3) return `rgba(0,0,0,${alpha})`;
    return `rgba(${parseInt(m[0], 16)},${parseInt(m[1], 16)},${parseInt(m[2], 16)},${alpha})`;
}

function clampNum(raw: unknown, min: number, max: number, fallback: number): number {
    const n = typeof raw === "number" && isFinite(raw) ? raw : fallback;
    return Math.min(Math.max(n, min), max);
}

// ---------------------------------------------------------------------------
// Toast lifecycle helpers (hover-pause, click-dismiss, stack limit, dedupe)
// ---------------------------------------------------------------------------

const REMOVAL_MS = 400;
const DEDUPE_COOLDOWN_MS = 4000;
const lastShown: Record<string, number> = {};

interface ToastTimer {
    timeout: ReturnType<typeof setTimeout>;
    remaining: number;
    startedAt: number;
    paused: boolean;
}

const activeTimers = new Map<string, ToastTimer>();

function scheduleDismiss(id: string, delayMs: number) {
    if (delayMs <= 0) return;
    cancelDismiss(id);
    activeTimers.set(id, {
        timeout: setTimeout(() => closePill(id), delayMs),
        remaining: delayMs,
        startedAt: Date.now(),
        paused: false,
    });
}

function pauseDismiss(id: string) {
    const timer = activeTimers.get(id);
    if (!timer || timer.paused) return;
    clearTimeout(timer.timeout);
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
    timer.paused = true;
}

function resumeDismiss(id: string) {
    const timer = activeTimers.get(id);
    if (!timer || !timer.paused) return;
    timer.timeout = setTimeout(() => closePill(id), timer.remaining);
    timer.startedAt = Date.now();
    timer.paused = false;
}

function cancelDismiss(id: string) {
    const timer = activeTimers.get(id);
    if (timer) {
        clearTimeout(timer.timeout);
        activeTimers.delete(id);
    }
}

export function closePill(id: string) {
    try {
        cancelDismiss(id);
        const pill = document.getElementById(id);
        if (!pill || pill.classList.contains("hiding")) return;
        pill.classList.add("hiding");
        pill.style.pointerEvents = "none";
        setTimeout(() => pill.remove(), REMOVAL_MS);
    } catch (e) {
        console.warn("[Clonecord] closePill failed:", e);
    }
}

/** Keep at most `toastMaxStack` sub toasts; the oldest is removed first. */
function enforceStackLimit(container: HTMLElement) {
    try {
        const max = Math.min(Math.max(toastSetting<number>("toastMaxStack", 5), 1), 8);
        const pills = Array.from(container.querySelectorAll<HTMLElement>(".cloner-sub-pill:not(.hiding)"));
        while (pills.length > max) {
            const oldest = pills.shift();
            if (!oldest) break;
            oldest.classList.add("hiding");
            const doomed = oldest;
            setTimeout(() => doomed.remove(), REMOVAL_MS);
        }
    } catch (e) {
        console.warn("[Clonecord] enforceStackLimit failed:", e);
    }
}

/**
 * Makes a pill interactive:
 *  - hovering pauses the auto-dismiss countdown
 *  - optionally clicking anywhere (except buttons) closes it
 */
function registerInteractive(pill: HTMLElement, dismissOnClick: boolean) {
    try {
        pill.addEventListener("mouseenter", () => pauseDismiss(pill.id));
        pill.addEventListener("mouseleave", () => resumeDismiss(pill.id));
        if (dismissOnClick) {
            pill.addEventListener("click", (e) => {
                if ((e.target as HTMLElement | null)?.closest?.("button")) return;
                closePill(pill.id);
            });
        }
    } catch (e) {
        console.warn("[Clonecord] registerInteractive failed:", e);
    }
}

// ---------------------------------------------------------------------------
// Container management
// ---------------------------------------------------------------------------

export function cleanupContainer() {
    try {
        const container = document.getElementById("cloner-toast-container");
        if (container) {
            container.querySelectorAll(".cloner-pill, .cloner-sub-pill").forEach((el) => el.remove());
            if (container.children.length === 0) container.remove();
        }
        // Older builds shared the "vc-pill-container" element with other
        // plugins (e.g. Questcord). Purge any of our pills left behind in it.
        document
            .querySelectorAll(".vc-pill-container .cloner-pill, .vc-pill-container .cloner-sub-pill")
            .forEach((el) => el.remove());
    } catch (e) {
        console.warn("[Clonecord] cleanupContainer failed:", e);
    }
}

const TOAST_POSITIONS = [
    "top-right",
    "top-left",
    "bottom-right",
    "bottom-left",
    "top-center",
    "bottom-center",
];

/**
 * Applies the toast theme to the container.
 *
 * All placement (top/right/bottom/left, flex direction, slide direction) is
 * handled purely in CSS via [data-pos] on the container — JS only feeds the
 * theme variables. This keeps the layout immune to inline-style fights with
 * other plugins that used to share the "vc-pill-container" element.
 */
function applyContainerTheme(container: HTMLElement): void {
    const rawPos = toastSetting<string>("toastPosition", "top-right");
    const pos = TOAST_POSITIONS.includes(rawPos) ? rawPos : "top-right";

    const maxW = Math.round(clampNum(toastSetting<number>("toastMaxWidth", 400), 200, 800, 400));
    const opacity = clampNum(toastSetting<number>("toastOpacity", 85), 0, 100, 85) / 100;
    const radius = Math.round(clampNum(toastSetting<number>("toastBorderRadius", 10), 0, 32, 10));
    const fontSize = Math.round(clampNum(toastSetting<number>("toastFontSize", 13), 8, 24, 13));
    const padding = Math.round(clampNum(toastSetting<number>("toastPadding", 10), 2, 24, 10));

    const rawStyle = toastSetting<string>("toastStyle", "glass");
    const style = ["glass", "solid", "minimal"].includes(rawStyle) ? rawStyle : "glass";
    const accent = getAccentColor();
    const bg = hexToRgba(getColorSetting("toastBgColor", "#000000"), opacity);

    container.dataset.pos = pos;
    container.dataset.style = style;
    container.style.setProperty("--cc-toast-bg", bg);
    container.style.setProperty("--cc-accent", accent);
    container.style.setProperty("--cc-accent-rgb", hexToRgbParts(accent));
    container.style.setProperty("--cc-toast-text", getColorSetting("toastTextColor", "#FFFFFF"));
    container.style.setProperty("--cc-percent", getColorSetting("toastPercentColor", "#43b581"));
    container.style.setProperty("--cc-bar-bg", getColorSetting("toastBarBgColor", "#333333"));
    container.style.setProperty("--cc-border", getBorderCss());
    container.style.setProperty("--cc-toast-max-width", `${maxW}px`);
    container.style.setProperty("--cc-toast-radius", `${radius}px`);
    container.style.setProperty("--cc-toast-font-size", `${fontSize}px`);
    container.style.setProperty("--cc-toast-padding", `${padding}px`);
}

export function getPillContainer(): HTMLElement {
    const existing = document.getElementById("cloner-toast-container");
    if (existing) {
        state.pillContainer = existing;
        applyContainerTheme(existing);
        return existing;
    }
    if (!state.pillContainer || !document.body.contains(state.pillContainer)) {
        state.pillContainer = document.createElement("div");
        // Deliberately NOT "vc-pill-container": that id/class is used by other
        // plugins (e.g. Questcord), which made both plugins fight over the
        // same element and its position.
        state.pillContainer.id = "cloner-toast-container";
        state.pillContainer.className = "cloner-toast-container";
        document.body.appendChild(state.pillContainer);
    }
    applyContainerTheme(state.pillContainer);
    return state.pillContainer;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sub toasts (notify)
// ---------------------------------------------------------------------------

const TOAST_ICONS: Record<string, string> = {
    success:
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    error:
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    info:
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 8h.01"/><path d="M12 11v5"/></svg>',
};

export function notify(
    title: string,
    body: string,
    type: "success" | "info" | "error" = "info",
    duration = 0, // 0 = use settings default
    actions: NotificationAction[] = []
): string {
    try {
        const container = getPillContainer();

        const notificationId = `cloner-sub-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        // dedupe identical non-interactive toasts shown a moment ago
        const dedupeKey = `${type}:${title}:${body}`;
        if (
            actions.length === 0 &&
            lastShown[dedupeKey] &&
            Date.now() - lastShown[dedupeKey] < DEDUPE_COOLDOWN_MS
        ) {
            return "";
        }
        lastShown[dedupeKey] = Date.now();

        const autoDismiss = toastSetting<boolean>("toastAutoDismiss", true);
        const defaultDelay = toastSetting<number>("toastDismissDelayMs", 8000);
        const actualDuration = autoDismiss
            ? Math.max(duration || defaultDelay, 1000)
            : duration === 0
              ? 0
              : duration;

        const notification = document.createElement("div");
        notification.className = `cloner-sub-pill ${type}`;
        notification.id = notificationId;

        const actionButtons = actions
            .map(
                (action, index) =>
                    `<button id="btn-${notificationId}-${index}" class="cloner-toast-btn ${action.type || "default"}">${escapeHtml(action.label)}</button>`
            )
            .join("");

        notification.innerHTML =
            `<div class="cloner-sub-pill-icon ${type}">${TOAST_ICONS[type] ?? TOAST_ICONS.info}</div>` +
            `<div class="cloner-sub-pill-content">` +
            `<div class="cloner-sub-pill-title">${escapeHtml(title)}</div>` +
            (body ? `<div class="cloner-sub-pill-body">${escapeHtml(body)}</div>` : "") +
            (actions.length > 0 ? `<div class="cloner-toast-actions">${actionButtons}</div>` : "") +
            `</div>` +
            `<button class="cloner-toast-close" title="Dismiss">&times;</button>`;

        container.appendChild(notification);
        enforceStackLimit(container);

        notification.querySelector(".cloner-toast-close")?.addEventListener("click", (e) => {
            e.stopPropagation();
            closePill(notificationId);
        });

        actions.forEach((action, index) => {
            const btn = document.getElementById(`btn-${notificationId}-${index}`);
            btn?.addEventListener("click", (e) => {
                e.stopPropagation();
                try {
                    action.onClick(notificationId);
                } catch (err) {
                    console.warn("[Clonecord] toast action failed:", err);
                }
            });
        });

        registerInteractive(notification, actions.length === 0);
        scheduleDismiss(notificationId, actualDuration);

        return notificationId;
    } catch (e) {
        console.warn("[Clonecord] notify failed:", e);
        return "";
    }
}

// ---------------------------------------------------------------------------
// Main progress pill
// ---------------------------------------------------------------------------

function startProgressTimer(notificationId: string) {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.cloneStartTime = Date.now();

    state.timerInterval = setInterval(() => {
        if (!state.cloneStartTime) return;
        const elapsed = Date.now() - state.cloneStartTime;
        const formatted = formatElapsed(elapsed);
        const pill = document.getElementById(notificationId);
        if (!pill || pill.classList.contains("completed")) {
            if (state.timerInterval) clearInterval(state.timerInterval);
            state.timerInterval = null;
            return;
        }
        const timerCompact = pill.querySelector(".cloner-pill-timer");
        if (timerCompact) timerCompact.textContent = formatted;
    }, 1000);
}

export function createMainProgressNotification(
    title: string,
    initialBody: string,
    onSkipRoles?: () => void,
    isExistingServer: boolean = false,
    showSkipRoles: boolean = true
): string {
    const notificationId = `cloner-main-${Date.now()}`;

    try {
        state.skipRolesCallback = onSkipRoles || null;
        const container = getPillContainer();

        const cancelBtnText = isExistingServer
            ? messages.buttons.cancelExisting
            : messages.buttons.cancelNew;
        const skipRolesBtnHtml = showSkipRoles
            ? `<button class="cloner-toast-btn cloner-skip-roles-btn" style="display:none">${messages.buttons.skipRoles}</button>`
            : "";
        const timerHtml = toastSetting<boolean>("toastShowTimer", true)
            ? `<span class="cloner-pill-timer">0s</span>`
            : "";

        const pill = document.createElement("div");
        pill.className = "cloner-pill";
        pill.id = notificationId;

        pill.innerHTML = `
            <div class="cloner-pill-compact">
                <div class="cloner-pill-spinner"></div>
                <span class="cloner-pill-title">${escapeHtml(title)}</span>
                ${timerHtml}
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
                        <button class="cloner-toast-btn ${isExistingServer ? "default" : "danger"} cloner-cancel-btn">${cancelBtnText}</button>
                    </div>
                </div>
            </div>
        `;

        container.insertBefore(pill, container.firstChild);
        registerInteractive(pill, false);

        pill.querySelector(".cloner-skip-roles-btn")?.addEventListener("click", () => {
            try {
                if (state.skipRolesCallback) state.skipRolesCallback();
                const btn = pill.querySelector<HTMLButtonElement>(".cloner-skip-roles-btn");
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = "Skipped";
                }
            } catch (e) {
                console.warn("[Clonecord] skip roles failed:", e);
            }
        });

        pill.querySelector(".cloner-cancel-btn")?.addEventListener("click", async () => {
            try {
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
                        completeMainProgress(notificationId, "Could not delete server", false, "Cancelled");
                    }
                    state.currentCloneGuildId = null;
                } else {
                    completeMainProgress(notificationId, "Clone Cancelled", false, "Cancelled");
                }
            } catch (e) {
                console.warn("[Clonecord] cancel failed:", e);
            }
        });

        startProgressTimer(notificationId);
    } catch (e) {
        console.warn("[Clonecord] createMainProgressNotification failed:", e);
    }

    return notificationId;
}

export function updateMainProgress(id: string, body: string, percent: number) {
    try {
        const safePercent = isNaN(percent) ? 0 : Math.min(100, Math.max(0, Math.round(percent)));
        const pill = document.getElementById(id);
        if (!pill || pill.classList.contains("completed")) return;

        const bodyEl = pill.querySelector(".cloner-pill-body");
        if (bodyEl) bodyEl.textContent = body;

        const percentEl = pill.querySelector(".cloner-pill-percent");
        if (percentEl) percentEl.textContent = `${safePercent}%`;

        const progressBar = pill.querySelector<HTMLElement>(".cloner-pill-progress-fill");
        if (progressBar) {
            progressBar.style.transform = `scaleX(${safePercent / 100})`;
        }
    } catch (e) {
        console.warn("[Clonecord] updateMainProgress failed:", e);
    }
}

export function completeMainProgress(
    id: string,
    body: string,
    success: boolean,
    customPercentText?: string
) {
    try {
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

        const timerCompact = pill.querySelector<HTMLElement>(".cloner-pill-timer");
        if (timerCompact) timerCompact.style.display = "none";

        const percentEl = pill.querySelector(".cloner-pill-percent");
        if (percentEl)
            percentEl.textContent = customPercentText
                ? customPercentText
                : success
                  ? `Done${elapsedText}`
                  : "Error";

        const progressBar = pill.querySelector<HTMLElement>(".cloner-pill-progress-fill");
        if (progressBar) {
            progressBar.style.transform = "scaleX(1)";
        }

        pill.classList.add(success ? "success" : "error");

        const autoDismiss = toastSetting<boolean>("toastAutoDismiss", true);
        const delay = autoDismiss ? toastSetting<number>("toastDismissDelayMs", 8000) : 0;
        scheduleDismiss(id, delay);
    } catch (e) {
        console.warn("[Clonecord] completeMainProgress failed:", e);
    }
}

// ---------------------------------------------------------------------------
// Progress reporting (used by the clone pipeline)
// ---------------------------------------------------------------------------

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
    try {
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
    } catch (e) {
        console.warn("[Clonecord] updateThrottledProgress failed:", e);
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

// ---------------------------------------------------------------------------
// Clone summary
// ---------------------------------------------------------------------------

export function showCloneSummary(
    stats: CloneStats,
    failures: CloneFailure[],
    gaps: { title: string; detail: string; howToFix: string }[] = []
): void {
    try {
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
                          )}</span><span class="cloner-summary-failure-name">${escapeHtml(
                              f.name
                          )}</span><span class="cloner-summary-failure-err">${escapeHtml(
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
        const iconHtml = `<div class="cloner-sub-pill-icon ${hasFailures ? "error" : "success"}">${hasFailures ? TOAST_ICONS.error : TOAST_ICONS.success}</div>`;

        // action buttons
        const btnIds = {
            retry: `btn-retry-${notificationId}`,
            gaps: `btn-gaps-${notificationId}`,
            close: `btn-close-${notificationId}`,
        };

        const actionsHtml =
            `<div class="cloner-summary-actions">` +
            (hasFailures
                ? `<button id="${btnIds.retry}" class="cloner-toast-btn success">Retry failed</button>`
                : "") +
            (gaps.length > 0
                ? `<button id="${btnIds.gaps}" class="cloner-toast-btn default">Not cloned (${gaps.length})</button>`
                : "") +
            `<button id="${btnIds.close}" class="cloner-toast-btn default">Dismiss</button>` +
            `</div>`;

        pill.innerHTML =
            iconHtml +
            `<div class="cloner-sub-pill-content">` +
            `<div class="cloner-sub-pill-title">${escapeHtml(titleText)}</div>` +
            statsHtml +
            failuresHtml +
            actionsHtml +
            `</div>` +
            `<button class="cloner-toast-close" title="Dismiss">&times;</button>`;

        container.appendChild(pill);
        enforceStackLimit(container);

        pill.querySelector(".cloner-toast-close")?.addEventListener("click", () => closePill(notificationId));
        document
            .getElementById(btnIds.close)
            ?.addEventListener("click", () => closePill(notificationId));

        if (hasFailures) {
            document.getElementById(btnIds.retry)?.addEventListener("click", async () => {
                closePill(notificationId);
                notify("Retrying", "Re-attempting failed items...", "info", 5000);
                try {
                    const result = await retryFailedItems(failures);

                    if (result.fatal) {
                        notify("Retry not possible", result.fatal, "error", 0, [
                            { label: "Dismiss", type: "default", onClick: (id) => closePill(id) },
                        ]);
                        return;
                    }

                    if (result.failed.length === 0 && result.skipped.length === 0) {
                        notify(
                            "Retry complete",
                            `All ${result.succeeded.length} item(s) cloned successfully.`,
                            "success",
                            8000
                        );
                        return;
                    }

                    // some items are still broken — show an updated summary
                    notify(
                        "Retry finished",
                        `${result.succeeded.length} succeeded, ${result.failed.length} still failing${
                            result.skipped.length ? `, ${result.skipped.length} skipped` : ""
                        }.`,
                        result.failed.length ? "error" : "info",
                        10000
                    );
                    if (state.cloneStats) {
                        showCloneSummary(state.cloneStats, result.failed);
                    }
                } catch (e) {
                    notify("Retry failed", e instanceof Error ? e.message : String(e), "error", 0, [
                        { label: "Dismiss", type: "default", onClick: (id) => closePill(id) },
                    ]);
                }
            });
        }

        if (gaps.length > 0) {
            document.getElementById(btnIds.gaps)?.addEventListener("click", () => {
                closePill(notificationId);
                const gapPillId = notify("Not transferred", "", "info", 0);
                const gapPill = document.getElementById(gapPillId);
                const content = gapPill?.querySelector(".cloner-sub-pill-content");
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
                        `<div class="cloner-summary-actions"><button class="cloner-toast-btn default cloner-gap-dismiss">Dismiss</button></div>`;
                    content.insertAdjacentHTML("beforeend", listHtml);
                    gapPill
                        ?.querySelector(".cloner-gap-dismiss")
                        ?.addEventListener("click", () => closePill(gapPillId));
                }
            });
        }

        registerInteractive(pill, false);

        // auto-dismiss so the summary is temporary; failures stay longer so the user can retry
        const autoDismiss = toastSetting<boolean>("toastAutoDismiss", true);
        const baseDelay = toastSetting<number>("toastDismissDelayMs", 8000);
        const summaryDelay = autoDismiss ? (hasFailures ? Math.max(baseDelay, 15000) : baseDelay) : 0;
        scheduleDismiss(notificationId, summaryDelay);
    } catch (e) {
        console.warn("[Clonecord] showCloneSummary failed:", e);
    }
}
