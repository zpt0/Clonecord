import { React } from "@webpack/common";

import { LivePreviewSurface } from "../platform/settings";
import { settings } from "../settings";

const PREVIEW_KEYS = [
    "toastPosition",
    "toastStyle",
    "toastShowTimer",
    "toastBgColor",
    "toastAccentColor",
    "toastTextColor",
    "toastPercentColor",
    "toastBarBgColor",
    "toastBorderColor",
    "toastBorderRadius",
    "toastFontSize",
    "toastPadding",
    "toastOpacity",
    "toastMaxWidth",
] as const;

const COLOR_PRESETS: Record<string, string> = {
    blurple: "#5865F2",
    green: "#57F287",
    yellow: "#FEE75C",
    red: "#ED4245",
    fuchsia: "#EB459E",
    cyan: "#00A8FC",
    white: "#FFFFFF",
};

const POSITION_VARS: Record<string, { slide: string; origin: string }> = {
    "top-right": { slide: "translateX(40px)", origin: "top right" },
    "top-left": { slide: "translateX(-40px)", origin: "top left" },
    "bottom-right": { slide: "translateX(40px)", origin: "bottom right" },
    "bottom-left": { slide: "translateX(-40px)", origin: "bottom left" },
    "top-center": { slide: "translateY(-40px)", origin: "top center" },
    "bottom-center": { slide: "translateY(40px)", origin: "bottom center" },
};

const TOAST_ICONS: Record<string, string> = {
    success:
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 8h.01"/><path d="M12 11v5"/></svg>',
};

function getDefaults(): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    try {
        for (const [key, def] of Object.entries((settings as any).def ?? {})) {
            const d = (def as any)?.default;
            if (d !== undefined) defaults[key] = d;
        }
    } catch {}
    return defaults;
}

function normalizeHex(raw: string | undefined | null, fallback: string): string {
    if (typeof raw !== "string") return fallback;
    const hex = raw.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
        return `#${hex
            .split("")
            .map((char) => `${char}${char}`)
            .join("")}`;
    }
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;
    return fallback;
}

function hexToRgbParts(hex: string): string {
    const parts = hex.replace("#", "").match(/.{2}/g);
    if (!parts || parts.length < 3) return "88,101,242";
    return parts.map((part) => parseInt(part, 16)).join(",");
}

function hexToRgba(raw: string | undefined | null, alpha: number): string {
    const hex = normalizeHex(raw, "#000000");
    const parts = hex.replace("#", "").match(/.{2}/g);
    if (!parts || parts.length < 3) return `rgba(0,0,0,${alpha})`;
    return `rgba(${parts.map((part) => parseInt(part, 16)).join(",")},${alpha})`;
}

