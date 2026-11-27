# Clonecord Phase 3 migration checklist

This checklist was written before any Clonecord source was modified. The foundation repository had already received scoped MIT/license and scaffold housekeeping, but no plugin files had been changed.

## Scope and constraints

- Migrate **Clonecord only**. Questcord and Manycord are untouched.
- Keep the plugin independently installable: foundation source is copied into `Clonecord/foundation/`, never imported from the foundation repository at runtime.
- Preserve Clonecord's AGPL-3.0-only license and attribution comments.
- Preserve plugin metadata, settings keys/defaults, DataStore keys/formats, checkpoint semantics, patch anchors, context menus, toast DOM/CSS, and update behavior.
- No commits, pushes, history rewrites, Vencord modifications, or unrelated file changes.

## Phase 1 analysis status

No standalone Phase 1 analysis file was present in `Vencord-Plugin-Foundation`. The only references are documentation notes that BadgeCord was Phase 1 analysis only. This checklist therefore uses the current Clonecord source as the authoritative migration inventory, supplemented by the Phase 2 foundation source.

## Architecture mapping

| Existing module          | Migration action                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.tsx`              | Thin Vencord entry point: metadata, context menus, foundation runtime start/stop, tracked startup timeout, patch manifest output.                   |
| `settings.ts`            | Replace `definePluginSettings` with `defineFoundationSettings`; preserve every existing key/default/flag and add foundation metadata.               |
| `store.ts`               | Preserve the exact state shape; add an explicit reset helper for lifecycle cleanup.                                                                 |
| `core/clone.ts`          | Domain orchestration unchanged; route abort controller and progress timer through foundation-owned resources.                                       |
| `core/checkpoints.ts`    | Preserve key/schema/TTL/60-second rules; route delayed deletion through foundation-owned timeout when a scope is active.                            |
| `utils/notifications.ts` | Preserve toast DOM, CSS variables, IDs, classes, timing, stack/dedupe behavior; add a single disposal entry point for timers and container cleanup. |
| `components/*`           | Preserve behavior and attribution; use at least one foundation UI wrapper without removing existing information.                                    |
| `devTools.ts`            | Preserve `window.ClonecordDev` API; register/unregister through the lifecycle scope.                                                                |
| New `patches.ts`         | Define the exact existing patch through `definePatchManifest` with match expectations.                                                              |
| New `core/ownership.ts`  | Plugin-specific bridge between domain modules and the active `ResourceScope`; no generic foundation changes.                                        |
| New `core/discovery.ts`  | Validate the token store through foundation discovery helpers while retaining the lazy lookup fallback.                                             |
| New `pluginRuntime.ts`   | Construct the foundation runtime, logger, diagnostics, and optional bridge host.                                                                    |
| `tests/*`                | Add settings compatibility, patch fixture, lifecycle cleanup, and component smoke tests; keep existing domain tests.                                |

## Exact-preserve register

### Metadata

- Name: `Clonecord`
- Description: `Clone servers with channels, roles, permissions, and community features`
- Authors: `zpt0.dev`, id `299670891875270656n`
- Tags: `["Utility", "Customisation"]`
- Plugin version constant: `0.1.1`
- Update URLs/repo/support invite constants unchanged.

### Settings

All 21 existing settings and defaults are preserved exactly, including hidden component-backed toast keys:

- `updateNotifications = true`
- `discordServerJoin = true`
- `goToUpdateChannel = true`
- `toastSettings` component row, `description: ""`
- `toastPosition = "top-right"`
- `toastStyle = "glass"`
- `toastBgColor = "#000000"`
- `toastAccentColor = "#5865F2"`
- `toastTextColor = "#FFFFFF"`
- `toastPercentColor = "#43b581"`
- `toastBarBgColor = "#333333"`
- `toastBorderColor = "rgba(255,255,255,0.08)"`
- `toastBorderRadius = 10`
- `toastFontSize = 13`
- `toastPadding = 10`
- `toastOpacity = 85`
- `toastMaxWidth = 400`
- `toastAutoDismiss = true`
- `toastDismissDelayMs = 8000`
- `toastMaxStack = 5`
- `toastShowTimer = true`

All option labels/values, slider markers, select defaults, and `hidden` flags remain unchanged. No `restartNeeded` flag is introduced for existing settings.

Foundation adds its three reserved settings (`foundationBridgeEnabled`, `foundationDiagnosticsEnabled`, `foundationLogLevel`). These are additive foundation infrastructure settings and must be called out in the final report.

### DataStore

- `"Clonecord-clone-checkpoint"` with `CHECKPOINT_VERSION = 2`
- `` `Clonecord-selection-${guild.id}` `` with `{ channelIds: string[] | null, roleIds: string[] | null }`
- `"Clonecord-dismissed-version"` string
- Foundation diagnostic key `vpf:diagnostics:Clonecord` is additive and only written by explicit diagnostics persistence calls; no automatic format migration is introduced.

Checkpoint behavior to preserve:

- 7-day expiry.
- Ignore checkpoints younger than 60 seconds.
- Ignore checkpoints with `completedAt`.
- `clearCheckpoint()` writes `completedAt`, then deletes after 60000 ms.
- Resume prompt `expectedWork` continues to exclude `cloneEmojis`.

### Discord integration

- Patch must remain exactly:
    - `find: '"GuildChannelStore"'`
    - `match: /isChannelGated\(.+?\)(?=&&)/`
    - `replace: (m: string) => \`${m}&&false\``
    - no `noWarn`
- Context menus: `"guild-context"` and `"guild-header-popout"`.
- Menu item id: `clonecord-clone`; label: `Clone Server`; group: `privacy`.
- Raw `/api/v9/...` fetches continue using `findByPropsLazy("getToken")` and `Authorization: token`; no token is exposed to logs, diagnostics, bridge handlers, or devtools.
- Slot limits remain `{0:5,1:15,2:30,3:60}` stickers, `{0:8,1:24,2:36,3:48}` soundboard, `[50,100,150,250]` emoji.

### UI/CSS

- Preserve `#cloner-toast-container`, `.cloner-pill`, `.cloner-sub-pill`, `data-pos`, `data-style`, all `--cc-*` CSS variables, and legacy `.vc-pill-container` cleanup.
- Preserve AGPL attribution in `components/ToastSettings.tsx`, `components/ColorPicker.tsx`, and `components/toastSettings.css`.
- Foundation managed styles are additive; existing Clonecord CSS is not replaced.
- Vencord `managedStyle` must be the style name returned by `foundation/ui/styles.css?managed`, never the raw CSS string from `generatedStyles.ts`.

## Potential behavior changes and compatibility risks

1. **Settings type values**: Clonecord stubs used non-upstream `OptionType` numbers. They will be aligned to foundation/upstream values. This affects compile-time stubs only; Vencord's runtime enum is authoritative.
2. **Component row validation**: Foundation initially rejected empty descriptions. Housekeeping already relaxed validation for `COMPONENT` rows so `toastSettings` remains `description: ""`.
3. **Foundation settings are additive**: Three new settings appear in Vencord settings. They do not alter existing keys or defaults.
4. **Lifecycle cleanup is stricter**: Startup timeout, checkpoint delete timeout, clone abort controller, progress interval, toast timers, and devtools global are cleaned up on plugin stop. This is an intentional improvement; no user-visible clone feature is removed.
5. **Async `runtime.start()`**: The plugin entry point remains synchronous; startup work is scheduled through `void runtime.start(...)`. Failures are logged/diagnosed rather than thrown into Vencord startup.
6. **`runtime.values` limitation**: Foundation currently snapshots foundation settings twice, so `runtime.values` does not reflect live plugin settings. All plugin settings continue to be read from `settings` directly.
7. **Bridge is optional and inert by default**: `foundationBridgeEnabled` defaults to false. Capabilities are limited to schema/status/diagnostics and contain no token, clone, account, or arbitrary-code capability.
8. **UI convergence is additive**: Foundation styles and one wrapper component may be used, but toast and settings UI behavior remain byte-compatible where user-visible output matters.
9. **Discord runtime not verifiable here**: Static checks can validate compilation and fixtures, but Webpack module behavior and token handling require manual Discord verification.
10. **Dependency audit**: Current `npm audit` reports 0 vulnerabilities; no known advisories remain in the pinned test dependencies.
11. **Internal `server-hub` channel is skipped**: Discord exposes an undocumented `server-hub` pseudo-channel in some guild channel lists. The legacy plugin already tried to clone it and Discord rejected it with HTTP 400; newer Discord clients accept the request, so it would appear as an extra channel. It is now explicitly filtered from normal clone, resumed checkpoints, and retry. This restores the original visible behavior rather than removing a user channel.

## Validation plan

- `npm run check` in Clonecord: TypeScript, ESLint, Prettier, Vitest.
- Foundation `npm run check` after housekeeping.
- Scaffold validation: copied `foundation/` tree and `foundation/LICENSE` match scaffold output; `--foundation-only` preserves existing plugin files.
- Settings compatibility test: exact key/default/type/hidden assertions.
- Lifecycle cleanup test: scope disposal clears timeout, interval, abort controller, devtools global, and toast runtime.
- Patch fixture test: exact regex/replacement output and match counts.
- Component smoke test: foundation wrapper renders required static content.
- Source inspection: metadata, DataStore keys, patch, context menus, slot limits, toast DOM/CSS, attribution comments.
- Git status: Clonecord modified only; Questcord and Manycord untouched.

## Completion gate

After validation, produce a detailed Clonecord migration report and **STOP**. Do not touch Questcord or Manycord until explicit approval is received.
