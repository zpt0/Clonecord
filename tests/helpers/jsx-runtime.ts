export interface StubElement {
    readonly type: unknown;
    readonly props: Record<string, unknown>;
    readonly children: unknown[];
}

export const Fragment = Symbol("Fragment");

function createElement(type: unknown, props: Record<string, unknown> | null): StubElement {
    const safeProps = props ?? {};
    const children =
        safeProps.children === undefined
            ? []
            : Array.isArray(safeProps.children)
              ? safeProps.children
              : [safeProps.children];
    return { type, props: safeProps, children };
}

export function jsx(type: unknown, props: Record<string, unknown> | null): StubElement {
    return createElement(type, props);
}

export function jsxs(type: unknown, props: Record<string, unknown> | null): StubElement {
    return createElement(type, props);
}

export function jsxDEV(type: unknown, props: Record<string, unknown> | null): StubElement {
    return createElement(type, props);
}
