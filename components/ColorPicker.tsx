// ---------------------------------------------------------------------------
// HSV color picker used by the toast customization settings
// (components/ToastSettings.tsx).
//
// Adapted from Questcord (https://github.com/zpt0/questcord) by zpt0,
// licensed AGPL-3.0 — Clonecord shares the same author. The R/G/B number
// inputs of the original are intentionally omitted: colors are picked
// visually (saturation/value panel + hue slider) or via the hex field.
// ---------------------------------------------------------------------------

import { React, ReactDOM } from "@webpack/common";

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    s /= 100;
    v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0,
        g = 0,
        b = 0;
    if (h < 60) {
        r = c;
        g = x;
    } else if (h < 120) {
        r = x;
        g = c;
    } else if (h < 180) {
        g = c;
        b = x;
    } else if (h < 240) {
        g = x;
        b = c;
    } else if (h < 300) {
        r = x;
        b = c;
    } else {
        r = c;
        b = x;
    }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : (d / max) * 100;
    const v = max * 100;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        else if (max === g) h = ((b - r) / d + 2) * 60;
        else h = ((r - g) / d + 4) * 60;
    }
    return [h, s, v];
}

function hexToRgb(hex: string): [number, number, number] {
    const m = hex.replace("#", "").match(/.{2}/g);
    if (!m || m.length < 3) return [88, 101, 242];
    return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
    return (
        "#" +
        [r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("")
    );
}

function isValidHex(hex: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

interface ColorPickerProps {
    value: string;
    onChange: (hex: string) => void;
    /** Color shown while `value` is not a plain hex (e.g. rgba() defaults). */
    fallback?: string;
}

export function ColorPicker({ value, onChange, fallback = "#5865F2" }: ColorPickerProps) {
    const [open, setOpen] = React.useState(false);
    const [hexInput, setHexInput] = React.useState(value);
    const [popoverPos, setPopoverPos] = React.useState<{ top: number; left: number } | null>(null);
    const popoverRef = React.useRef<HTMLDivElement>(null);
    const panelRef = React.useRef<HTMLDivElement>(null);
    const hueRef = React.useRef<HTMLDivElement>(null);
    const swatchRef = React.useRef<HTMLDivElement>(null);
    const [isDraggingPanel, setIsDraggingPanel] = React.useState(false);
    const [isDraggingHue, setIsDraggingHue] = React.useState(false);

    // the stored value may be an rgba() string (e.g. the border default) —
    // edit from the fallback color in that case
    const safeValue = isValidHex(value) ? value : fallback;
    const [r, g, b] = hexToRgb(safeValue);
    const [hue, sat, val] = rgbToHsv(r, g, b);

    React.useEffect(() => {
        setHexInput(value);
    }, [value]);

    React.useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            const t = e.target as Node;
            if (
                popoverRef.current &&
                !popoverRef.current.contains(t) &&
                swatchRef.current &&
                !swatchRef.current.contains(t)
            ) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    function updateFromHSV(h: number, s: number, v: number) {
        const [rr, gg, bb] = hsvToRgb(h, s, v);
        onChange(rgbToHex(rr, gg, bb));
    }

    function handlePanelMouse(e: React.MouseEvent) {
        const rect = panelRef.current!.getBoundingClientRect();
        const s = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const v = Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100));
        updateFromHSV(hue, s, v);
    }

    function handleHueMouse(e: React.MouseEvent) {
        const rect = hueRef.current!.getBoundingClientRect();
        const h = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
        updateFromHSV(h, sat, val);
    }

    function handlePanelDown(e: React.MouseEvent) {
        handlePanelMouse(e);
        setIsDraggingPanel(true);
        function onMove(ev: MouseEvent) {
            if (!panelRef.current) return;
            const rect = panelRef.current.getBoundingClientRect();
            const s = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
            const v = Math.max(
                0,
                Math.min(100, 100 - ((ev.clientY - rect.top) / rect.height) * 100)
            );
            updateFromHSV(hue, s, v);
        }
        function onUp() {
            setIsDraggingPanel(false);
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }

    function handleHueDown(e: React.MouseEvent) {
        handleHueMouse(e);
        setIsDraggingHue(true);
        function onMove(ev: MouseEvent) {
            if (!hueRef.current) return;
            const rect = hueRef.current.getBoundingClientRect();
            const h = Math.max(0, Math.min(360, ((ev.clientX - rect.left) / rect.width) * 360));
            updateFromHSV(h, sat, val);
        }
        function onUp() {
            setIsDraggingHue(false);
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }

    function handleHexInput(v: string) {
        setHexInput(v);
        if (isValidHex(v)) onChange(v.toUpperCase());
    }

    const hueRgb = hsvToRgb(hue, 100, 100);
    const hueColor = rgbToHex(hueRgb[0], hueRgb[1], hueRgb[2]);

    const panelStyle: React.CSSProperties = {
        background: `
            linear-gradient(to top, #000, transparent),
            linear-gradient(to right, #fff, ${hueColor})
        `,
    };

    return (
        <div style={{ position: "relative", display: "inline-block" }}>
            <div
                ref={swatchRef}
                onClick={() => {
                    if (!open && swatchRef.current) {
                        const rect = swatchRef.current.getBoundingClientRect();
                        setPopoverPos({ top: rect.bottom + 8, left: rect.left });
                    }
                    setOpen(!open);
                }}
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    backgroundColor: safeValue,
                    border: "2px solid rgba(255,255,255,0.15)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    cursor: "pointer",
                    transition: "transform 0.15s",
                    flexShrink: 0,
                    userSelect: "none",
                }}
            />
            {open &&
                popoverPos &&
                ReactDOM.createPortal(
                    <div
                        ref={popoverRef}
                        style={{
                            position: "fixed",
                            top: popoverPos.top,
                            left: popoverPos.left,
                            background: "#2b2d31",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 12,
                            padding: 12,
                            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                            // max int32 so the popover beats every discord overlay
                            zIndex: 2147483647,
                            width: 240,
                        }}
                    >
                        <div
                            ref={panelRef}
                            onMouseDown={handlePanelDown}
                            style={{
                                ...panelStyle,
                                width: "100%",
                                height: 160,
                                borderRadius: 8,
                                position: "relative",
                                cursor: "crosshair",
                                marginBottom: 10,
                                userSelect: "none",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    left: `${sat}%`,
                                    top: `${100 - val}%`,
                                    width: isDraggingPanel ? 16 : 14,
                                    height: isDraggingPanel ? 16 : 14,
                                    borderRadius: "50%",
                                    border: "2px solid white",
                                    boxShadow: isDraggingPanel
                                        ? "0 0 0 2px rgba(88,101,242,0.6), 0 0 8px rgba(0,0,0,0.5)"
                                        : "0 0 4px rgba(0,0,0,0.5)",
                                    transform: "translate(-50%, -50%)",
                                    pointerEvents: "none",
                                    transition: "width 0.1s, height 0.1s, box-shadow 0.1s",
                                }}
                            />
                        </div>

                        <div
                            ref={hueRef}
                            onMouseDown={handleHueDown}
                            style={{
                                background:
                                    "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                                width: "100%",
                                height: 14,
                                borderRadius: 7,
                                position: "relative",
                                cursor: "pointer",
                                marginBottom: 10,
                                userSelect: "none",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    top: "50%",
                                    left: `${(hue / 360) * 100}%`,
                                    width: isDraggingHue ? 20 : 18,
                                    height: isDraggingHue ? 20 : 18,
                                    borderRadius: "50%",
                                    border: "2px solid white",
                                    boxShadow: isDraggingHue
                                        ? "0 0 0 2px rgba(88,101,242,0.6), 0 0 8px rgba(0,0,0,0.5)"
                                        : "0 0 4px rgba(0,0,0,0.5)",
                                    transform: "translate(-50%, -50%)",
                                    pointerEvents: "none",
                                    transition: "width 0.1s, height 0.1s, box-shadow 0.1s",
                                }}
                            />
                        </div>

                        <input
                            type="text"
                            value={hexInput}
                            onChange={(e) => handleHexInput(e.target.value)}
                            maxLength={7}
                            placeholder="#5865F2"
                            style={{
                                width: "100%",
                                background: "#1e1f22",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 6,
                                color: "#dbdee1",
                                padding: "6px 8px",
                                fontSize: 13,
                                fontFamily: "monospace",
                                outline: "none",
                                boxSizing: "border-box",
                                userSelect: "text",
                            }}
                        />
                    </div>,
                    document.body
                )}
        </div>
    );
}
