import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Text } from "@components/Text";
import type { DefinedSettings } from "@utils/types";
import {
    ColorPicker,
    ConfirmModal,
    React,
    ReactDOM,
    Select,
    Slider,
    openModal,
    type RenderModalProps,
} from "@webpack/common";
import type { ReactNode } from "react";

import {
    getNumericBound,
    getSettingDefault,
    getSettingMarkers,
    getSettingOptions,
    getValidationError,
    inferControl,
    isRestartRequired,
    writeSetting,
} from "./model";
import type {
    BadgeTone,
    SettingDefinitionLike,
    SettingFieldDefinition,
    SettingsActionDefinition,
    SettingsGroupDefinition,
} from "./types";

const PREFIX = "vc-platform-settings";

function cx(...parts: Array<string | false | null | undefined>): string {
    return parts
        .filter((part): part is string => typeof part === "string" && part.length > 0)
        .map((part) => `${PREFIX}-${part}`)
        .join(" ");
}

function parseColorNumber(value: string): number | null {
    const trimmed = value.trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(trimmed)) {
        const [r, g, b] = trimmed.split("");
        return parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
    }
    if (/^[0-9a-f]{6}$/i.test(trimmed)) return parseInt(trimmed, 16);
    if (/^0x[0-9a-f]{6}$/i.test(value.trim())) return Number(value.trim());

    const rgb = trimmed.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (rgb) {
        const [r, g, b] = rgb.slice(1).map(Number);
        if (
            r !== undefined &&
            g !== undefined &&
            b !== undefined &&
            [r, g, b].every((channel) => channel >= 0 && channel <= 255)
        ) {
            return (r << 16) | (g << 8) | b;
        }
    }
    return null;
}

function formatColorNumber(value: number | null): string {
    return `#${((value ?? 0) >>> 0).toString(16).padStart(6, "0")}`;
}

export function Badge({
    children,
    tone = "neutral",
    dot = false,
}: {
    readonly children?: React.ReactNode;
    readonly tone?: BadgeTone;
    readonly dot?: boolean;
}) {
    return (
        <span className={cx("badge", `badge-${tone}`)}>
            {dot && <span className={cx("badge-dot")} />}
            {children}
        </span>
    );
}

export function InfoButton({
    text,
    label = "More information",
}: {
    readonly text: string;
    readonly label?: string;
}) {
    const anchorRef = React.useRef<HTMLSpanElement>(null);
    const [anchor, setAnchor] = React.useState<{ top: number; left: number } | null>(null);

    const show = React.useCallback(() => {
        const element = anchorRef.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        setAnchor({
            top: Math.min(rect.bottom + 6, Math.max(8, window.innerHeight - 160)),
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 272)),
        });
    }, []);
    const hide = React.useCallback(() => setAnchor(null), []);

    return (
        <span className={cx("info")}>
            <span
                ref={anchorRef}
                className={cx("info-button")}
                role="img"
                aria-label={label}
                tabIndex={0}
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show}
                onBlur={hide}
            >
                i
            </span>
            {anchor &&
                ReactDOM.createPortal(
                    <span
                        className={cx("info-popover")}
                        role="note"
                        style={{ top: anchor.top, left: anchor.left }}
                    >
                        {text}
                    </span>,
                    document.body
                )}
        </span>
    );
}

export function LivePreviewSurface({
    children,
    meta,
}: {
    readonly children: ReactNode;
    readonly meta?: string;
}) {
    return (
        <div className={cx("preview")}>
            <div className={cx("preview-meta")}>{meta ?? "Live preview · updates instantly"}</div>
            <div className={cx("preview-stage")}>{children}</div>
        </div>
    );
}

export function SectionHeader({
    title,
    description,
    badge,
    badgeTone = "neutral",
}: {
    readonly title: string;
    readonly description?: string;
    readonly badge?: string;
    readonly badgeTone?: BadgeTone;
}) {
    return (
        <div className={cx("section-header")}>
            <div className={cx("section-header-title")}>
                <Heading tag="h4">{title}</Heading>
                {badge && <Badge tone={badgeTone}>{badge}</Badge>}
            </div>
            {description && (
                <Paragraph className={cx("section-description")}>{description}</Paragraph>
            )}
        </div>
    );
}

function SettingRow({
    field,
    children,
    settings,
    def,
}: {
    readonly field: SettingFieldDefinition;
    readonly children: ReactNode;
    readonly settings: DefinedSettings;
    readonly def?: SettingDefinitionLike;
}) {
    const restart = isRestartRequired(def);
    return (
        <div
            className={cx("field", field.width === "full" ? "field-full" : "field-half")}
            data-setting-key={field.key}
        >
            <div className={cx("field-copy")}>
                <div className={cx("field-label-row")}>
                    <Heading tag="h5" className={cx("field-label")}>
                        {field.label}
                    </Heading>
                    {field.info && <InfoButton text={field.info} />}
                    {field.badge && (
                        <Badge tone={field.badgeTone ?? "neutral"}>{field.badge}</Badge>
                    )}
                    {restart && <Badge tone="warning">Restart</Badge>}
                </div>
                <Paragraph className={cx("field-description")}>{field.description}</Paragraph>
            </div>
            <div className={cx("field-control")}>{children}</div>
            <div
                className={cx("field-settings-bound")}
                data-settings-bound={settings.pluginName || ""}
            />
        </div>
    );
}