function borderCss(raw: string | undefined | null): string {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (/^rgba?\(/i.test(value)) return value;
    return normalizeHex(value, "#FFFFFF");
}

function clampNum(raw: unknown, min: number, max: number, fallback: number): number {
    const value = typeof raw === "number" && isFinite(raw) ? raw : fallback;
    return Math.min(Math.max(value, min), max);
}

function resolveAccent(raw: string | undefined | null): string {
    if (typeof raw !== "string") return "#5865F2";
    if (COLOR_PRESETS[raw]) return COLOR_PRESETS[raw];
    if (raw === "custom") return "#5865F2";
    return normalizeHex(raw, "#5865F2");
}

export function DesignPreview() {
    const values = settings.use([...PREVIEW_KEYS] as never) as Record<string, any>;
    const defaults = getDefaults();
    const read = (key: string) => (values[key] == null ? defaults[key] : values[key]);

    const rawStyle = String(read("toastStyle") ?? "glass");
    const style = ["glass", "solid", "minimal"].includes(rawStyle) ? rawStyle : "glass";
    const position = String(read("toastPosition") ?? "top-right");
    const safePosition = POSITION_VARS[position] ? position : "top-right";
    const opacity = clampNum(read("toastOpacity") ?? 85, 0, 100, 85) / 100;
    const radius = Math.round(clampNum(read("toastBorderRadius") ?? 10, 0, 32, 10));
    const fontSize = Math.round(clampNum(read("toastFontSize") ?? 13, 8, 24, 13));
    const padding = Math.round(clampNum(read("toastPadding") ?? 10, 2, 24, 10));
    const maxWidth = Math.round(clampNum(read("toastMaxWidth") ?? 400, 200, 800, 400));
    const accent = resolveAccent(read("toastAccentColor") as string);
    const showTimer = read("toastShowTimer") !== false;

    // These are the same variables/classes `utils/notifications.ts` feeds to
    // the live container, so the default preview is pixel-identical to a real
    // toast and every slider updates it immediately.
    const containerStyle: React.CSSProperties & Record<string, string | number> = {
        position: "relative",
        top: "auto",
        right: "auto",
        bottom: "auto",
        left: "auto",
        transform: "none",
        width: "100%",
        maxWidth,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 10,
        pointerEvents: "auto",
        "--cc-toast-bg": hexToRgba(read("toastBgColor") as string, opacity),
        "--cc-accent": accent,
        "--cc-accent-rgb": hexToRgbParts(accent),
        "--cc-toast-text": normalizeHex(read("toastTextColor") as string, "#FFFFFF"),
        "--cc-percent": normalizeHex(read("toastPercentColor") as string, "#43B581"),
        "--cc-bar-bg": normalizeHex(read("toastBarBgColor") as string, "#333333"),
        "--cc-border": borderCss(read("toastBorderColor") as string),
        "--cc-toast-radius": `${radius}px`,
        "--cc-toast-font-size": `${fontSize}px`,
        "--cc-toast-padding": `${padding}px`,
        "--cc-toast-max-width": `${maxWidth}px`,
        "--cc-toast-slide": POSITION_VARS[safePosition].slide,
        "--cc-toast-origin": POSITION_VARS[safePosition].origin,
    };

    return (
        <LivePreviewSurface
            meta={`${style} · ${safePosition} · all toast types · values update instantly`}
        >
            <div
                className="cloner-toast-container"
                data-pos={safePosition}
                data-style={style}
                style={containerStyle}
            >
                <div className="cloner-pill always-expanded">
                    <div className="cloner-pill-compact">
                        <div className="cloner-pill-spinner" />
                        <span className="cloner-pill-title">Cloning #general</span>
                        {showTimer && <span className="cloner-pill-timer">12s</span>}
                        <span className="cloner-pill-percent">48%</span>
                    </div>
                    <div className="cloner-pill-expanded">
                        <div className="cloner-pill-expanded-inner">
                            <div className="cloner-pill-body">Viewing your clone progress</div>
                            <div className="cloner-pill-progress-bar">
                                <div
                                    className="cloner-pill-progress-fill"
                                    style={{ transform: "scaleX(0.48)" }}
                                />
                            </div>
                            <div className="cloner-pill-actions">
                                <button className="cloner-toast-btn default">Skip roles</button>
                                <button className="cloner-toast-btn danger">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="cloner-sub-pill success">
                    <div
                        className="cloner-sub-pill-icon success"
                        dangerouslySetInnerHTML={{ __html: TOAST_ICONS.success }}
                    />
                    <div className="cloner-sub-pill-content">
                        <div className="cloner-sub-pill-title">Channels cloned</div>
                        <div className="cloner-sub-pill-body">42 of 42 channels ready</div>
                    </div>
                    <button className="cloner-toast-close" title="Dismiss">
                        &times;
                    </button>
                </div>

                <div className="cloner-sub-pill info">
                    <div
                        className="cloner-sub-pill-icon info"
                        dangerouslySetInnerHTML={{ __html: TOAST_ICONS.info }}
                    />
                    <div className="cloner-sub-pill-content">
                        <div className="cloner-sub-pill-title">Cloning roles</div>
                        <div className="cloner-sub-pill-body">Progress updates appear here</div>
                    </div>
                    <button className="cloner-toast-close" title="Dismiss">
                        &times;
                    </button>
                </div>

                <div className="cloner-sub-pill error">
                    <div
                        className="cloner-sub-pill-icon error"
                        dangerouslySetInnerHTML={{ __html: TOAST_ICONS.error }}
                    />
                    <div className="cloner-sub-pill-content">
                        <div className="cloner-sub-pill-title">Webhook skipped</div>
                        <div className="cloner-sub-pill-body">Missing manage webhooks access</div>
                    </div>
                    <button className="cloner-toast-close" title="Dismiss">
                        &times;
                    </button>
                </div>
            </div>
        </LivePreviewSurface>
    );
}
