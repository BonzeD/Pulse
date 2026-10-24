# Pulse 1.0.2 — setup, developer companion and Prism spectrum

## Scope

- Kept release version 1.0.2; no GitHub publication. Existing custom installer design and install/update/uninstall logic were not redesigned.
- Rebuilt the five-step setup around Pulse theme tokens, original branding, directional transitions and an animated logo. Draft settings, optional sign-in, durable save/rollback and existing-library preservation remain in place. Reduced-motion, disabled-animation, narrow-layout and forced-color fallbacks are supported.
- Replaced the diagnostics modal with a separate, single-instance, parented, always-on-top developer BrowserWindow. Open with five quick right-clicks on the Pulse logo.
- Added native main-window Chromium DevTools, element picking, temporary element outlines and 390/768 width guides, screenshot-to-clipboard, sanitized runtime/audio/state reports, read-only checks, opt-in five-second RAF interval measurements and safe setup/Prism/settings entry points. Measurements explicitly do not claim hardware GPU timing. No destructive reset or arbitrary evaluation command was added.
- The companion uses a restricted separate preload, sandbox, context isolation, exact sender/frame/route checks, a fixed command allow-list and bounded pending requests. Close, cancellation and hidden-window paths release temporary tools and frame sampling. DevTools and screenshots can expose page data; the UI warns before sharing.
- Moved the existing full current-recording picker from the player area to Settings → Client → Audius. Original links and mapping reset remain available there.
- Replaced the visible Prism caption with 24 miniature segmented bars, reusing the existing real audio signal and draw callback. No second analyser, AudioContext or animation loop, and no fake random beat. Pause/silence uses a baseline; reduced motion is static. Existing glass rendering, palette extraction and playback are preserved.
- Removed root AGENTS.md. Moved historical docs intact to .maintenance/ai/oldlogs. Added human-readable English release notes in root Logs.

## Verification

- Root `npm test`: 431 tests passed, 0 failed, 0 skipped, including generated installer DPI artwork checks. Repository structure check passed: 10 top-level entries, 615 original paths accounted for; historical reports unchanged.
- `test:developer` components: five native/security/lifecycle source tests pass; full renderer developer-experience UI test passes. The fixture uses a valid synthetic recording, generated WAV, actual WebAudio graph and real analyser, with a mocked native IPC transport. Verified first-run markers, existing profile bypass, optional auth interactivity, draft/language behavior, failed-save rollback/retry, library preservation, source control relocation and enabled picker, opt-in tools, cancellation and teardown.
- Developer companion tested at 920×740, 620 and 390 CSS pixels, with RU/EN/JA/UK strings. Main setup tested at 1366 and 390, all five steps, normal/reduced-motion/forced-color states. Screenshots are generated in tests/artifacts/developer-experience (excluded from source releases). Representative desktop/narrow states, error state, source picker, companion tools/localizations and Prism output were individually inspected; focus-ring, icon glyph, long sidebar label and footer-access issues were corrected.
- `test:prism`: startup, live and full-app integration suites pass, including actual WAV → existing analyser → live glass, silence/playing behavior, repeated open, keyboard exits, tray visibility simulation, reduced motion, forced colors, GPU/context fallback and cleanup. These are Chromium tests, not native Windows tray tests.
- `test:final-ui`: passed Ukrainian, widget return handle, effect rendering, camera continuity, shaders, scroll glass and reduced motion checks.
- `test:final-effects`: all 280 effect comparisons changed as expected; no unchanged outputs.
- `test:widget-clicks`: 97 pointer/command checks passed across three sizes and lock/scale states.
- `test:file-video`: passed full-app playback, pause/resume, seeking, shared volume, fullscreen command, switching, audio-only/offline/converted cases, stale-load guards, dropdowns, dialogs and download menus.
- Exact reviewed inverse patches reconstruct previous runtime baselines for older regression suites. Historical baseline manifests were not silently rehashed to approve new behavior.
- Windows portable built with Electron 44.8.0, x64, publishing disabled. Packaging compression level 5 affects archive size only, not runtime graphics or FPS settings.
- Packaged app.asar was byte-compared against all 15 changed runtime files. Portable app.asar matches the unpacked final build.
- The original Windows media bridge was reused unchanged because this Linux worker has no .NET SDK: SHA-256 f01e84f7fed08fb5d64f6f6379e9900e7e542f8e5c9e366744b7c99fe3047890. The embedded yt-dlp Python base_library.zip is retained.

## Limits / required on-device acceptance

This worker is Linux. UI suites run headless Chromium with software WebGL; native Electron window flags, IPC origin checks, screenshots and DevTools entry points are covered by mocks and source-level checks, not by launching Windows Electron. Do not describe the following as tested on Windows:

- Actual install/update/uninstall, SmartScreen and OS-specific window chrome.
- Real parent/topmost behavior, native DevTools interaction and native screenshot clipboard.
- Real Windows tray/hit testing/SMTC/media keys, real account sign-in or live service availability.
- Hardware GPU performance, driver-specific rendering and frame-rate promises.

Windows EXEs are unsigned. No dependency upgrade or blanket remediation of inherited dependency warnings was performed. Profile-preserving behavior is tested with fixtures; use a backup for on-device acceptance.

## Final artifact integrity

- Custom NSIS Setup build completed successfully. Extracted app.asar, Windows media bridge and embedded Python base_library.zip byte-match the final unpacked build. Used official 7zz for custom NSIS inspection (the minimal system 7za does not support NSIS).
- Setup SHA-256: c13d4d13b4ccbf6244a0ed16821b61b7d6d4f1c41a858f981c4e56d029f48652.
- Portable SHA-256: 170279d2121e6968a1d294d4224e2e8fea12a01196503aac36177d39037131bd.
- Source release uses build/source-archive.py: excludes node_modules, generated builds/screenshots and secret environment files; retains nested runtime ZIPs, human Logs and hidden historical oldlogs; emits a per-file SHA-256 manifest and verifies every archive entry against source.
