declare module "@components/Text" {
    import type React from "react";

    export interface TextProps extends React.HTMLAttributes<HTMLElement> {
        tag?: "div" | "span" | "p" | `h${1 | 2 | 3 | 4 | 5 | 6}`;
        size?: "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
        weight?:
            | "thin"
            | "extralight"
            | "light"
            | "normal"
            | "medium"
            | "semibold"
            | "bold"
            | "extrabold";
        defaultColor?: boolean;
    }

    export const Text: React.FC<React.PropsWithChildren<TextProps>>;
}
