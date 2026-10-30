declare module "@components/Button" {
    import type React from "react";

    export type ButtonVariant =
        | "primary"
        | "secondary"
        | "dangerPrimary"
        | "dangerSecondary"
        | "overlayPrimary"
        | "positive"
        | "link"
        | "none";

    export type ButtonSize = "min" | "xs" | "small" | "medium" | "iconOnly";

    export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
        variant?: ButtonVariant;
        size?: ButtonSize;
    }

    export const Button: React.FC<ButtonProps>;
}
