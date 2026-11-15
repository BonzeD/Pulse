# Pulse 1.0.3 — audio-only recorder and background lifecycle

## Scope

Built on the delivered DirectFix 1.0.3 source. Version remains 1.0.3. No new audio client policy, fetch timeout, retry order, link-selection rule, authentication/session clearing, or audio quality change. This work adds observations around the existing calls; it does not claim to fix the user's measured four-second delay without a capture from that machine.

## Developer workflow

Five quick right clicks on the Pulse logo → Audio / Звук → Start recording → play the affected tracks → Stop recording → Save JSON or Copy audio log. The existing companion stays pinned above Pulse. Refresh reads only the bounded recorder, not the general application snapshot.

The recorder starts disabled, stops on companion close/crash or after ten minutes, retains at most 240 events / 48 KB of event JSON, and rolls off the oldest events. It never writes automatically. Save opens the OS save dialog; cancel creates no file. Copy/export contains only audio stages and anonymous per-capture track references, not the generic developer report. Large captures can lose their beginning; the dropped-event count makes that explicit.

Stages include source mapping, stream resolution and cache status, player API responses, real-byte probes, backup resolution, upstream headers, first proxy bytes, media metadata/canplay/playing/waiting/stalled/seek/error and embedded-player fallback/state. Relative atMs timestamps and stage elapsedMs are software observations, not hardware output latency or proof of live YouTube availability. Source attribution is enumerated; no URL, track title/artist, raw ID, path, cookies, visitor data, token, request headers, response text or arbitrary exception message is accepted into the recorder. Track-ID aliases are bounded, memory-only and anonymized before export. No global console/network/body capture is installed.

## Background behavior

- An explicit native hide/minimize signal and document visibility cancel the actual ordinary renderer RAF instead of keeping a hidden early-return RAF alive. Restore schedules one frame and resets pacing.
- Spicy, classic lyric stage and Immersion visual loops stop while hidden. Immersion recreates its scene on demand after the grace-period release.
- After fifteen seconds hidden: release ordinary visualizer surfaces / owned GPU context, destroy settings preview instances, clear temporary blurred artwork, trim transient catalog responses. Persistent library, downloads, account state, lyric edits and user graphics settings are untouched.
- MineRadio can unload its visual iframe after the hidden grace period; explicit Keep scene loaded preference still wins. The authenticated YouTube playback iframe is never unloaded by this feature.
- Hidden widget stops its polling and CSS animations. Visible widget keeps progress/lyrics/controls; last state and lyrics are replayed on show. Hidden main-state pushes and media-session position updates are reduced; tray tooltip changes are deduplicated.
- Playback, the AudioContext, active DJ audio housekeeping, media controls and explicitly enabled musical wallpaper remain active. Electron backgroundThrottling stays false to avoid regressing embedded playback and DJ timing.
- New lifecycle namespace is PulseBackgroundRuntime; the existing theme editor's PulseBackground API must remain intact.

## Verification methodology and limits

Functional tests use the real app renderer in Linux Chromium, actual generated WAV bytes and AudioContext/analyser, plus a real local HTTP proxy fixture with two denied clients and one playable client. Native IPC uses mocked Electron objects with exact sender/frame checks. These establish software behavior, not a Windows RAM/CPU percentage, live YouTube/account behavior, actual sound-card latency, or native always-on-top behavior on the user's PC. The Task Manager screenshot is context only, not a before/after benchmark.

Historical approved JSON manifests remain byte-identical; background-approved.json/background-original.cjs form a new exact inverse layer. Existing historical assertions use that layer only for historical snapshots, while current behavior is independently exercised. UI regression testing found and corrected an initial namespace collision with the theme-background API before the final build. No historical production source was silently rebased.

Final command statuses and archive/native-bridge checks are recorded in BACKGROUND-AUDIOLOG-1.0.3.json.

## Reproduction commands

From `app/`: `npm ci`, `npm test`, `npm run test:background`, `npm run test:audio-engine`, `npm run test:direct-stream`, `npm run test:lyrics-provider`, `npm run test:file-video`, `npm run test:widget-clicks`, `npm run test:graphics-102`, `npm run test:developer`, `npm run test:prism`. Browser suites use the installed Chromium path (`CHROMIUM_PATH` can override it). Native builds require the existing bridge binary or a successful media bridge build; the source bundle deliberately follows the previous binary-exclusion policy.

After Windows packaging: `node build/verify-background.mjs` checks packaged first-party bytes (except the expected electron-builder removal of scripts/build/devDependencies from package.json), the native bridge fingerprint and PE app version. `sh build/make-setup.sh` retains the existing custom installer. Source bundles use `python3 build/source-archive.py OUTPUT.zip` and retain embedded Python's mandatory base_library.zip.
