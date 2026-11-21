declare module "@api/ContextMenu" {
    type NavContextMenuPatchCallback = (children: any[], props: Record<string, any>) => void;

    export function findGroupChildrenByChildId(id: string, children?: any[]): any;
    export function addContextMenuPatch(id: string, callback: NavContextMenuPatchCallback): void;
    export function removeContextMenuPatch(id: string, callback: NavContextMenuPatchCallback): void;
}
