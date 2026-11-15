# Pulse 1.0.3 — lyrics-provider selection hotfix

## Reproduced cause

The renderer source menu still required settings.spicy.key, even though official Spicy requests already use a project credential in the main process. An existing Spicy result could therefore display correctly, but choosing Apple Music and then Spicy left Apple selected and redirected to Settings. The Settings segmented control did not share that gate, creating inconsistent entry points.

A direct VM reproduction against the unchanged 1.0.2 source confirmed: requested Spicy, selected am, one Settings redirect. Against 1.0.3: requested Spicy, selected spicy, zero redirects. No live account or private user credential was involved.

## Changes

- Removed the obsolete personal-key gate and personal-key menu hint. Project authentication remains confined to the main-process official API request.
- Routed menu source changes through the same invalidation path as Settings. Both clear a non-user manual pick/recheck the current record. Reselecting the current source retries the renderer lookup, including an existing fallback. User-authored text is not cleared.
- Added per-track request identity and source/background/Spicy-preference checks before committing fetched lyrics. A slow response from an earlier source cannot overwrite the newest cache, including a newest not-found result. A manual pick made while a request is pending wins; user text and its timestamp are retained.
- Existing offsets, stretch, libraries, downloads, audio graph, timing conversion, provider attribution and service fallback rules remain unchanged. Apple Music (via Spicy Lyrics) is still legitimate Spicy attribution, not a different selected provider.
- Updated app/root packages and lockfiles, plugin/MineRadio version labels, installer default and current README to 1.0.3. Human English notes are in Logs/1.0.3.md. No GitHub publication or dependency version change.

## Checks

- Final root npm test: 439 passed, 0 failed, 0 skipped, including regenerated 1.0.3 installer artwork at every DPI. Repository structure and all historical report hashes pass.
- Packaged app.asar: all 240 first-party runtime files byte-match current source; packaged version is 1.0.3. Portable app.asar byte-matches that verified build.

- Eight new unit/integration tests cover empty personal keys, menu/Settings parity, invalid values, repeated selection, three overlapping requests, preference changes, newest-not-found precedence, custom/manual preservation, main-process project-API routing and exact inverse hashes.
- Full-renderer Chromium test passed: cached original Spicy → Apple → Spicy, with Apple deliberately resolving last; menu choice and visible text/cache stay Spicy. Also verified both Settings buttons, fallback retry, empty personal key, saved custom text, offsets/stretch, desktop and 390px menu, and no page errors. API transport is mocked; it is not a live service/account or Windows-native E2E test. Four regression screenshots were individually inspected.
- Full lyric-studio UI regression passed: timing model, drag/trim, undo/redo, real 0.5× audio and nonzero analyser, backwards slices, restoration, errors, saving, four locales, desktop/mobile and cleanup.
- Developer tests passed: 5 native/security/lifecycle mocks, plus full setup/developer/real-audio Prism-mini-spectrum UI suite at 390/620/1366, four locales, reduced motion and forced colors.
- All 12 earlier approved JSON manifests remain byte-identical to the 1.0.2 source release. New lyrics-provider-approved.json stores an exact seven-file hotfix/version inverse before earlier historical inverses; old expected hashes were not rebased.
- Windows media bridge reused unchanged: SHA-256 f01e84f7fed08fb5d64f6f6379e9900e7e542f8e5c9e366744b7c99fe3047890. This Linux worker has no .NET SDK.

## Limits

Windows-native install/update/uninstall, actual topmost/clipboard/DevTools behavior, hardware GPU/FPS, real service authentication and actual Spicy API availability require on-device acceptance. EXEs are unsigned. Browser tests use local fixtures and software WebGL, not a promise of service availability. Existing service fallbacks still apply when Spicy has no usable result; this release fixes ignored selections and stale-response cache overwrites rather than hiding fallback attribution.

## Final artifacts

- Windows PE file/product versions verified as 1.0.3. Portable and original custom NSIS Setup built successfully, publishing disabled; original installer design/logic preserved.
- Setup app.asar, native bridge and embedded Python ZIP byte-match the final unpacked build.
- Setup SHA-256: 9b17396b341c93eed0bb2296eb1d677b06549d3e2451516c0df736f8a2728c74.
- Portable SHA-256: f1ac911ae91c8bb882a6ec613fd6e02de836803add9aef213963a6919b0caa7e.
- Source archive built with build/source-archive.py, retaining nested Python runtime ZIPs, hidden oldlogs and human Logs while excluding node_modules/generated binaries/screenshots/secrets; a per-file SHA-256 manifest accompanies the sources.
