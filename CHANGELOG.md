# Changelog

## [1.1.2]

- Dev dependency updates: eslint 10.9.1, typescript-eslint 8.68.0, @types/node 26.4.0, vitest 4.1.11, @vitest/coverage-v8 4.1.11
- @vencord/discord-types held at 1.0.1 (1.0.2 pins peer @types/react to exactly 19.1.0)
- No functional changes

## [1.1.0]

- Post-clone summary notification showing cloned items count and failures
- Retry button for failed items directly from the summary notification
- Source server icon thumbnail displayed in the CloneModal header
- Channel and role counts shown as badges in the CloneModal
- Diff preview showing channel/role differences between source and target servers
- Optimized `escapeHtml` utility to use string-based approach instead of DOM
- Voice channel bitrate and user_limit now properly tracked per boost tier

## [1.0.0]

- Clone channels (text, voice, announcement, stage, forum, media, categories) with permission overwrites
- Clone roles with permissions, colors, hoist, mentionable, and role icons
- Clone emojis referenced in role names, channel names/topics, onboarding prompts, and guild description
- Clone stickers (PNG, APNG, Lottie, GIF) respecting boost-tier slot limits
- Clone soundboard sounds respecting boost-tier slot limits
- Clone onboarding prompts, default channels, and auto-fix @everyone permission issues
- Clone server settings (name, icon, banner, splash, description, system channels, community features)
- Clone channel position ordering in batched requests
- Resume mode: add only missing items to an existing server
- Overwrite mode: clear and re-clone an owned server
- Adaptive rate-limit handling with concurrency downscaling on 429 errors
- Animated progress pill notifications with cancel support
- In-app update checker via GitHub Releases API
- Discord error code translation with fatal error detection
- Context menu integration ("Clone Server" in guild context menu and header popout)
