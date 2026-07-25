export interface CloneOptions {
    cloneChannels: boolean;
    cloneRoles: boolean;
    cloneOnboarding: boolean;
    cloneSystemFlags: boolean;
    resumeMode: boolean;
    targetGuildId: string | null;
    cloneStickers?: boolean;
    cloneSoundboard?: boolean;
}

export interface NotificationAction {
    label: string;
    onClick: (id: string) => void;
    type?: "default" | "danger";
    id?: string;
}

export interface CloneStats {
    channelsCloned: number;
    categoriesCloned: number;
    rolesCloned: number;
    emojisCloned: number;
    stickersCloned: number;
    soundboardCloned: number;
    onboardingCloned: boolean;
}

export interface CloneFailure {
    context: string;
    name: string;
    error: string;
}
