import { GuildStore, UserStore } from "@webpack/common";

import { SUPPORT_GUILD_ID } from "./constants";

let isMember = false;
let membershipKnown = false;

/**
 * Discord's guild list is the only source of truth for support-server
 * membership. A localStorage flag can go stale and must never override it.
 */
export function checkSupportServerMembership(): boolean {
    try {
        isMember =
            Boolean(GuildStore?.getGuild?.(SUPPORT_GUILD_ID)) ||
            Boolean(GuildStore?.getGuilds?.()?.[SUPPORT_GUILD_ID]);
    } catch {
        isMember = false;
    }

    try {
        // Before CONNECTION_OPEN the guild list is empty and would look like
        // "not a member" even for actual members.
        membershipKnown = Boolean(UserStore?.getCurrentUser?.()) || isMember;
    } catch {
        membershipKnown = isMember;
    }

    return isMember;
}

/** Guard for any support-invite action: members are never sent to the invite. */
export function canOpenSupportInvite(): boolean {
    if (!membershipKnown) checkSupportServerMembership();
    return membershipKnown && !isMember;
}

export function resetSupportServerMembership(): void {
    isMember = false;
    membershipKnown = false;
}
