declare module "@components/Card" {
    import type React from "react";

    export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
        variant?: "normal" | "warning" | "danger" | "info" | "success";
        defaultPadding?: boolean;
    }

    export const Card: React.FC<React.PropsWithChildren<CardProps>>;
}
