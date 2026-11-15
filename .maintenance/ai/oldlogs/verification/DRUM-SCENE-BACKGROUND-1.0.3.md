# Pulse 1.0.3 — lyric drum, Mineradio bridge, hidden playback

> Historical report: background playback, later audio recovery/system-control changes and portable-only delivery were superseded by the author-requested [Atlas / audio rollback / setup](ATLAS-AUDIO-ROLLBACK-1.0.3.md). Drum and Mineradio bridge repairs remain.

## Baseline and boundaries

Continues the EmbeddedFirst release polish. Version stays 1.0.3, Windows x64 portable only, no installer/publication. No library/account reset, alternate-recording substitution or DSP/graphics-quality downgrade. Native helper source is unchanged. Diagnostic build: `DrumScene-EmbeddedFirst-AudioDiagnostics2`.

Upstream inspected: https://github.com/oirge/Mineradio at commit `4c7897231c67eff6a6f60dc895388783e5fc943d` (APP_VERSION 2.5.5). Pulse currently vendors a modified 2.4.4 scene. A wholesale app.js replacement would remove Pulse artwork morph/reaction, translations and bridge protections; it was not performed. The original rendering core remains byte-identical. See `MINERADIO-COVERAGE-1.0.3.md` for the explicit feature inventory and remaining work. This is NOT a claim of a complete Mineradio/Folia port.

## Implemented changes

### Cylindrical sidebar lyrics

`lyric-drum.js/css` project existing timed lines onto a cylinder with perspective, vertical compression and depth fade. Existing word/karaoke elements are retained, no duplicate lyric source or fake timing. Current line centers normally; scrolling, seeks and return-to-current update the same projection. Offset/height layout measurements are cached on content/resize/font changes, a bounded RAF follows existing CSS scroll transitions, and only nearby rows are projected. Hidden windows cancel the RAF. Plain/empty/instrumental lyrics are unaffected. End-credit rows and interlude dots remain part of existing layout.

`ly.drum` defaults true and is an actual schema key so mergeDeep preserves opt-out across restarts. Settings → Lyrics → Scrolling exposes the switch. Reduced-motion, disabled animations and forced-colors use the existing flat list. At <=900px the selected lyrics tab remains visible rather than losing its entire sidebar. At <=600px the player header uses two rows to avoid navigation/account overlap; full-width search stays available. No new images or audio graph.

### Mineradio bridge repairs

- Queue identity now includes all displayed items and metadata, not just length/first/last. In-place middle reorder, artist/title/cover edits are observed.
- Queue index outside the 400-item visual projection is -1, not silently clamped to the wrong song. Full playback queue remains in Pulse.
- Explicit Play/Pause share pending-aware idempotent transport commands. Selecting the same loading card sends Play, never Toggle/Pause.
- Shelf hover is explicitly a no-op under EmbeddedFirst; cannot request speculative direct/yt-dlp resolution.
- Console preset, quality, shelf and lyric visibility changes persist to Pulse, with reentrancy guards and try/finally around host-driven application. Unrelated settings changes no longer restore old console choices.
- Original shelf modes Off / Side / Stage are exposed in Pulse. New `ly.mrShelfMode` keeps the old boolean `ly.mrShelf` compatible, including old disabled profiles.
- Float spectrum/waveform analyser calls project real available byte data rather than unconditional silence, reusing scratch storage. This is byte-derived data, not a new or higher-resolution audio capture. No stream/spectrum is fabricated when capture is unavailable.

### Background playback recovery

`playback-watchdog.js` is a pure state machine; `background-playback.js` polls once/second independently of visual RAF. Hidden embedded playback with positive intent gets one Play retry after 2 seconds of unexpected PAUSED/CUED/unstarted state. A continuous no-progress interval reaches fallback after 10 seconds (plus polling granularity), even if a PAUSED event cleared the ordinary buffering timer. Real playhead movement or a seek resets the stall budget. A missed ENDED notification can advance once if the current started player reports ENDED near the real duration. Exact current job/token/video identity and pause intent are checked before action.

Explicit Pause, foreground playback, local/downloaded files, native Audius and mapping/waiting jobs are not taken over by this module. Fallback uses the existing same-recording resolver and seek preservation; no window focus/show is required. Hidden renderer orchestration remains NORMAL OS priority rather than being demoted with the graphics process. GPU demotion and hidden visual shutdown remain intact. This is a plausible recovery for the reported symptom, not a native-Windows reproduction of its unique root cause.

New diagnostic reason enums: `background-resume`, `background-stall`, `background-ended`. Privacy/size limits remain unchanged.

## Verification

See `drum-scene-checks/` and release-polish evidence. Current tests execute the real renderer and actual vendored Mineradio WebGL scene, with synthetic YouTube/IPC fixtures. Current code is tested directly; only historical controls apply the exact release-polish inverse. Older approved manifests remain unchanged. Final counts, hashes and payload inspection are recorded after packaging.

Manual Windows checks still required: real tray/minimize auto-next through several songs, intermittent connection, SMTC Pause during load, restore without duplicate start, all visual presets/graphics drivers, real service restrictions. Linux Chromium does not establish native Windows reliability or guaranteed startup latency. Linux Electron GUI is blocked here by missing libgtk-3.so.0.

### Final test results

- Full root suite: 618 tests, 617 passed, 0 failed, 1 skipped; repository structure passed, including all 615 original paths and unchanged historical reports.
- Targeted release polish + new scope: 25 tests passed. Real renderer UI fixtures passed drum/manual scroll/390px/reduced-motion/disable/hidden RAF, hidden end/retry/pause, and actual Mineradio WebGL metadata/persistent console/hide/restore.
- Final narrow-header visual review separates search, visual-return control and lyric tabs. No source lyric timing or words are replaced.
- Canonical source packager retains the four sanitized historical startup-fix `.log` reports shipped with the baseline; unrelated temporary logs, node_modules, build output and generated native helper remain excluded.

- Repeated final release-polish and EmbeddedFirst full-renderer UI scenarios also passed, including actual MediaSession/IPC callbacks with mock YouTube, pending Play/Pause, failure retry, fallback seek and stale resolver isolation. The sole skipped unit check concerns generated installer artwork; no installer is shipped.

### Portable artifact verification

Electron 44.10.1, Pulse 1.0.3, Windows x64 portable, unsigned. Compared all 250 first-party ASAR files against current sources and 7 external resource checks. Extracted the final portable and compared all 226 payload files byte-for-byte with win-unpacked. yt-dlp embedded runtime is complete; Pulse and native helper are x64 PE.

Portable: 201801466 bytes; SHA-256 `d4008a4aff7cc5ad46e89c76fb3366275353d32f83a2bc3d1a5158ec31403146`. No native Windows execution or live YouTube latency claim.