function ToggleField({
    field,
    settings,
    def,
}: {
    readonly field: SettingFieldDefinition;
    readonly settings: DefinedSettings;
    readonly def: SettingDefinitionLike | undefined;
}) {
    const value = (settings.use([field.key as never]) as Record<string, unknown>)[field.key];
    return (
        <SettingRow field={field} settings={settings} def={def}>
            <label className={cx("switch-wrap")}>
                <input
                    type="checkbox"
                    checked={
                        value === undefined
                            ? Boolean(getSettingDefault(settings.def, field.key))
                            : Boolean(value)
                    }
                    onChange={(event) =>
                        writeSetting(settings, field.key, event.currentTarget.checked)
                    }
                />
                <span className={cx("switch-track")}>
                    <span className={cx("switch-thumb")} />
                </span>
            </label>
        </SettingRow>
    );
}

function SelectField({
    field,
    settings,
    def,
}: {
    readonly field: SettingFieldDefinition;
    readonly settings: DefinedSettings;
    readonly def: SettingDefinitionLike | undefined;
}) {
    const value = (settings.use([field.key as never]) as Record<string, unknown>)[field.key];
    const options = [...getSettingOptions(def)];
    return (
        <SettingRow field={field} settings={settings} def={def}>
            <div className={cx("select-wrap")}>
                <Select
                    className={cx("select")}
                    popoutWidth={260}
                    options={options}
                    select={(next: string | number | boolean) =>
                        writeSetting(settings, field.key, next)
                    }
                    isSelected={(option: string | number | boolean) => option === value}
                    serialize={(option: string | number | boolean) => String(option)}
                />
            </div>
        </SettingRow>
    );
}

function SliderField({
    field,
    settings,
    def,
}: {
    readonly field: SettingFieldDefinition;
    readonly settings: DefinedSettings;
    readonly def: SettingDefinitionLike | undefined;
}) {
    const value = (settings.use([field.key as never]) as Record<string, unknown>)[field.key];
    const markers = getSettingMarkers(def);
    const scale = field.valueScale ?? 1;
    const stored =
        typeof value === "number" ? value : Number(getSettingDefault(settings.def, field.key) ?? 0);
    const initial = stored / scale;
    return (
        <SettingRow field={field} settings={settings} def={def}>
            <div className={cx("slider-wrap")}>
                <Slider
                    className={cx("slider")}
                    initialValue={initial}
                    onValueChange={(next: number) =>
                        writeSetting(settings, field.key, next * scale)
                    }
                    minValue={markers.length > 0 ? markers[0] / scale : 0}
                    maxValue={markers.length > 0 ? markers[markers.length - 1] / scale : 100}
                    markers={markers.map((marker) => marker / scale)}
                    stickToMarkers={def?.stickToMarkers === true}
                />
                <span className={cx("slider-value")}>
                    {initial}
                    {field.unit ?? ""}
                </span>
            </div>
        </SettingRow>
    );
}

function NumberField({
    field,
    settings,
    def,
}: {
    readonly field: SettingFieldDefinition;
    readonly settings: DefinedSettings;
    readonly def: SettingDefinitionLike | undefined;
}) {
    const value = (settings.use([field.key as never]) as Record<string, unknown>)[field.key];
    const [error, setError] = React.useState<string | null>(null);
    const raw = value === undefined ? (getSettingDefault(settings.def, field.key) ?? "") : value;
    return (
        <SettingRow field={field} settings={settings} def={def}>
            <div className={cx("number-wrap")}>
                <input
                    className={cx("input", error && "input-invalid")}
                    type="number"
                    min={getNumericBound(def?.min)}
                    max={getNumericBound(def?.max)}
                    value={String(raw)}
                    onChange={(event) => {
                        const next = Number(event.currentTarget.value);
                        const validation = getValidationError(def, next);
                        if (validation !== null) {
                            setError(validation);
                            return;
                        }
                        setError(null);
                        writeSetting(settings, field.key, next);
                    }}
                />
                {error && <Text className={cx("input-error")}>{error}</Text>}
            </div>
        </SettingRow>
    );
}

function TextField({
    field,
    settings,
    def,
    color,
}: {
    readonly field: SettingFieldDefinition;
    readonly settings: DefinedSettings;
    readonly def: SettingDefinitionLike | undefined;
    readonly color?: boolean;
}) {
    const value = (settings.use([field.key as never]) as Record<string, unknown>)[field.key];
    const raw = value === undefined ? (getSettingDefault(settings.def, field.key) ?? "") : value;
    return (
        <SettingRow field={field} settings={settings} def={def}>
            <div className={cx("input-wrap", color && "input-wrap-color")}>
                {color && (
                    <span className={cx("color-picker-wrap")}>
                        <ColorPicker
                            color={parseColorNumber(String(raw))}
                            showEyeDropper={false}
                            onChange={(next: number | null) =>
                                writeSetting(settings, field.key, formatColorNumber(next))
                            }
                        />
                    </span>
                )}
                <input
                    className={cx("input")}
                    type="text"
                    spellCheck={false}
                    value={String(raw)}
                    onChange={(event) =>
                        writeSetting(settings, field.key, event.currentTarget.value)
                    }
                />
            </div>
        </SettingRow>
    );
}

