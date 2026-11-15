# Pulse 1.0.3 — Atlas, targeted audio rollback, Windows setup

## Scope and authority

The author reported silent/slow playback and requested rollback of audio changes only, a polished Atlas and a setup installer. This supersedes the previous portable-only request. Version remains 1.0.3; no publication, profile migration/reset, graphics-quality reduction or whole upstream scene replacement.

The audio target is the earlier **user-confirmed EmbeddedFirst 1.0.3** source archive, not stable 1.0.2. The previous delivered DrumScene source was restored in full before the targeted changes. Lyric drum, Mineradio queue/console bridge repairs, diagnostics/copy fixes, local/Audius routes and Electron 44.10.1 security update remain.

## Audio rollback

- Restored the entire embedded-player block from `let player, ready =` through the queue/playback section marker byte-for-byte against the user-confirmed EmbeddedFirst baseline. `tests/fixtures/atlas-audio-baseline.txt` is the exact text fixture, asserted against current production code.
- Reversed the later startup/buffering timer, late PLAYING, failed-load retry flag and global MediaSession/native system-command patches. Earlier hidden renderer priority behavior is restored. These are intentional reversions, including historical limitations, not new claims that loading/pause edge cases are solved.
- Removed `playback-watchdog.js` and `background-playback.js` script tags from production index.html. Files and historical tests remain for audit; they are not executed by the app.
- Retained `transportPlay`/`transportPause` only for the preserved Mineradio card bridge. The global system-command wiring is rolled back.
- Embedded YouTube remains first. Direct media/yt-dlp remains fallback; no automatic hover/queue prefetch or whole-file analysis during successful embedded playback.
- Diagnostic build tag: `Atlas-AudioRollback-EmbeddedFirst`. Logs retain enum-only safe categories, bounded capture and improved native copying. No raw URL/error/credentials added.

This proves rollback scope, not that the user's Windows sound or background problem is fixed. Real services, connection restrictions, embedding bans and native behavior still require testing.

## Implemented Atlas

`renderer/atlas-model.js` is a pure local graph builder. `atlas.js/css` register the sidebar page without taking ownership of audio or changing existing scene quality. The page uses real likes with known metadata, saved playlists and imported/local tracks; there is no shipped sample library. Test screenshots use synthetic fixtures, not the user's collection.

- Artist keys normalize Unicode/case/whitespace. Unknown metadata is not invented. Original track IDs are retained and deduplicated.
- Edges mean shared saved playlists or collaboration metadata. Liked songs alone do not connect unrelated artists. Link weight counts playlist membership and collaborations; it is not measured musical similarity.
- Bounds: 5,000 tracks, 120 artists, 200 playlists and 20,000 playlist-track visits; pair generation uses the first 50 retained artist memberships per collection. Truncation is disclosed. Missing items outside these bounds can mean no route in the current map.
- BFS chooses the fewest artist steps, with stronger-edge tie ordering. Routes longer than 12 artists are reported rather than played; disconnected paths are not fabricated. A route picks one available collection recording per step and avoids duplicates, so a collaboration may yield fewer recordings than artists.
- Actual SVG nodes/edges, orbital guides, deterministic staggered layout, selected-artist detail, full-map artist search, bounded drag, zoom/reset and route highlighting. The chart shows a responsive subset while all retained artists remain searchable.
- Start/end selection, swap, real track list, explicit play through existing `playList`, and normal saved playlist using original slim track records. No audio resolution is triggered by opening Atlas or choosing artists.
- Desktop and 390px layouts; temporary narrow drawer, Escape/focus/aria handling, no mutation of saved sidebar preference. Empty, single artist, disconnected and reduced-motion states tested.
- Russian and English UI; other app languages use English fallback. Reduced motion and forced colors supported.
- No listening-history collection, telemetry or library upload. Normal existing artwork loading can still contact the artwork service. No perpetual RAF/interval, new AudioContext, service API or background physics loop. ResizeObserver exists only while the page is active.

Not implemented: listening trails/history, inferred mood/BPM/key, external discovery graph, editable intermediate route waypoints, cloud AI recommendation, beat-matched/gapless transitions or full Mineradio/Folia parity.

## Tests and historical controls

Final root suite: **613 passed, 0 failed, 0 skipped**, plus repository structure validation (615 original paths retained). It includes 8 new Atlas unit/regression checks. The historical 13-test `release-polish.cjs` remains unchanged but is intentionally excluded from the current test command: it asserts audio behavior the author explicitly requested to revert. Existing approved release-polish manifests were not rewritten.

`atlas-original.cjs` plus `atlas-approved.json` form an exact inverse layer before the older historical control chain. Current Atlas/EmbeddedFirst/drum UI tests execute actual current production code, not reversed code.

Evidence in `atlas-checks/` includes final unit/structure output, real-renderer fixture checks, package validation, documentation validation and installer verification. Browser fixtures cover Atlas search/map/routes/play/save/swap/navigation/mobile/empty/disconnected; drum projection/manual/reduced-motion/hidden cleanup; actual Mineradio WebGL queue metadata and persistent console; EmbeddedFirst route/fallback/stale-load isolation. YouTube/IPC are synthetic in these tests.

## Windows build and delivery

Built current app with `electron-builder --dir --win --x64 --publish never`, then `sh build/make-setup.sh` from app. Existing branded NSIS design was reused; all DPI resources regenerated for 1.0.3 and the approximately 680 MB installed payload. Default-resolution installer screens and selected 200% screens were visually inspected. Screens are artwork previews, not a native installation run.

The app's ASAR was compared byte-for-byte against current first-party source (253 files), plus seven external resource groups. Electron is 44.10.1, Pulse 1.0.3, Windows x64. The unchanged self-contained native media helper is the previously cross-published .NET 8.0.427 binary. Installer extraction and payload hashes are recorded separately in `atlas-checks/setup-validation.json`.

Install/update code preserves the profile. Existing uninstall design has separate settings/library/sign-in/cache removal and downloaded-track choices; settings removal is enabled by default, downloads removal is disabled. Do not tell users uninstall preserves all data by default. No native install/update/uninstall test was possible here.

The installer is unsigned. No native Windows/SMTC/live YouTube/audio/background switching claim is made. Stale portable artifacts are not part of this delivery. The full source ZIP excludes dependencies/build output but preserves mandatory nested Python runtime ZIPs and historical source reports; its file manifest and CRC are verified by the canonical archive script.
