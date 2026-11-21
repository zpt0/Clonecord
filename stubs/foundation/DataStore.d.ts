declare module "@api/DataStore" {
    export function get<T = unknown>(key: IDBValidKey): Promise<T | undefined>;
    export function set(key: IDBValidKey, value: unknown): Promise<void>;
    export function del(key: IDBValidKey): Promise<void>;
    export function keys<KeyType extends IDBValidKey = IDBValidKey>(): Promise<KeyType[]>;
}
