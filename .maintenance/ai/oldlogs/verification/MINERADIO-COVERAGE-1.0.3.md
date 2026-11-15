# Mineradio coverage audit — Pulse 1.0.3

Reference: https://github.com/oirge/Mineradio/tree/4c7897231c67eff6a6f60dc895388783e5fc943d . Read README_EN.md, public/app.js, docs/FOLIA_INTEGRATION.md, docs/FOLIA_BRIDGE.md, LICENSE, NOTICE.md and the vendored Folia origin record. This inventory is deliberate: do not describe the current delivery as “everything ported”.

| Upstream area | Current Pulse status |
| --- | --- |
| Eight GPL scene presets (0–7), particles, camera, cinematic controls, 3D lyric meshes | Already vendored; original rendering core retained rather than overwritten. Existing Pulse artwork morph and transient reaction retained. |
| 3D shelf, side and stage engines, queue-card playback | Existing engines retained; exposed modes and repaired queue metadata/order identity, pending selection, console persistence. 400-item visual projection remains bounded; playback queue is not truncated. |
| Scene preset/quality/lyrics/shelf controls | Repaired two-way Pulse persistence. Other fine scene controls still use original Mineradio local storage. |
| Audio spectrum/waveform input | Existing Pulse direct/native or embedded capture data; byte and float access now reflect available signal. No made-up beat/silence replacement and no second audio output. |
| Local files/library/playlists/downloads/accounts/EQ/DJ/miniplayer/desktop lyrics | Owned by Pulse, NOT replaced with a second Mineradio database or audio engine. Functional equivalence is not exhaustive; importer and lyric-format gaps need separate tests. |
| KRC/QRC encryption/encoding, automatic folder watching, smart library categories, per-track stats/resume, whole-app backup | Not ported in this change; upstream features are not claimed as Pulse features. Must preserve stable local IDs/user data when implementing. |
| Folia 0.7.16 integration (14 lyric renderers, 5 backgrounds, Polaroid record wall, Lattice poster wall, original panels/assets) | Not included. It is a separate React/Vite surface with a detailed frame protocol and AGPL-3.0 source, not a drop-in scene script. A real port requires full source/lockfiles/license notices, a Pulse-owned exact-origin/window message bridge, playlist/catalog operations, bounded asset leases, hidden lifecycle tests, no second Audio/AudioContext and complete end-to-end UI coverage. |
| Wallpaper Engine original preset 8 | Not copied. CmzYa build artifacts have separate provenance; existing Pulse restriction is retained. Do not assume GPL for third-party assets merely because the host repository is GPL. |
| Native Wallpaper Engine desktop capture, plugin execution, online login/search/sync services | Not blindly exposed through the renderer bridge. Pulse has separate native/security APIs; each requires a deliberate scoped integration, permissions, lifecycle and target-platform tests. |
| Current upstream UI language layer and Folia loading/switching changes | Not wholesale transplanted. Pulse keeps its own four-language controls and existing Mineradio translation bridge; no duplicate Chinese startup/library/login UI. |

## Safe next phase

1. Implement the Folia local-only bridge against Pulse-owned catalog, queue, lyrics and controls, preserving stable service/local IDs and the current recording. Include AGPL source and notices; never ship compiled-only assets.
2. Validate all 14 renderers and 5 backgrounds, both walls and original settings panels with current/empty/missing-lyric states, real seek/pause, 390px, keyboard/reduced motion and hidden suspension.
3. Add encrypted/encoded local lyric import and folder watching as isolated main-process features with path, file-change, cancellation and no-data-loss tests.
4. Only then label the remaining features complete. A startup screenshot or unchanged scene core cannot certify full parity.
