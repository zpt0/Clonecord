# Changelog

## [0.1.1] - 2026-11-27

### Fixed

- Added a support-invite guard so accounts already in the support server are never sent to the invite, even if a stored flag says otherwise.
- Membership is checked against Discord's guild list (`1508481905291558942`) instead of localStorage, and is re-evaluated on `CONNECTION_OPEN` once Discord has loaded the guild list.

### Changed

- New `supportServer.ts` with `checkSupportServerMembership()` and `canOpenSupportInvite()`, wired into startup, `CONNECTION_OPEN` and shutdown.
- Plugin version and release tag aligned at `0.1.1`.

## [0.1.0]

- Initial release of Clonecord, a Vencord userplugin for cloning servers with channels, roles, permissions and community features.
- Progress toasts and pills with Clonecord-style glass/solid/minimal variants and a live design preview.
- Shared Foundation: author/favorite/source buttons, toast logger, patch status and manual update panel.
