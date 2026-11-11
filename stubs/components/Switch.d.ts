declare module "@components/Switch" {
    import type React from "react";

    export interface SwitchProps {
        disabled?: boolean;
        checked: boolean;
        onChange: (checked: boolean) => void;
    }

    export const Switch: React.FC<SwitchProps>;
}
