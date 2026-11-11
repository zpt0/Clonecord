declare module "@components/Heading" {
    import type React from "react";

    export type HeadingTag = `h${1 | 2 | 3 | 4 | 5 | 6}`;

    export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
        tag?: HeadingTag;
    }

    export const Heading: React.FC<HeadingProps>;
}