export function SettingField({
    field,
    settings,
}: {
    readonly field: SettingFieldDefinition;
    readonly settings: DefinedSettings;
}) {
    const def = settings.def?.[field.key] as SettingDefinitionLike | undefined;
    const kind = field.control ?? inferControl(def, field.key);

    if (kind === "custom") {
        return (
            <SettingRow field={field} settings={settings} def={def}>
                {field.render ?? <Text className={cx("empty-copy")}>No renderer configured</Text>}
            </SettingRow>
        );
    }

    switch (kind) {
        case "toggle":
            return <ToggleField field={field} settings={settings} def={def} />;
        case "select":
            return <SelectField field={field} settings={settings} def={def} />;
        case "slider":
            return <SliderField field={field} settings={settings} def={def} />;
        case "number":
            return <NumberField field={field} settings={settings} def={def} />;
        case "color":
            return <TextField field={field} settings={settings} def={def} color />;
        default:
            return <TextField field={field} settings={settings} def={def} />;
    }
}

function ActionMenu({ action }: { readonly action: SettingsActionDefinition }) {
    const [open, setOpen] = React.useState(false);
    return (
        <span className={cx("action-menu")}>
            <button
                type="button"
                className={cx("action-menu-button")}
                aria-label={`${action.label} options`}
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                ⋯
            </button>
            {open && (
                <span className={cx("action-menu-list")} role="menu">
                    {(action.menu ?? []).map((item) => (
                        <button
                            type="button"
                            role="menuitem"
                            key={item.id}
                            className={cx(
                                "action-menu-item",
                                item.danger && "action-menu-item-danger"
                            )}
                            onClick={() => {
                                setOpen(false);
                                void item.run();
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </span>
            )}
        </span>
    );
}

function ActionControl({ action }: { readonly action: SettingsActionDefinition }) {
    const startConfirm = () => {
        openModal((props: RenderModalProps) => (
            <ConfirmDialog
                props={props}
                title={action.label}
                description="This action changes saved configuration. Continue?"
                confirmLabel={action.label}
                onConfirm={() => {
                    void action.run();
                }}
            />
        ));
    };

    return (
        <div className={cx("action-control")}>
            <Button size="small" variant={action.variant ?? "secondary"} onClick={startConfirm}>
                {action.label}
            </Button>
            {action.menu && <ActionMenu action={action} />}
        </div>
    );
}

export function ConfirmDialog({
    props,
    title,
    description,
    confirmLabel,
    onConfirm,
}: {
    readonly props: RenderModalProps;
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly onConfirm: () => void;
}) {
    return (
        <ConfirmModal
            {...props}
            title={title}
            confirmText={confirmLabel}
            variant="critical-primary"
            onConfirm={onConfirm}
        >
            <Paragraph>{description}</Paragraph>
        </ConfirmModal>
    );
}

export function ActionRow({ action }: { readonly action: SettingsActionDefinition }) {
    return (
        <div className={cx("field", "field-full", "action-row")} data-action-id={action.id}>
            <div className={cx("field-copy")}>
                <div className={cx("field-label-row")}>
                    <Heading tag="h5" className={cx("field-label")}>
                        {action.label}
                    </Heading>
                    {action.info && <InfoButton text={action.info} />}
                    {action.badge && (
                        <Badge tone={action.badgeTone ?? "neutral"}>{action.badge}</Badge>
                    )}
                </div>
                <Paragraph className={cx("field-description")}>{action.description}</Paragraph>
            </div>
            <div className={cx("field-control")}>
                <ActionControl action={action} />
            </div>
        </div>
    );
}

function renderGroupContent(content: SettingsGroupDefinition["render"]): ReactNode {
    if (typeof content === "function") return React.createElement(content);
    return content ?? null;
}

export function SettingsGroupCard({
    group,
    settings,
}: {
    readonly group: SettingsGroupDefinition;
    readonly settings: DefinedSettings;
}) {
    return (
        <Card className={cx("group-card")}>
            <div className={cx("group-header")}>
                <Heading tag="h5">{group.title}</Heading>
                {group.description && (
                    <Paragraph className={cx("group-description")}>{group.description}</Paragraph>
                )}
            </div>
            {(group.fields?.length ?? 0) > 0 && (
                <div className={cx("field-grid")}>
                    {group.fields!.map((field) => (
                        <SettingField key={field.key} field={field} settings={settings} />
                    ))}
                </div>
            )}
            {(group.actions?.length ?? 0) > 0 && (
                <div className={cx("action-list")}>
                    {group.actions!.map((action) => (
                        <ActionRow key={action.id} action={action} />
                    ))}
                </div>
            )}
            {renderGroupContent(group.render)}
        </Card>
    );
}

export { cx };
