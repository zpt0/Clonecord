declare module "@api/index" {
    export const DataStore: {
        get(key: string): Promise<any>;
        set(key: string, value: any): Promise<void>;
        delete(key: string): Promise<void>;
        keys(category?: string): Promise<string[]>;
        entries(category?: string): Promise<[string, any][]>;
    };
}
