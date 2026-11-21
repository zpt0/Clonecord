declare module "*.css" {
    const content: Record<string, string>;
    export default content;
}

declare module "*?managed" {
    const managedStyle: string;
    export default managedStyle;
}
