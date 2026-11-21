declare module "@vencord/discord-types" {
    export interface Guild {
        id: string;
        name: string;
        icon: string | null;
        description: string | null;
        splash: string | null;
        banner: string | null;
        owner_id: string;
        region: string;
        verification_level: number;
        default_message_notifications: number;
        explicit_content_filter: number;
        mfa_level: number;
        features: string[];
        premium_tier: number;
        premium_subscription_count: number;
        system_channel_flags: number;
        system_channel_id: string | null;
        rules_channel_id: string | null;
        public_updates_channel_id: string | null;
        max_members?: number;
        max_presences?: number;
        vanity_url_code: string | null;
        preferred_locale?: string;
        approximate_member_count?: number;
        approximate_presence_count?: number;
        [key: string]: any;
    }

    export interface Channel {
        id: string;
        guild_id: string;
        name: string;
        type: number;
        topic?: string | null;
        position?: number;
        parent_id?: string | null;
        permission_overwrites?: any[];
        nsfw?: boolean;
        bitrate?: number;
        user_limit?: number;
        rate_limit_per_user?: number;
        [key: string]: any;
    }

    export interface Role {
        id: string;
        guild_id: string;
        name: string;
        color: number;
        hoist: boolean;
        icon?: string | null;
        unicode_emoji?: string | null;
        position: number;
        permissions: string;
        mentionable: boolean;
        tags?: any;
        [key: string]: any;
    }

    export interface User {
        id: string;
        username: string;
        discriminator: string;
        avatar: string | null;
        global_name?: string | null;
        avatar_decoration?: string | null;
        bot?: boolean;
        system?: boolean;
        [key: string]: any;
    }
}
