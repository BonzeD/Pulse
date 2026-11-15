# Audio-engine audit — Pulse 1.0.3

## Scope and intent

Audit of stream resolution/proxying, catalog-to-recording matching, core renderer transport, prefetch, DJ asynchronous deck loading/transition handling and their interactions with local files, file video, Audius, lyrics and visual signal paths. Version remains 1.0.3. No GitHub publication, profile reset, library migration or installer redesign. This is not a proof that every service/device combination is bug-free.

## Confirmed problems and changes

1. YouTube player API clients were tried serially with nine-second per-client deadlines; a usable URL still waited for an additional six-second range probe. `stream-race.js` starts alternates at 350ms intervals, accepts the first usable result and aborts losers. Removed the redundant probe; the real media request handles URL rejection. Existing itag 140/M4A/bitrate preference is unchanged. Fresh-guest and yt-dlp fallback remain for foreground requests.
2. Cached service recording matches still waited for track metadata and sometimes ISRC. Reuse the known match first; deduplicate uncached metadata/ISRC/matching. Matching scores and thresholds remain unchanged.
3. A canceled HTTP consumer could still open upstream media after metadata finished. Close listeners now attach before resolution and cancel media fetches. Shared metadata work can finish for other consumers/cache. Headers have a 15-second deadline cleared on arrival, not a timeout on the entire song.
4. Expired/denied URLs could race with concurrent range requests and delete a newer URL. Identity-guard cache invalidation, bounded retry, discarded denial bodies and correct 200/206/416 forwarding. Bound the completed/persisted URL cache to 200 records and validate video IDs.
5. yt-dlp timeout depended on a later process-close event. Kill now also settles the promise and releases counters even if close never arrives; output is capped. Speculative next-track/hover work does not invoke this fallback.
6. Captured autoplay ignored a user’s later pause, and transport toggles could start duplicate resolution. Explicit latest playback intent, pending state and token-guarded callbacks handle pause/play without empty-element play or duplicate requests.
7. Sub-second resume positions were discarded; stale metadata listeners could linger. Preserve pending seek/resume, reject nonfinite values, clamp to duration and clean listeners on load changes.
8. Retry state grew per track for the whole session; paused errors could retry/skip anyway. Retry is per load, and paused errors await manual action. Delayed skip checks current token and intent. Startup fallback watches assigned-but-stalled media too and is canceled on pause/playing/source change.
9. Manual DJ deck loads and automatic transitions accepted stale responses or left loading/busy state after rejection/cancellation. Request/epoch/load-token guards, cancellation and cleaned readiness listeners/timers fix these paths. A failed armed transition cancels gain/filter automation and restores the original audible deck.

## Preservation

No change to audio quality selection, EQ, pitch/time stretching, main analyser routing, graphics quality or FPS limits. No additional audio graph. No account/library/download deletion. Existing Spicy Lyrics provider hotfix preserved. Original custom NSIS installer source/design unchanged. Historical approved manifests retained byte-for-byte; new exact inverse `audio-engine-approved.json` and `audio-engine-original.cjs` cover modified baseline runtime/package files.

## Automated verification

- New unit suite: 23 passing checks covering hedged resolution, aborts, metadata/cache dedup, no startup probe, media-close cancellation, range/403 recovery, header deadline lifetime, yt-dlp timeout, intent/races/seeks/retries, service matching cache, low-priority fallback exclusion, DJ stale loads/cancellation/listener cleanup and failed-fade restoration.
- New full-renderer audio integration: a generated real WAV through the actual media element and AudioContext/analyser, pause while resolving, UI resume, no duplicate resolution, paused offline .4-second resume, seek during pending resolution, out-of-order track responses and metadata-listener cleanup. HTTP fixture implements byte ranges (a full-response-only fixture cannot validate seeks).
- Existing audio-signal integration passed: real sine -> local/iframe -> visual signal, bass and Mineradio.
- Existing file-video integration passed: real playback, pause/resume/seek/volume, mode changes, offline files, stale loads, conversion fixture and dropdown behavior.
- Existing lyric-studio integration passed: real .5x audio and analyser, slicing/rate restoration, text editing/history/locales and cleanup.
- Existing lyrics-provider integration passed: Spicy -> Apple -> Spicy, stale-response/cache protection, empty personal key, custom text/timing preserved.
- Full root `npm test`: **462 passed, 0 failed, 0 skipped**; includes generated installer artwork at all five DPI scales. Structure check: 615 original paths retained, historical reports unchanged, npm/CI/package paths valid.
- Developer integration passed: setup draft/rollback/preservation, optional auth, Settings source picker, real audio mini spectrum, opt-in tools/cancellation/cleanup, responsive layouts and localization; native Windows behavior is not covered.
- Packed `app.asar`: 241 first-party files matched working-source bytes; package version 1.0.3 and the new resolver module present. Native Windows executable resource reports FileVersion/ProductVersion 1.0.3.
- All 13 prior approved test manifests and original installer source/design matched the original 1.0.3 source archive byte-for-byte.
- Portable and custom NSIS setup both extracted successfully. Their app.asar, unchanged Windows media bridge and embedded Python base_library.zip byte-match win-unpacked. Setup resource FileVersion/ProductVersion are 1.0.3. Build completed successfully.

## Limits

Linux headless Chromium plus mocked main-process/native/service APIs and local audio/video fixtures. No authenticated live YouTube/Apple Music/Spotify/Audius timing benchmark, Windows-native device playback test, or physical audio-device switch test. Reduced application-side waiting is verified; do not promise a fixed number of seconds for real network playback. Electron/Windows installers are built and inspected, not launched on Windows here.

## Delivered Windows files (SHA-256)

- `Pulse-Setup-1.0.3-Audio.exe` — 242004078 bytes — `3c7fd989b1795d4e0e8aab4aea6f75c23af08b4c1b6eae5de6dc5027ea7408dd`
- `Pulse-1.0.3-Audio-portable.exe` — 223646032 bytes — `d8627ece548079f3ae4644aa90724379f93827cc0dcc3e8f6bc8b38bf7eae403`
