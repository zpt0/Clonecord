declare module "@webpack/common" {
    import React from "react";

    const Menu: {
        Menu: React.FC<any>;
        MenuItem: React.FC<any>;
        MenuGroup: React.FC<any>;
        MenuSeparator: React.FC<any>;
        MenuCheckboxItem: React.FC<any>;
        MenuRadioItem: React.FC<any>;
        MenuText: React.FC<any>;
        MenuSearch: React.FC<any>;
        MenuControlItem: React.FC<any>;
    };

    const RestAPI: {
        get(options: {
            url: string;
            query?: Record<string, any>;
        }): Promise<{ body: any; status: number }>;
        post(options: {
            url: string;
            body?: any;
            query?: Record<string, any>;
        }): Promise<{ body: any; status: number }>;
        patch(options: {
            url: string;
            body?: any;
            query?: Record<string, any>;
        }): Promise<{ body: any; status: number }>;
        put(options: {
            url: string;
            body?: any;
            query?: Record<string, any>;
        }): Promise<{ body: any; status: number }>;
        delete(options: {
            url: string;
            body?: any;
            query?: Record<string, any>;
        }): Promise<{ body: any; status: number }>;
        del(options: {
            url: string;
            body?: any;
            query?: Record<string, any>;
        }): Promise<{ body: any; status: number }>;
    };

    const GuildStore: {
        getGuild(guildId: string): any;
        getGuilds(): Record<string, any>;
        getMutableGuilds(): Record<string, any>;
    };

    const GuildRoleStore: {
        getSortedRoles(guildId: string): any[];
        getRoles(guildId: string): Record<string, any>;
    };

    const GuildChannelStore: {
        getChannels(guildId: string): any;
        getMutableGuildChannelsForGuild(guildId: string): Record<string, any>;
        getChannel(channelId: string): any;
    };

    const UserStore: {
        getCurrentUser(): any;
        getUser(userId: string): any;
        getUsers(): Record<string, any>;
    };

    const SearchableSelect: React.FC<any>;

    const Checkbox: React.FC<any>;

    const Button: React.FC<any> & {
        Link: React.FC<any>;
        Color: {
            BRAND: number;
            GREEN: number;
            RED: number;
            YELLOW: number;
            PRIMARY: number;
            LINK: number;
        };
        Colors: {
            BRAND: number;
            GREEN: number;
            RED: number;
            YELLOW: number;
            PRIMARY: number;
            LINK: number;
        };
        Look: {
            FILLED: number;
            OUTLINED: number;
            LINK: number;
            INVERTED: number;
        };
        Sizes: {
            SMALL: number;
            MEDIUM: number;
            LARGE: number;
            MIN: number;
        };
    };

    const NavigationRouter: {
        transitionTo(path: string): void;
        back(): void;
        forward(): void;
    };

    const ChannelStore: {
        getChannel(channelId: string): any;
        getChannels(guildId: string): any;
    };

    const InviteActions: {
        resolveInvite(
            code: string,
            context: string
        ): Promise<{ invite: { guild: { id: string }; channel: { id: string } } | null }>;
    };

    const Parser: {
        parse(input: string, allowLinks?: boolean): React.ReactNode;
    };

    export {
        React,
        Menu,
        RestAPI,
        GuildStore,
        GuildRoleStore,
        GuildChannelStore,
        UserStore,
        SearchableSelect,
        Checkbox,
        Button,
        NavigationRouter,
        ChannelStore,
        InviteActions,
        Parser,
    };
}
